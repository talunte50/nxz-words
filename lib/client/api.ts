export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `请求失败 (${res.status})`);
  }
  return json.data as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `请求失败 (${res.status})`);
  }
  return json.data as T;
}
export interface GeneratedExample {
  wordId: string;
  en: string;
  zh: string;
  cached: boolean;
}

export async function fetchExample(wordId: string): Promise<GeneratedExample> {
  return apiSend<GeneratedExample>("/api/ai/example", "POST", { wordId });
}