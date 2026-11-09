import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact metric strip — replaces the old heavy "box card" look across every page.
export function StatCard({
  label,
  value,
  trend,
  icon,
  hint,
  href,
}: {
  label: string;
  value: string;
  trend?: number;
  icon?: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const up = (trend ?? 0) >= 0;
  const body = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card px-4 py-3.5 transition-colors",
        href && "group cursor-pointer hover:border-primary/50 hover:bg-accent/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-primary">{icon}</span>}
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {href && (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {typeof trend === "number" && trend !== 0 && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
