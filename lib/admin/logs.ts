/**
 * 操作日志（存 KV，保留最近 N 条）
 *
 * 记录管理端的写操作：谁、何时、做了什么、结果如何。
 * KV 是扁平 key-value，这里用「单 key 存数组 + 截断」实现，
 * 避免 list() 前缀扫描带来的性能与分页复杂度。
 */

import { getKV } from "../storage";

const LOG_KEY = "admin:logs";
const MAX_LOGS = 300;
const KEEP_LOGS = 200;

export type LogLevel = "info" | "warn" | "error";

export interface OperationLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  level: LogLevel;
}

export async function listLogs(): Promise<OperationLog[]> {
  try {
    const logs = await getKV().get<OperationLog[]>(LOG_KEY);
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

export async function appendLog(input: {
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  level?: LogLevel;
}): Promise<void> {
  try {
    const logs = await listLogs();
    logs.unshift({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      detail: input.detail,
      level: input.level ?? "info",
    });
    const trimmed = logs.length > MAX_LOGS ? logs.slice(0, KEEP_LOGS) : logs;
    await getKV().put(LOG_KEY, trimmed);
  } catch {
    // 日志失败不影响主流程
  }
}

export async function clearLogs(): Promise<void> {
  await getKV().put(LOG_KEY, []);
}
