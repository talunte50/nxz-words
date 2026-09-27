/**
 * 管理端守卫与通用响应
 *
 * 用法：
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 *   const { data } = guard;
 */

import { currentUser, fail, type AuthContext } from "../api";

export type AdminGuard =
  | { ok: true; context: AuthContext }
  | { ok: false; response: ReturnType<typeof fail> };

export async function requireAdmin(): Promise<AdminGuard> {
  const context = await currentUser();
  if (!context) return { ok: false, response: fail("未登录", 401) };
  if (context.data.profile.role !== "admin") {
    return { ok: false, response: fail("需要管理员权限", 403) };
  }
  return { ok: true, context };
}
