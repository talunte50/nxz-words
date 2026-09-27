import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { saveUserData } from "@/lib/store/user-store";
import type { UserProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);
  return ok({ profile: context.data.profile });
}

export async function PATCH(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const body = (await request.json().catch(() => null)) as Partial<UserProfile> | null;
  if (!body) return fail("请求体不合法");

  const { data } = context;
  const profile = data.profile;

  if (typeof body.nickname === "string" && body.nickname.trim()) {
    profile.nickname = body.nickname.trim().slice(0, 24);
  }
  if (typeof body.avatar === "string") {
    profile.avatar = body.avatar.slice(0, 200);
  }
  if (typeof body.currentBookId === "string" && body.currentBookId) {
    profile.currentBookId = body.currentBookId;
  }
  if (typeof body.dailyGoal === "number") {
    profile.dailyGoal = Math.max(5, Math.min(200, Math.round(body.dailyGoal)));
  }
  if (typeof body.reminderTime === "string" && /^\d{2}:\d{2}$/.test(body.reminderTime)) {
    profile.reminderTime = body.reminderTime;
  }
  if (body.aiTone === "encouraging" || body.aiTone === "strict" || body.aiTone === "humorous") {
    profile.aiTone = body.aiTone;
  }
  if (body.theme === "light" || body.theme === "dark") {
    profile.theme = body.theme;
  }

  await saveUserData(data);
  return ok({ profile });
}