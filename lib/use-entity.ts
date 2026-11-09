"use client";

import { useEffect, useState } from "react";

import { API_URL, apiFetch } from "@/lib/api";
import { useDemoStore } from "@/lib/demo-store";

// Owned by the store, which loads them from the signed-in user's server
// workspace and keeps them current after every action — a one-off fetch
// here would go stale the moment the user connects an account or buys credits.
const STORE_OWNED_KEYS = new Set(["accounts", "gigs", "user-monetization", "billing-history"]);

/**
 * useEntity — resolves data in this priority order:
 *   1. Live FastAPI backend, when NEXT_PUBLIC_API_URL is set and reachable.
 *   2. The client-side demo store (always available — keeps the app fully
 *      dynamic on a static Vercel deploy with no backend, and also as the
 *      fallback when the backend can't be reached).
 *   3. The built-in mock `fallback`.
 *
 * Pass `pollMs` to keep the backend view live during a demo.
 */
export function useEntity<T>(key: string, fallback: T, pollMs?: number): T {
  const demo = useDemoStore();
  // null = backend hasn't answered yet. Using a sentinel instead of comparing
  // `data === fallback` — that broke when callers pass a fresh object literal
  // each render (reference is never equal), freezing the entity at the
  // mount-time value forever.
  const [live, setLive] = useState<T | null>(null);
  const demoData = demo ? demo.get<T>(key, fallback) : fallback;

  const fromStore = Boolean(demo) && STORE_OWNED_KEYS.has(key);

  useEffect(() => {
    if (!API_URL || fromStore) return;
    let cancelled = false;

    const load = () =>
      apiFetch(`/api/${key}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((json) => {
          if (!cancelled) setLive(json as T);
        })
        .catch(() => {});

    load();
    const timer = pollMs && pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [key, pollMs, fromStore]);

  // Backend connected and answering → live server data. Otherwise the
  // client-side demo store (reactive — updates as cycles run).
  return fromStore ? demoData : live ?? demoData;
}

/**
 * useEntityQuery — same resolution as useEntity but returns { data, refresh }.
 * In client-side demo mode the data updates reactively, so `refresh` is a no-op.
 */
export function useEntityQuery<T>(
  key: string,
  fallback: T,
  pollMs?: number
): { data: T; refresh: () => void } {
  const demo = useDemoStore();
  const [live, setLive] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  const demoData = demo ? demo.get<T>(key, fallback) : fallback;

  const fromStore = Boolean(demo) && STORE_OWNED_KEYS.has(key);

  useEffect(() => {
    if (!API_URL || fromStore) return;
    let cancelled = false;

    const load = () =>
      apiFetch(`/api/${key}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((json) => {
          if (!cancelled) setLive(json as T);
        })
        .catch(() => {});

    load();
    const timer = pollMs && pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [key, tick, pollMs, fromStore]);

  return {
    data: fromStore ? demoData : live ?? demoData,
    refresh: () => setTick((t) => t + 1),
  };
}
