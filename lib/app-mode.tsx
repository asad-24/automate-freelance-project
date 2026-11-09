"use client";
import * as React from "react";

export type AppMode = "stealth" | "compliance";

type AppModeContextValue = { mode: AppMode; setMode: (m: AppMode) => void; toggle: () => void };
const AppModeContext = React.createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<AppMode>("compliance");
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("app-mode") : null;
    if (stored === "stealth" || stored === "compliance") setModeState(stored);
  }, []);
  const setMode = (m: AppMode) => {
    setModeState(m);
    if (typeof window !== "undefined") localStorage.setItem("app-mode", m);
  };
  const toggle = () => setMode(mode === "stealth" ? "compliance" : "stealth");
  return (
    <AppModeContext.Provider value={{ mode, setMode, toggle }}>{children}</AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = React.useContext(AppModeContext);
  if (!ctx) return { mode: "compliance" as AppMode, setMode: () => {}, toggle: () => {} };
  return ctx;
}
