import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { saveUserData } from "@/lib/store/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  // 指定 id 时返回该会话的完整消息（供前端加载历史会话继续对话）
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const session = context.data.sessions.find((item) => item.id === id);
    if (!session) return fail("会话不存在", 404);
    return ok({ session });
  }

  const sessions = context.data.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    messageCount: session.messages.length,
    preview: session.messages.slice(-1)[0]?.content?.slice(0, 60) ?? "",
  }));
  return ok({ sessions });
}

export async function DELETE(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("缺少会话 id");

  const { data } = context;
  data.sessions = data.sessions.filter((session) => session.id !== id);
  await saveUserData(data);
  return ok({ deleted: id });
}