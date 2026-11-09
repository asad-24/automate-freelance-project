"use client";
import * as React from "react";

import { API_URL, apiFetch, getAuthToken, setAuthToken } from "@/lib/api";

export type Role = "admin" | "freelancer" | "client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  company?: string;
  /** Platform owner (OWNER_EMAILS on the backend). */
  owner?: boolean;
};

// Neutral per-role defaults — real signups override these with the values the
// user typed into the form, so no canned "test user" ever appears.
const DEFAULT_USERS: Record<Role, SessionUser> = {
  admin: {
    id: "u-owner",
    name: "Agency Owner",
    email: "owner@youragency.com",
    role: "admin",
    company: "My Agency",
  },
  freelancer: {
    id: "u-freelancer",
    name: "Freelancer",
    email: "me@work.io",
    role: "freelancer",
  },
  client: {
    id: "u-client",
    name: "Client",
    email: "me@company.com",
    role: "client",
    company: "My Company",
  },
};

type AuthContextValue = {
  user: SessionUser | null;
  bypass: boolean;
  /** Frontend-only demo (no backend, or the dev bypass) — local sessions and
   *  the role switcher only exist here. */
  demoMode: boolean;
  /** True once the stored session has been checked — guards can trust `user`. */
  restored: boolean;
  login: (role: Role, overrides?: Partial<SessionUser>, token?: string) => void;
  logout: () => void;
  setRole: (role: Role) => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

// DEV auth bypass: an always-signed-in admin so every page is reachable
// without a backend. Off unless NEXT_PUBLIC_DEV_BYPASS_AUTH=true.
const DEV_BYPASS_AUTH = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

export const DEMO_MODE = DEV_BYPASS_AUTH || !API_URL;

// LAUNCH signup wall: when enabled, unauthenticated visitors get pushed to
// /signup instead of /login — flip NEXT_PUBLIC_SIGNUP_WALL=true at launch.
export const SIGNUP_WALL = process.env.NEXT_PUBLIC_SIGNUP_WALL === "true";

function storeSessionUser(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem("mock-role", user.role);
    localStorage.setItem("session-user", JSON.stringify(user));
  } else {
    localStorage.removeItem("mock-role");
    localStorage.removeItem("session-user");
  }
}

function readSessionUser(): SessionUser | null {
  const raw = typeof window !== "undefined" ? localStorage.getItem("session-user") : null;
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as SessionUser;
    return stored?.role && DEFAULT_USERS[stored.role] ? stored : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(
    DEV_BYPASS_AUTH ? DEFAULT_USERS.admin : null
  );
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (DEMO_MODE) {
        const stored = readSessionUser();
        const role = typeof window !== "undefined" ? localStorage.getItem("mock-role") : null;
        if (stored) setUser(stored);
        else if (role === "admin" || role === "freelancer" || role === "client") setUser(DEFAULT_USERS[role]);
        return;
      }
      // Real backend: a session is only as good as its token.
      if (!getAuthToken()) {
        storeSessionUser(null);
        setUser(null);
        return;
      }
      try {
        const res = await apiFetch("/api/auth/me");
        if (cancelled) return;
        if (res.ok) {
          const { user: fresh } = (await res.json()) as { user: SessionUser };
          storeSessionUser(fresh);
          setUser(fresh);
        } else if (res.status === 401) {
          setAuthToken(null);
          storeSessionUser(null);
          setUser(null);
        } else {
          setUser(readSessionUser());
        }
      } catch {
        // Backend unreachable — keep the stored session; requests will retry.
        if (!cancelled) setUser(readSessionUser());
      }
    };

    restore().finally(() => {
      if (!cancelled) setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (role: Role, overrides?: Partial<SessionUser>, token?: string) => {
    const next = { ...DEFAULT_USERS[role], ...overrides, role };
    if (token) setAuthToken(token);
    setUser(next);
    storeSessionUser(next);
  };
  const setRole = (role: Role) => {
    if (DEMO_MODE) login(role);
  };
  const logout = React.useCallback(() => {
    setAuthToken(null);
    storeSessionUser(null);
    setUser(DEV_BYPASS_AUTH ? DEFAULT_USERS.admin : null);
  }, []);

  // Any request that comes back 401 with a token → the session is over.
  React.useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ user, bypass: DEV_BYPASS_AUTH, demoMode: DEMO_MODE, restored, login, logout, setRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const dashboardHomeFor = (role: Role) =>
  role === "admin" ? "/dashboard" : role === "freelancer" ? "/freelancer" : "/client";
