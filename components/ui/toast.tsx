"use client";
import * as React from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; description?: string; variant?: "default" | "success" };
type ToastContextValue = { toast: (t: Omit<Toast, "id">) => void };
const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toast = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x: any) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t: any) => (
          <div
            key={t.id}
            className="flex animate-fade-in items-start gap-3 rounded-lg border bg-card p-4 shadow-lg"
          >
            {t.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
            ) : (
              <Info className="mt-0.5 size-5 text-primary" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button onClick={() => setToasts((prev) => prev.filter((x: any) => x.id !== t.id))}>
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
