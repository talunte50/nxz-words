import { FileKVAdapter } from "./file-store";
import { EdgeOneKVAdapter } from "./edgeone-kv";
import type { KVAdapter } from "./types";

let instance: KVAdapter | null = null;

export function getKV(): KVAdapter {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "file";
  instance = driver === "edgeone-kv" ? new EdgeOneKVAdapter() : new FileKVAdapter();
  return instance;
}

export type { KVAdapter } from "./types";
export { FileKVAdapter } from "./file-store";
export { EdgeOneKVAdapter } from "./edgeone-kv";