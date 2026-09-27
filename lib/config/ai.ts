/**
 * 大模型配置（存 KV，管理端可改）
 *
 * 优先级：KV 配置 > 环境变量 > 空
 * 这样部署时用环境变量给默认值，管理端可随时覆盖而无需重新部署。
 *
 * 安全：对外返回时必须脱敏 apiKey（见 maskAiConfig）。
 */

import { getKV } from "../storage";

const AI_CONFIG_KEY = "config:ai";

export interface AiConfig {
  /** OpenAI 兼容接口的 base url，如 https://api.openai.com/v1 */
  baseUrl: string;
  /** 密钥 */
  apiKey: string;
  /** 模型名 */
  model: string;
  /** 采样温度 */
  temperature: number;
  /** 单次最大 token */
  maxTokens: number;
  /** 是否启用 */
  enabled: boolean;
  updatedAt: string;
}

function envDefaults(): AiConfig {
  return {
    baseUrl: process.env.AI_BASE_URL || "",
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "",
    temperature: 0.7,
    maxTokens: 900,
    enabled: true,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getAiConfig(): Promise<AiConfig> {
  const base = envDefaults();
  try {
    const stored = await getKV().get<Partial<AiConfig>>(AI_CONFIG_KEY);
    if (!stored) return base;
    const merged: AiConfig = { ...base, ...stored };
    // 空字符串不应覆盖环境变量（管理端留空 = 用环境变量）
    if (!stored.baseUrl) merged.baseUrl = base.baseUrl;
    if (!stored.apiKey) merged.apiKey = base.apiKey;
    if (!stored.model) merged.model = base.model;
    return merged;
  } catch {
    return base;
  }
}

export async function saveAiConfig(patch: Partial<AiConfig>): Promise<AiConfig> {
  const current = await getAiConfig();
  const next: AiConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await getKV().put(AI_CONFIG_KEY, next);
  return next;
}

/** 判断是否具备调用 AI 的最低配置 */
export function isAiReady(config: AiConfig): boolean {
  return Boolean(config.enabled && config.baseUrl && config.apiKey && config.model);
}

/** 脱敏：只保留尾部 4 位，用于返回给前端展示 */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export interface SafeAiConfig extends Omit<AiConfig, "apiKey"> {
  apiKeyMasked: string;
  hasApiKey: boolean;
  /** 该字段是否来自环境变量（管理端未覆盖） */
  fromEnv: boolean;
}

export function maskAiConfig(config: AiConfig): SafeAiConfig {
  const { apiKey, ...rest } = config;
  const envKey = process.env.AI_API_KEY || "";
  return {
    ...rest,
    apiKeyMasked: maskKey(apiKey),
    hasApiKey: Boolean(apiKey),
    fromEnv: Boolean(envKey) && apiKey === envKey,
  };
}
