import type { KVAdapter } from "./types";

interface RawKV {
  get(key: string): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<unknown>;
}

const BINDING_NAMES = ["VOCAB_KV", "KV", "PAGES_KV", "EDGEONE_KV"];

function findBinding(): { name: string; kv: RawKV } | null {
  for (const name of BINDING_NAMES) {
    const fromGlobal = (globalThis as unknown as Record<string, unknown>)[name];
    if (isRawKV(fromGlobal)) return { name, kv: fromGlobal };
    const fromEnv = (process.env as unknown as Record<string, unknown>)[name];
    if (isRawKV(fromEnv)) return { name, kv: fromEnv };
  }
  return null;
}

function isRawKV(value: unknown): value is RawKV {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.get === "function" &&
    typeof candidate.put === "function" &&
    typeof candidate.delete === "function"
  );
}

export class EdgeOneKVAdapter implements KVAdapter {
  private binding: RawKV;

  constructor() {
    const found = findBinding();
    if (!found) {
      throw new Error(
        "未找到 EdgeOne KV 绑定。请在 EdgeOne Pages 控制台的「KV 存储」中创建命名空间，并绑定为环境变量 VOCAB_KV；本地开发请设置 STORAGE_DRIVER=file。",
      );
    }
    this.binding = found.kv;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.binding.get(key);
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }
    return raw as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await this.binding.put(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.binding.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    const result = await this.binding.list({ prefix });
    if (Array.isArray(result)) return result as string[];
    const shaped = result as { keys?: Array<string | { name: string }> };
    const keys = shaped?.keys ?? [];
    return keys.map((item) => (typeof item === "string" ? item : item.name));
  }
}