"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Minus, MessagesSquare, Radar, Gavel, Briefcase, Plug, UserPlus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PLATFORM_MATRIX, CATEGORY_LABELS, HUB_LABELS, MODE_LABELS,
  type Hub, type PlatformCategory, type PlatformSpec, type PlatformStatus,
} from "@/lib/platforms";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

const HUBS: { key: Hub; icon: any }[] = [
  { key: "inbox", icon: MessagesSquare },
  { key: "jobs", icon: Radar },
  { key: "bidding", icon: Gavel },
  { key: "gigs", icon: Briefcase },
  { key: "account", icon: UserPlus },
];

const STATUS_STYLE: Record<PlatformStatus, { label: string; variant: "success" | "secondary" | "warning" | "outline" | "default" }> = {
  live: { label: "Live", variant: "success" },
  gated: { label: "Gated", variant: "warning" },
  guided: { label: "Guided", variant: "default" },
  demo: { label: "Demo", variant: "secondary" },
  assist: { label: "Assist", variant: "warning" },
  planned: { label: "Planned", variant: "outline" },
};

type SourceState = { enabled: boolean; reason: string; health?: { ok: boolean; count: number } | null };

/**
 * Every platform separated by which hubs it can do. Job Radar sources take
 * their live/gated state from /api/radar/sources (the backend registry), so a
 * feed switched on or off by configuration shows correctly without a deploy.
 */
export function PlatformMatrix() {
  const [live, setLive] = React.useState<Record<string, boolean>>({});
  const [sources, setSources] = React.useState<Record<string, SourceState>>({});
  const [workerOn, setWorkerOn] = React.useState(false);
  const [category, setCategory] = React.useState<PlatformCategory | "all">("all");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let dead = false;
    (async () => {
      const [fl, uw, auto, radar] = await Promise.all([
        apiGet<any>("/api/freelancer/status"),
        apiGet<any>("/api/upwork/status"),
        apiGet<any>("/api/automation/status"),
        apiGet<{ sources: ({ id: string } & SourceState)[] }>("/api/radar/sources"),
      ]);
      if (dead) return;
      setLive({
        freelancer: fl?.mode === "live",
        upwork: uw?.mode === "live",
      });
      setWorkerOn(!!auto?.workerConfigured);
      setSources(Object.fromEntries((radar?.sources ?? []).map((s) => [s.id, s])));
    })();
    return () => { dead = true; };
  }, []);

  const statusOf = (p: PlatformSpec): { status: PlatformStatus; reason?: string } => {
    if (p.mode === "browser") return { status: workerOn ? "assist" : "planned" };
    if (live[p.id]) return { status: "live" };
    const source = p.sourceId ? sources[p.sourceId] : undefined;
    if (source) return { status: source.enabled ? "live" : "gated", reason: source.reason };
    return { status: p.status };
  };

  const needle = query.trim().toLowerCase();
  const visible = PLATFORM_MATRIX.filter((p) =>
    (category === "all" || p.category === category)
    && (!needle || `${p.name} ${p.note ?? ""}`.toLowerCase().includes(needle)));
  const categories = Object.keys(CATEGORY_LABELS) as PlatformCategory[];
  const liveCount = PLATFORM_MATRIX.filter((p) => statusOf(p).status === "live").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plug className="size-5 text-primary" /> Platform capability map</CardTitle>
        <CardDescription>
          {PLATFORM_MATRIX.length} platforms, separated by what each can do. {liveCount} are reading live data now; the rest work through guided setup and AI drafts, or wait on the approval named in their note.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button type="button" onClick={() => setCategory("all")}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", category === "all" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
            All · {PLATFORM_MATRIX.length}
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", category === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {CATEGORY_LABELS[c].label} · {PLATFORM_MATRIX.filter((p) => p.category === c).length}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a platform" className="h-8 pl-8 text-xs" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-5 py-3 font-medium text-muted-foreground">Platform</th>
              {HUBS.map(({ key, icon: Icon }) => (
                <th key={key} className="px-3 py-3">
                  <Link href={HUB_LABELS[key].href} className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary">
                    <Icon className="size-3.5 text-primary" /> {HUB_LABELS[key].label}
                  </Link>
                </th>
              ))}
              <th className="px-3 py-3 font-medium text-muted-foreground">Via</th>
              <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.filter((c) => visible.some((p) => p.category === c)).map((c) => (
              <React.Fragment key={c}>
                <tr className="border-b bg-muted/40">
                  <td colSpan={HUBS.length + 3} className="px-5 py-2">
                    <span className="text-xs font-semibold">{CATEGORY_LABELS[c].label}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">{CATEGORY_LABELS[c].description}</span>
                  </td>
                </tr>
                {visible.filter((p) => p.category === c).map((p) => {
                  const { status, reason } = statusOf(p);
                  const stStyle = STATUS_STYLE[status];
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-2.5">
                        {p.url
                          ? <a href={p.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">{p.name}</a>
                          : <p className="font-medium">{p.name}</p>}
                        {p.note && <p className="text-[11px] text-muted-foreground">{p.note}</p>}
                      </td>
                      {HUBS.map(({ key }) => (
                        <td key={key} className="px-3 py-2.5 text-center">
                          {p.caps.includes(key)
                            ? key === "account"
                              ? <span className="text-[10px] font-medium text-primary">guided</span>
                              : <Check className="mx-auto size-4 text-success" />
                            : <Minus className="mx-auto size-4 text-muted-foreground/30" />}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{MODE_LABELS[p.mode]}</td>
                      <td className="px-5 py-2.5" title={reason}>
                        <Badge variant={stStyle.variant} className="text-[10px]">{stStyle.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={HUBS.length + 3} className="px-5 py-8 text-center text-sm text-muted-foreground">No platform matches “{query}”.</td></tr>
            )}
          </tbody>
        </table>
        <p className="border-t px-5 py-3 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Live</span> = reading data now · <span className="font-medium text-foreground">Gated</span> = built, waiting on the approval or API key in its note · <span className="font-medium text-foreground">Guided</span> = official signup link, setup checklist, and AI drafts you paste yourself. Account registration, verification, and email inbox creation stay with you.
        </p>
      </CardContent>
    </Card>
  );
}
