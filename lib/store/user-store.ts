import { hashPassword, verifyPassword } from "../auth/session";
import { getKV } from "../storage";
import type { UserData, UserProfile } from "../types";
import { uid } from "../utils";

const AUTH_PREFIX = "auth:";
const USER_PREFIX = "user:";

interface AuthRecord {
  uid: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

function authKey(username: string): string {
  return `${AUTH_PREFIX}${username.trim().toLowerCase()}`;
}

function userKey(id: string): string {
  return `${USER_PREFIX}${id}`;
}

// 统计当前已存在的账号数量（决定是否首个账号）
async function countUsers(): Promise<number> {
  const keys = await getKV().list(AUTH_PREFIX);
  return keys.length;
}

function profileRole(username: string, isFirst: boolean): "admin" | "user" {
  // 预置管理员账号名 → admin
  const preset = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (preset && username.trim().toLowerCase() === preset) return "admin";
  // 系统中第一个注册的账号 → admin
  if (isFirst) return "admin";
  return "user";
}

function createProfile(id: string, username: string, role: "admin" | "user" = "user"): UserProfile {
  return {
    id,
    username,
    nickname: username,
    avatar: "",
    role,
    createdAt: new Date().toISOString(),
    currentBookId: "cet4",
    dailyGoal: 20,
    reminderTime: "20:00",
    aiTone: "encouraging",
    theme: "light",
  };
}

export function createDefaultUserData(profile: UserProfile): UserData {
  return {
    profile,
    reviews: {},
    favorites: [],
    stats: [],
    sessions: [],
  };
}

export async function getUserData(userId: string): Promise<UserData | null> {
  return getKV().get<UserData>(userKey(userId));
}

export async function saveUserData(data: UserData): Promise<void> {
  await getKV().put(userKey(data.profile.id), data);
}

export async function registerUser(username: string, password: string): Promise<UserData> {
  const kv = getKV();
  const key = authKey(username);
  const existing = await kv.get<AuthRecord>(key);
  if (existing) throw new Error("该用户名已被注册");
  const isFirst = (await countUsers()) === 0;
  const id = uid("u");
  const record: AuthRecord = {
    uid: id,
    username: username.trim(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await kv.put(key, record);
  const role = profileRole(username, isFirst);
  const data = createDefaultUserData(createProfile(id, record.username, role));
  await saveUserData(data);
  return data;
}

export async function loginOrRegister(username: string, password: string): Promise<UserData> {
  const kv = getKV();
  const record = await kv.get<AuthRecord>(authKey(username));
  if (!record) return registerUser(username, password);
  const ok = await verifyPassword(password, record.passwordHash);
  if (!ok) throw new Error("密码错误");
  const data = await getUserData(record.uid);
  if (!data) throw new Error("用户数据缺失，请联系管理员");
  return data;
}

/**
 * 环境变量预设管理员：若配置了 ADMIN_USERNAME / ADMIN_PASSWORD 且该账号尚不存在，
 * 则自动创建一个 admin 账号（幂等，已存在则跳过）。服务启动时由调用方触发。
 */
export async function ensurePresetAdmin(): Promise<void> {
  const username = (process.env.ADMIN_USERNAME || "").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!username || !password) return;

  const kv = getKV();
  const key = authKey(username);
  if (await kv.get<AuthRecord>(key)) return;

  const id = uid("u");
  const record: AuthRecord = {
    uid: id,
    username: username.trim(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await kv.put(key, record);
  const data = createDefaultUserData(createProfile(id, record.username, "admin"));
  await saveUserData(data);
}

/** 判断指定 uid 当前是否为管理员（供 /api/profile 与路由守卫使用） */
export function isAdminRole(data: UserData): boolean {
  return data.profile.role === "admin";
}

/* ------------------------- 管理端：用户管理 ------------------------- */

export interface AdminUserRow {
  uid: string;
  username: string;
  nickname: string;
  role: "admin" | "user";
  createdAt: string;
  lastActive: string | null;
  learned: number;
  favorites: number;
  studiedDays: number;
}

/** 列出账号（含基础学习统计）。数据量小，直接聚合即可。 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const kv = getKV();
  const keys = await kv.list(AUTH_PREFIX);
  const rows: AdminUserRow[] = [];
  for (const key of keys) {
    const record = await kv.get<AuthRecord>(key);
    if (!record) continue;
    const data = await getUserData(record.uid);
    const learned = data ? Object.values(data.reviews).filter((r) => r.reps > 0).length : 0;
    const studiedDays = data ? data.stats.filter((s) => s.newCount + s.reviewCount > 0).length : 0;
    const lastReview = data
      ? Object.values(data.reviews)
          .map((r) => r.lastReview)
          .filter((v): v is string => Boolean(v))
          .sort()
          .pop()
      : undefined;
    rows.push({
      uid: record.uid,
      username: record.username,
      nickname: data?.profile.nickname ?? record.username,
      role: data?.profile.role ?? "user",
      createdAt: record.createdAt,
      lastActive: lastReview ?? null,
      learned,
      favorites: data?.favorites.length ?? 0,
      studiedDays,
    });
  }
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows;
}

export async function findAuthByUid(uid: string): Promise<(AuthRecord & { key: string }) | null> {
  const kv = getKV();
  const keys = await kv.list(AUTH_PREFIX);
  for (const key of keys) {
    const record = await kv.get<AuthRecord>(key);
    if (record?.uid === uid) return { ...record, key };
  }
  return null;
}

export async function adminResetPassword(uid: string, password: string): Promise<void> {
  const kv = getKV();
  const found = await findAuthByUid(uid);
  if (!found) throw new Error("账号不存在");
  const record: AuthRecord = {
    uid: found.uid,
    username: found.username,
    passwordHash: await hashPassword(password),
    createdAt: found.createdAt,
  };
  await kv.put(found.key, record);
}

export async function adminDeleteUser(uid: string): Promise<void> {
  const kv = getKV();
  const found = await findAuthByUid(uid);
  if (!found) throw new Error("账号不存在");
  await kv.delete(found.key);
  await kv.delete(userKey(uid));
}

export async function adminCreateUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user",
): Promise<UserData> {
  const data = await registerUser(username, password);
  if (role === "admin" && data.profile.role !== "admin") {
    data.profile.role = "admin";
    await saveUserData(data);
  }
  return data;
}

export async function adminSetRole(uid: string, role: "admin" | "user"): Promise<void> {
  const data = await getUserData(uid);
  if (!data) throw new Error("用户数据不存在");
  data.profile.role = role;
  await saveUserData(data);
}

/** 管理员总数，用于阻止「删掉最后一个管理员」 */
export async function countAdmins(): Promise<number> {
  const rows = await listUsers();
  return rows.filter((r) => r.role === "admin").length;
}