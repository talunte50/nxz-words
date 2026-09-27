import type { NextRequest } from "next/server";
import { currentUser, fail } from "@/lib/api";
import { chatStream, isAiConfigured } from "@/lib/ai/client";
import { MOCK_TUTOR_REPLY, tutorSystemPrompt } from "@/lib/ai/prompts";
import { getUserData, saveUserData } from "@/lib/store/user-store";
import type { ChatMessage, ChatSession } from "@/lib/types";
import { uid } from "@/lib/utils";
import { getWordBook } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const body = (await request.json().catch(() => null)) as
    | { messages?: ChatMessage[]; sessionId?: string; words?: string[] }
    | null;

  const incoming = Array.isArray(body?.messages) ? body!.messages : [];
  const sessionId = String(body?.sessionId ?? "") || uid("chat");
  const focusWords = Array.isArray(body?.words) ? body!.words.map(String).slice(0, 8) : [];
  const userMessage = incoming.filter((message) => message.role === "user").pop();

  if (!userMessage?.content) return fail("缺少用户消息");

  const { data } = context;
  const level = (await getWordBook(data.profile.currentBookId))?.level ?? "CET4";
  const system = tutorSystemPrompt(data.profile.aiTone, level, focusWords);
  const history = incoming
    .filter((message) => message.role !== "system")
    .slice(-12);

  let session = data.sessions.find((item) => item.id === sessionId);
  if (!session) {
    session = {
      id: sessionId,
      title: userMessage.content.slice(0, 24),
      createdAt: new Date().toISOString(),
      messages: [],
    } as ChatSession;
    data.sessions.unshift(session);
  }
  session.messages.push(userMessage);
  if (data.sessions.length > 20) data.sessions = data.sessions.slice(0, 20);
  await saveUserData(data);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      let full = "";
      try {
        if (!(await isAiConfigured())) {
          full = MOCK_TUTOR_REPLY;
          for (const char of Array.from(full)) {
            send({ delta: char });
            await new Promise((resolve) => setTimeout(resolve, 14));
          }
        } else {
          for await (const delta of chatStream({
            messages: [{ role: "system", content: system }, ...history],
            temperature: 0.8,
            maxTokens: 700,
          })) {
            full += delta;
            send({ delta });
          }
        }

        const latest = await getUserData(data.profile.id);
        const target = latest?.sessions.find((item) => item.id === sessionId);
        if (latest && target) {
          target.messages.push({ role: "assistant", content: full });
          await saveUserData(latest);
        }

        send({ done: true, sessionId });
      } catch {
        send({ error: "AI 调用失败，请检查模型配置" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}