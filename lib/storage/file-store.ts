import { promises as fs } from "node:fs";
import path from "node:path";
import type { KVAdapter } from "./types";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "kv.json");

type Doc = Record<string, unknown>;

let cache: Doc | null = null;
let queue: Promise<void> = Promise.resolve();

async function load(): Promise<Doc> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    cache = JSON.parse(raw) as Doc;
  } catch {
    cache = {};
  }
  return cache;
}

async function flush(): Promise<void> {
  const snapshot = JSON.stringify(cache ?? {});
  queue = queue.then(async () => {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, snapshot, "utf8");
  });
  await queue;
}

export class FileKVAdapter implements KVAdapter {
  async get<T>(key: string): Promise<T | null> {
    const doc = await load();
    const value = doc[key];
    return value === undefined ? null : (value as T);
  }

  async put<T>(key: string, value: T): Promise<void> {
    const doc = await load();
    doc[key] = value;
    await flush();
  }

  async delete(key: string): Promise<void> {
    const doc = await load();
    if (key in doc) {
      delete doc[key];
      await flush();
    }
  }

  async list(prefix: string): Promise<string[]> {
    const doc = await load();
    return Object.keys(doc).filter((k) => k.startsWith(prefix));
  }
}