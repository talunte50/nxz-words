import type { NextRequest } from "next/server";
import { appendLog } from "@/lib/admin/logs";
import { requireAdmin } from "@/lib/admin/guard";
import { fail, ok } from "@/lib/api";
import { getAiConfig, isAiReady } from "@/lib/config/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 大模型连通性测试。
 * 用当前生效配置发一条最小请求，返回延迟与模型响应片段。
 * 支持临时传参（保存前先试），未传则用已保存配置。
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  } | null;

  const saved = await getAiConfig();
  const config = {
    baseUrl: body?.baseUrl?.trim() || saved.baseUrl,
    apiKey: body?.apiKey?.trim() || saved.apiKey,
    model: body?.model?.trim() || saved.model,
  };

  if (!isAiReady({ ...saved, ...config })) {
    return fail("配置不完整：请先填写接口地址、密钥与模型名", 400);
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const started = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: "你是连通性测试助手，只需回复 OK。" },
          { role: "user", content: "请回复 OK" },
        ],
        temperature: 0,
        max_tokens: 16,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latency = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      await appendLog({
        actor: guard.context.data.profile.username,
        action: "测试大模型连接",
        detail: `HTTP ${res.status}`,
        level: "error",
      });
      return ok({
        success: false,
        status: res.status,
        latency,
        model: config.model,
        message: `接口返回 ${res.status}`,
        raw: text.slice(0, 500),
      });
    }

    let reply = "";
    try {
      const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
      reply = data.choices?.[0]?.message?.content ?? "";
    } catch {
      reply = text.slice(0, 200);
    }

    await appendLog({
      actor: guard.context.data.profile.username,
      action: "测试大模型连接",
      detail: `${config.model} · ${latency}ms`,
    });

    return ok({
      success: true,
      status: res.status,
      latency,
      model: config.model,
      reply: reply.trim().slice(0, 200),
      message: "连接成功",
    });
  } catch (error) {
    const latency = Date.now() - started;
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "请求超时（30s），请检查接口地址或网络"
          : error.message
        : "未知错误";
    await appendLog({
      actor: guard.context.data.profile.username,
      action: "测试大模型连接",
      detail: message,
      level: "error",
    });
    return ok({ success: false, latency, model: config.model, message });
  }
}
