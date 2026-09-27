import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { appendLog } from "@/lib/admin/logs";
import { errorMessage, fail, ok } from "@/lib/api";
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminSetRole,
  countAdmins,
  listUsers,
} from "@/lib/store/user-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const users = await listUsers();
  return ok({ users });
}

/** 新建用户 / 重置密码 / 改角色 / 删除 —— 统一用 POST + action 分发 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    uid?: string;
    username?: string;
    password?: string;
    role?: "admin" | "user";
  } | null;
  if (!body?.action) return fail("缺少 action");

  const actor = guard.context.data.profile.username;

  try {
    switch (body.action) {
      case "create": {
        const username = (body.username ?? "").trim();
        const password = body.password ?? "";
        if (username.length < 2) return fail("用户名至少 2 个字符");
        if (password.length < 6) return fail("密码至少 6 个字符");
        const data = await adminCreateUser(username, password, body.role === "admin" ? "admin" : "user");
        await appendLog({ actor, action: "新建用户", target: username });
        return ok({ uid: data.profile.id, username: data.profile.username });
      }
      case "resetPassword": {
        if (!body.uid) return fail("缺少 uid");
        if (!body.password || body.password.length < 6) return fail("密码至少 6 个字符");
        await adminResetPassword(body.uid, body.password);
        await appendLog({ actor, action: "重置密码", target: body.uid });
        return ok({ ok: true });
      }
      case "setRole": {
        if (!body.uid || !body.role) return fail("缺少参数");
        if (body.role === "user" && (await countAdmins()) <= 1) {
          return fail("至少保留一名管理员");
        }
        await adminSetRole(body.uid, body.role);
        await appendLog({ actor, action: "调整角色", target: `${body.uid} → ${body.role}` });
        return ok({ ok: true });
      }
      case "delete": {
        if (!body.uid) return fail("缺少 uid");
        if (body.uid === guard.context.data.profile.id) return fail("不能删除当前登录账号");
        const target = (await listUsers()).find((u) => u.uid === body.uid);
        if (target?.role === "admin" && (await countAdmins()) <= 1) {
          return fail("至少保留一名管理员");
        }
        await adminDeleteUser(body.uid);
        await appendLog({ actor, action: "删除用户", target: target?.username ?? body.uid, level: "warn" });
        return ok({ ok: true });
      }
      default:
        return fail(`未知 action: ${body.action}`);
    }
  } catch (error) {
    return fail(errorMessage(error, "操作失败"), 500);
  }
}
