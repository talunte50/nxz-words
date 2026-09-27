import { NextResponse } from "next/server";
import { getSession } from "./auth/session";
import { getUserData } from "./store/user-store";
import type { SessionPayload, UserData } from "./types";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export interface AuthContext {
  session: SessionPayload;
  data: UserData;
}

export async function currentUser(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const data = await getUserData(session.uid);
  if (!data) return null;
  return { session, data };
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}