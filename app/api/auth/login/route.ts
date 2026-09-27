import type { NextRequest } from "next/server";
import { errorMessage, fail, ok } from "@/lib/api";
import { buildSession, setSession } from "@/lib/auth/session";
import { getSiteConfig } from "@/lib/config/site";
import { ensurePresetAdmin, loginOrRegister, listUsers } from "@/lib/store/user-store";

export const dynamic = "force-dynamic";

// 预置管理员账号尚未创建时自动建账（幂等）；未配置 ADMIN_USERNAME/ADMIN_PASSWORD 时为空操作
async function bootAdmin(): Promise<void> {
  try {
    await ensurePresetAdmin();
  } catch {
    // 存储暂不可用不阻塞登录
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (username.length < 3) return fail("用户名至少 3 个字符");
  if (password.length < 6) return fail("密码至少 6 位");

  // 幂等确保预设管理员账号存在：无论谁先登录，admin 都先于首个普通用户创建，
  // 从而避免第一个普通用户被误判为 admin（countUsers()===0 → isFirst）。
  await bootAdmin();

  try {
    // 关闭注册时，只允许已存在的账号登录（管理员可在后台开启注册）
    const config = await getSiteConfig();
    if (!config.allowRegister) {
      const exists = (await listUsers()).some(
        (u) => u.username.toLowerCase() === username.toLowerCase(),
      );
      if (!exists) return fail("本站暂未开放注册，请联系管理员开通账号", 403);
    }

    const data = await loginOrRegister(username, password);
    await setSession(buildSession(data.profile.id, data.profile.username));
    return ok({ profile: data.profile });
  } catch (error) {
    return fail(errorMessage(error, "登录失败"));
  }
}