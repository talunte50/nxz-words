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