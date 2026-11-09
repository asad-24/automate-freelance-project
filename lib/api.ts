/**
 * API client for the Autopilot backend (FastAPI).
 *
 * Connection model:
 *  - Set NEXT_PUBLIC_API_URL (e.g. http://localhost:8000) to connect the
 *    frontend to the running backend.
 *  - Unset, the app runs as a frontend-only demo on built-in mock data.
 *  - Set, real accounts never see mock data: a failed request leaves the
 *    page empty and the dashboard shows a "can't reach the server" banner
 *    (every request reports its outcome as an "api:status" event).
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const TOKEN_KEY = "auth-token";

// Long enough for a free-plan backend to wake from sleep (about a minute on
// Render), short enough that a dead connection can't hang the UI forever.
const TIMEOUT_MS = 75_000;

/** fetch() with a hard timeout; an existing `signal` in `init` takes priority. */
export async function fetchWithTimeout(input: string, init: RequestInit = {}, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Session token issued by /api/auth/login or /api/auth/signup. */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked — the session just won't survive a reload */
  }
}

/**
 * fetch() against the backend with the session token attached. A 401 on a
 * request that carried a token means the session expired or was revoked —
 * AuthProvider listens for "auth:expired" and signs the user out.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    reportServer(false);
    throw err;
  }
  reportServer(res.status < 500);
  if (res.status === 401 && token && typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:expired"));
  }
  return res;
}

function reportServer(ok: boolean) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("api:status", { detail: { ok } }));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** Server-side entity fetch (for server components). Falls back to mock. */
export async function getEntity<T>(key: string, fallback: T): Promise<T> {
  if (!API_URL) return fallback;
  try {
    return await request<T>(`/api/${key}`, { cache: "no-store" });
  } catch {
    return fallback;
  }
}

/**
 * POST (or PATCH) that distinguishes results: null = backend unreachable/unset
 * (frontend-only demo); otherwise {status, data} — so callers can react to
 * 401/409 etc. and show the server's `detail` message.
 */
export async function apiCall<T = unknown>(
  path: string,
  body?: unknown,
  method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST"
): Promise<{ status: number; data: T } | null> {
  if (!API_URL) return null;
  try {
    const res = await apiFetch(path, { method, body: JSON.stringify(body ?? {}) });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return null;
  }
}

/** Client-side GET. Returns null when the backend is unset/unreachable. */
export async function apiGet<T = unknown>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fire-and-forget POST for action buttons. Never throws — UI stays mock-driven. */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T | null> {
  if (!API_URL) return null;
  try {
    return await request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  } catch {
    return null;
  }
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T | null> {
  if (!API_URL) return null;
  try {
    return await request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  } catch {
    return null;
  }
}
