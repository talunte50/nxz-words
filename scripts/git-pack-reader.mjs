/**
 * 极简 Git packfile 读取器（纯 Node，零依赖）
 *
 * 支持：松散对象、pack v2（含 OFS_DELTA / REF_DELTA）
 * 用途：本环境 child_process.spawnSync 调用 git 会抛 EBUSY，故完全手工解析 .git。
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TYPE_BY_NUM = { 1: "commit", 2: "tree", 3: "blob", 4: "tag" };

export function createGitReader(gitDir) {
  const packedBySha = new Map(); // sha -> {type, buf}
  const shaByOffset = new Map(); // offset -> sha
  const offsetBySha = new Map(); // sha -> offset
  const packOfOffset = new Map(); // offset -> pack index
  const packs = []; // { buf }

  // ---------- 载入所有 pack ----------
  const packDir = path.join(gitDir, "objects", "pack");
  if (fs.existsSync(packDir)) {
    for (const f of fs.readdirSync(packDir)) {
      if (!f.endsWith(".idx")) continue;
      const base = f.replace(/\.idx$/, "");
      const packPath = path.join(packDir, `${base}.pack`);
      if (!fs.existsSync(packPath)) continue;
      const buf = fs.readFileSync(packPath);
      const packIndex = packs.length;
      packs.push({ buf });
      readIdx(path.join(packDir, f), buf, packIndex);
    }
  }

  function readIdx(idxPath, packBuf, packIndex) {
    const idx = fs.readFileSync(idxPath);
    if (idx.readUInt32BE(0) !== 0xff744f63) throw new Error(`不支持的 idx 版本: ${idxPath}`);
    const count = idx.readUInt32BE(8 + 255 * 4);
    const shaStart = 8 + 256 * 4;
    const offStart = shaStart + count * 20 + count * 4;
    const bigStart = offStart + count * 4;

    for (let i = 0; i < count; i += 1) {
      const sha = idx.subarray(shaStart + i * 20, shaStart + i * 20 + 20).toString("hex");
      const v = idx.readUInt32BE(offStart + i * 4);
      const offset = v & 0x80000000
        ? Number(idx.readBigUInt64BE(bigStart + (v & 0x7fffffff) * 8))
        : v;
      shaByOffset.set(offset, sha);
      offsetBySha.set(sha, offset);
      packOfOffset.set(offset, packIndex);
    }
  }

  // ---------- 单对象解压 ----------
  const inflight = new Set();

  function readAtOffset(packIndex, offset) {
    const pack = packs[packIndex].buf;
    let p = offset;
    const b0 = pack[p];
    p += 1;
    const typeNum = (b0 >> 4) & 7;
    let shift = 4;
    let b = b0;
    while (b & 0x80) {
      b = pack[p];
      p += 1;
      shift += 7;
    }

    if (typeNum === 6) {
      // OFS_DELTA: 负偏移用「每字节 +1 累积」编码
      let c = pack[p];
      p += 1;
      let off = c & 0x7f;
      while (c & 0x80) {
        c = pack[p];
        p += 1;
        off = ((off + 1) << 7) | (c & 0x7f);
      }
      const baseOffset = offset - off;
      const { data } = inflateAt(pack, p);
      const base = resolveByOffset(baseOffset);
      return { type: base.type, buf: applyDelta(base.buf, data) };
    }

    if (typeNum === 7) {
      // REF_DELTA: 后跟 20 字节 base sha
      const baseSha = pack.subarray(p, p + 20).toString("hex");
      p += 20;
      const { data } = inflateAt(pack, p);
      const base = resolveBySha(baseSha);
      return { type: base.type, buf: applyDelta(base.buf, data) };
    }

    const { data } = inflateAt(pack, p);
    return { type: TYPE_BY_NUM[typeNum] || "blob", buf: data };
  }

  function resolveByOffset(offset) {
    const sha = shaByOffset.get(offset);
    if (sha && packedBySha.has(sha)) return packedBySha.get(sha);
    if (!sha) throw new Error(`offset ${offset} 不在索引中`);
    return loadSha(sha);
  }

  function resolveBySha(sha) {
    if (packedBySha.has(sha)) return packedBySha.get(sha);
    return loadSha(sha);
  }

  function loadSha(sha) {
    if (inflight.has(sha)) throw new Error(`对象依赖成环: ${sha}`);
    inflight.add(sha);
    try {
      const loose = loosePath(sha);
      if (fs.existsSync(loose)) {
        const raw = zlib.inflateSync(fs.readFileSync(loose));
        const nul = raw.indexOf(0);
        const header = raw.subarray(0, nul).toString("utf8");
        const sp = header.indexOf(" ");
        const obj = { type: header.slice(0, sp), buf: raw.subarray(nul + 1) };
        packedBySha.set(sha, obj);
        return obj;
      }
      const off = offsetBySha.get(sha);
      if (off === undefined) throw new Error(`找不到对象 ${sha}`);
      const obj = readAtOffset(packOfOffset.get(off), off);
      packedBySha.set(sha, obj);
      return obj;
    } finally {
      inflight.delete(sha);
    }
  }

  function inflateAt(pack, offset) {
    const out = zlib.inflateSync(pack.subarray(offset), {
      finishFlush: zlib.constants.Z_SYNC_FLUSH,
    });
    return { data: out };
  }

  /** pack delta 格式：base-size varint、result-size varint、copy/insert 指令流 */
  function applyDelta(baseBuf, delta) {
    let p = 0;
    function varint() {
      let v = 0;
      let shift = 0;
      let b;
      do {
        b = delta[p];
        p += 1;
        v |= (b & 0x7f) << shift;
        shift += 7;
      } while (b & 0x80);
      return v >>> 0;
    }
    const baseSize = varint();
    const resultSize = varint();
    if (baseSize !== baseBuf.length) {
      throw new Error(`delta base 大小不匹配: 期望 ${baseSize} 实际 ${baseBuf.length}`);
    }

    const out = Buffer.alloc(resultSize);
    let o = 0;
    while (p < delta.length) {
      const cmd = delta[p];
      p += 1;
      if (cmd & 0x80) {
        let cpOff = 0;
        let cpSize = 0;
        for (let i = 0; i < 4; i += 1) {
          if (cmd & (1 << i)) { cpOff |= delta[p] << (i * 8); p += 1; }
        }
        for (let i = 0; i < 3; i += 1) {
          if (cmd & (1 << (4 + i))) { cpSize |= delta[p] << (i * 8); p += 1; }
        }
        if (cpSize === 0) cpSize = 0x10000;
        baseBuf.copy(out, o, cpOff, cpOff + cpSize);
        o += cpSize;
      } else if (cmd) {
        delta.copy(out, o, p, p + cmd);
        o += cmd;
        p += cmd;
      } else {
        throw new Error("delta 中出现保留指令 0x00");
      }
    }
    return out;
  }

  function loosePath(sha) {
    return path.join(gitDir, "objects", sha.slice(0, 2), sha.slice(2));
  }

  /** 读取任意对象 */
  function read(sha) {
    return loadSha(sha);
  }

  return { read };
}
