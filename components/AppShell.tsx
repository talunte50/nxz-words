"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { UserProfile } from "@/lib/types";
import { apiGet, apiSend } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface MeResponse {
  profile: UserProfile;
  learned: number;
  mastered: number;
  dueCount: number;
  favorites: number;
}

export interface UserContextValue {
  profile: UserProfile | null;
  learned: number;
  mastered: number;
  dueCount: number;
  favorites: number;
  ready: boolean;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser 必须在 AppShell 内使用");
  return ctx;
}

const TABS = [
  { href: "/", label: "首页", icon: "🏠" },
  { href: "/learn", label: "学习", icon: "🎯" },
  { href: "/wordbooks", label: "词书", icon: "📚" },
  { href: "/chat", label: "对话", icon: "💬" },
  { href: "/profile", label: "我的", icon: "👤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<Omit<UserContextValue, "refresh" | "updateProfile" | "logout">>({
    profile: null,
    learned: 0,
    mastered: 0,
    dueCount: 0,
    favorites: 0,
    ready: false,
  });

  const refresh = useCallback(async () => {
    try {
      const me = await apiGet<MeResponse>("/api/auth/me");
      setState({ ...me, ready: true });
    } catch {
      setState((prev) => ({ ...prev, profile: null, ready: true }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const theme = state.profile?.theme ?? "light";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
  }, [state.profile?.theme]);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    const res = await apiSend<{ profile: UserProfile }>("/api/profile", "PATCH", patch);
    setState((prev) => ({ ...prev, profile: res.profile }));
  }, []);

  const logout = useCallback(async () => {
    await apiSend("/api/auth/logout", "POST", {});
    setState((prev) => ({ ...prev, profile: null }));
    router.push("/login");
  }, [router]);

  const isAuthPage = pathname === "/login";

  return (
    <UserContext.Provider value={{ ...state, refresh, updateProfile, logout }}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
          <div className="flex items-center justify-between px-4 pb-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-sm font-bold text-white">
                W
              </span>
              <span className="text-base font-semibold tracking-tight">WordLeap 词跃</span>
            </Link>
            {state.profile ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm touch-target dark:bg-slate-800"
              >
                <span>{state.profile.avatar || "🙂"}</span>
                <span className="max-w-[8rem] truncate">{state.profile.nickname}</span>
                {state.dueCount > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-medium text-white">
                    {state.dueCount}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white touch-target"
              >
                登录 / 注册
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4">{children}</main>

        {!isAuthPage ? (
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="mx-auto flex max-w-3xl items-stretch">
              {TABS.map((tab) => {
                const active =
                  tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "flex flex-1 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-xs transition",
                      active ? "text-brand-600" : "text-slate-400 dark:text-slate-500",
                    )}
                  >
                    <span className={cn("text-lg", active && "scale-110")}>{tab.icon}</span>
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </UserContext.Provider>
  );
}