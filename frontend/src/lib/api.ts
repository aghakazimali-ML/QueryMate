import type { AppConfig, HistoryEntry, LLMSettings, QueryResult, Source } from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

/** A random id per browser, so uploads and history stay private to this visitor. */
function sessionId(): string {
  const key = "querymate.session";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "anonymous-session";
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, apiKey?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-Session-Id", sessionId());
  if (apiKey) headers.set("X-API-Key", apiKey);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the QueryMate API. Is the backend running?", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : (body.detail?.[0]?.msg ?? detail);
    } catch {
      /* not JSON */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.headers.get("content-type")?.includes("json") ? res.json() : ((await res.text()) as T);
}

const llmBody = (s: LLMSettings) => ({ provider: s.provider, model: s.model, temperature: s.temperature });

export const api = {
  config: () => request<AppConfig>("/api/config"),
  source: (id: string) => request<Source>(`/api/sources/${encodeURIComponent(id)}`),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<Source>("/api/sources/upload", { method: "POST", body: form });
  },
  connect: (url: string) => request<Source>("/api/sources/connect", { method: "POST", body: JSON.stringify({ url }) }),
  query: (question: string, sourceId: string, history: { question: string; sql: string }[], s: LLMSettings) =>
    request<QueryResult>(
      "/api/query",
      { method: "POST", body: JSON.stringify({ question, source_id: sourceId, history, ...llmBody(s) }) },
      s.apiKey,
    ),
  explain: (question: string, sql: string, s: LLMSettings) =>
    request<{ explanation: string }>(
      "/api/explain",
      { method: "POST", body: JSON.stringify({ question, sql, ...llmBody(s) }) },
      s.apiKey,
    ),
  history: () => request<HistoryEntry[]>("/api/history"),
  historyCsv: () => request<string>("/api/history.csv"),
  clearHistory: () => request<void>("/api/history", { method: "DELETE" }),
};
