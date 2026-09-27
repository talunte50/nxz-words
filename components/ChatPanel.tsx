"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import type { ChatMessage, ChatSession } from "@/lib/types";
import { cn } from "@/lib/utils";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi! I'm your English speaking partner. 用英文随便聊几句吧，我会帮你纠正～",
};

interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  messageCount: number;
  preview: string;
}

export function ChatPanel({ words = [] }: { words?: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await apiGet<{ sessions: SessionSummary[] }>("/api/chat-sessions");
      setSessions(res.sessions);
    } catch {
      /* 忽略：未登录或加载失败不阻塞对话 */
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  async function openSession(id: string) {
    try {
      const res = await apiGet<{ session: ChatSession }>(`/api/chat-sessions?id=${id}`);
      const msgs = res.session.messages;
      setMessages(msgs.length ? msgs : [GREETING]);
      setSessionId(id);
      setActiveSessionId(id);
      setShowHistory(false);
    } catch {
      /* 忽略 */
    }
  }

  async function deleteSession(id: string) {
    try {
      await apiSend(`/api/chat-sessions?id=${id}`, "DELETE");
    } catch {
      /* 忽略 */
    }
    if (id === activeSessionId || id === sessionId) {
      reset();
    }
    void loadSessions();
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    setInput("");
    const history = [...messages, { role: "user", content } as ChatMessage];
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: history, sessionId, words }),
      });
      if (!res.ok || !res.body) throw new Error("对话请求失败");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          let payload: { delta?: string; done?: boolean; sessionId?: string; error?: string };
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (payload.sessionId && !sessionId) {
            setSessionId(payload.sessionId);
            setActiveSessionId(payload.sessionId);
          }
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) {
            acc += payload.delta;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "assistant", content: acc };
              return copy;
            });
          }
        }
      }
      void loadSessions();
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "对话失败"}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function reset() {
    setMessages([GREETING]);
    setSessionId(null);
    setActiveSessionId(null);
  }

  return (
    <Card className="flex h-[68vh] max-h-[560px] flex-col p-0 sm:h-[62vh]">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-base">🤖</span>
          <div>
            <p className="text-sm font-medium">AI 口语陪练</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {words.length ? `重点词：${words.slice(0, 4).join(", ")}` : "自由对话"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className={cn(
              "grid h-10 min-w-10 place-items-center rounded-lg px-2 text-xs",
              showHistory ? "bg-brand-50 text-brand-600" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
            )}
          >
            历史
          </button>
          <button
            type="button"
            onClick={reset}
            className="grid h-10 min-w-10 place-items-center rounded-lg px-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            新对话
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60">
          <div className="max-h-56 overflow-y-auto px-2 py-2">
            {!sessions.length ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">暂无历史会话</p>
            ) : (
              <ul className="space-y-1">
                {sessions.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition",
                      item.id === activeSessionId ? "bg-brand-50" : "hover:bg-slate-100 dark:hover:bg-slate-700",
                    )}
                    onClick={() => void openSession(item.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {item.title || "未命名会话"}
                      </p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {item.messageCount} 条 · {item.preview || "（空）"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteSession(item.id);
                      }}
                      className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-xs text-slate-400 dark:text-slate-500 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
                      aria-label="删除会话"
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <div ref={scroller} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
              )}
            >
              {message.content || (streaming ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-slate-100 dark:border-slate-700 p-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="输入英文或中文，Enter 发送"
          className="max-h-24 flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />
        <Button disabled={streaming} onClick={() => void send(input)}>
          {streaming ? "…" : "发送"}
        </Button>
      </div>
    </Card>
  );
}
