"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  Activity, ArrowUpRight, Bot, CheckCircle2, CircleDollarSign, Clock,
  Gauge, MessagesSquare, Plug, Radar, Rocket, Sparkles, TriangleAlert,
  Users, Zap, ChevronRight, ChevronLeft, CalendarDays, UsersRound, Heart,
  FileText, Circle, Briefcase, Eye, Star, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { useEntityQuery, useEntity } from "@/lib/use-entity";
import { useDemoStore } from "@/lib/demo-store";
import { useAuth } from "@/lib/auth";
import { PaywallDialog } from "@/components/dashboard/paywall";
import { apiPost, apiCall } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  agents as agentsSeed, kpis as kpisSeed, revenueStreams as streamsSeed,
  hitlQueue as hitlSeed, auditLog as auditSeed,
  contracts as contractsSeed, freelanceLeads as leadsSeed,
  clients as clientsSeed, milestones as milestonesSeed,
  conversations as conversationsSeed, invoices as invoicesSeed,
} from "@/lib/mock-data";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const sentimentMap: Record<string, "success" | "secondary" | "destructive"> = {
  positive: "success", neutral: "secondary", "at-risk": "destructive",
};

// ---- Calendar helpers ----
type CalEvent = { date: string; label: string; kind: "milestone" | "invoice" | "campaign" | "contract" };
const KIND_DOT: Record<CalEvent["kind"], string> = {
  milestone: "bg-primary", invoice: "bg-warning", campaign: "bg-fuchsia-500", contract: "bg-success",
};
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  // Monday-first offset
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function CommandCenter() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, demoMode } = useAuth();
  const demo = useDemoStore();
  const [paywallOpen, setPaywallOpen] = React.useState(false);

  const { data: kpis } = useEntityQuery("kpis", kpisSeed, 4000);
  const { data: agents, refresh: refreshAgents } = useEntityQuery("agents", agentsSeed, 4000);
  const { data: streams } = useEntityQuery("revenue-streams", streamsSeed);
  const { data: hitl, refresh: refreshHitl } = useEntityQuery("hitl", hitlSeed, 4000);
  const { data: audit } = useEntityQuery("audit-log", auditSeed, 4000);
  const { data: contracts } = useEntityQuery("contracts", contractsSeed, 4000);
  const { data: leads } = useEntityQuery("leads", leadsSeed, 4000);
  const clients = useEntity("clients", clientsSeed);
  const milestones = useEntity("milestones", milestonesSeed);
  const conversations = useEntity("conversations", conversationsSeed);
  const invoices = useEntity("invoices", invoicesSeed);

  const mon = demo?.state.monetization;
  const isPro = mon?.plan === "pro";
  const bidCredits = mon?.bidCredits ?? 0;

  const activeAgents = agents.filter((a: any) => a.status === "running").length;
  const monthRevenue = streams.reduce((s: number, r: any) => s + (r.monthly || 0), 0);
  const openHitl = hitl.filter((h: any) => h.status === "Open");
  const hotLeads = leads.filter((l: any) => (l.matchScore ?? 0) >= 80).slice(0, 3);
  const atRisk = clients.filter((c: any) => c.sentiment === "at-risk").length;
  const activeContracts = contracts.filter((c: any) => c.status !== "Delivered");

  const firstName = (user?.name ?? "there").split(" ")[0];
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  })();

  async function toggleAgent(agent: any) {
    const res = await apiPost<any>(`/api/agents/${agent.id}/toggle`);
    const local = demo?.toggleAgent(agent.id);
    const status = res?.status ?? local?.status;
    if (status) { toast({ title: `${agent.name} → ${status}`, variant: "success" }); refreshAgents(); }
  }

  async function resolveHitl(item: any) {
    await apiPost<any>(`/api/hitl/${item.id}/resolve`);
    demo?.resolveHitl(item.id);
    toast({ title: "Resolved", variant: "success" });
    refreshHitl();
  }

  // Run cycle — one click queues a real automation job (approval-gated, no
  // fabricated numbers). Everything it does is visible in /dashboard/automation.
  const [cycleBusy, setCycleBusy] = React.useState(false);
  async function runCycle() {
    setCycleBusy(true);
    const res = await apiCall<any>("/api/automation/jobs", {
      kind: "custom", platform: "all", title: "Acquisition cycle",
      instructions: "Scan connected platforms for matching work, prepare applications/bids, pause before anything sends.",
    });
    setCycleBusy(false);
    if (!res || res.status >= 400) {
      toast({ title: "Couldn't queue the cycle", description: res?.data?.detail ?? "Can't reach the server — try again." });
      return;
    }
    toast({
      title: "Cycle queued",
      description: "Follow it in Automation — approve the final step when it's ready.",
      variant: "success",
    });
    router.push("/dashboard/automation");
  }

  // ---- Calendar state + events ----
  const today = new Date();
  const [calY, setCalY] = React.useState(today.getFullYear());
  const [calM, setCalM] = React.useState(today.getMonth());
  const [calDay, setCalDay] = React.useState<number | null>(today.getDate());
  const cells = buildMonth(calY, calM);
  const campaigns = demo?.state.growth?.campaigns ?? [];

  const events: CalEvent[] = [
    ...milestones.map((m: any) => ({ date: String(m.due ?? "").slice(0, 10), label: `${m.title} · ${m.contract}`, kind: "milestone" as const })),
    ...invoices.filter((i: any) => i.status !== "Paid").map((i: any) => ({ date: String(i.due ?? "").slice(0, 10), label: `Invoice — ${i.client} · ${formatCurrency(i.amount)}`, kind: "invoice" as const })),
    ...contracts.map((c: any) => ({ date: String(c.due ?? c.endDate ?? "").slice(0, 10), label: `Contract — ${c.title}`, kind: "contract" as const })),
    ...campaigns.map((c: any) => ({ date: String(c.createdAt ?? "").slice(0, 10), label: `Campaign "${c.name}" sent`, kind: "campaign" as const })),
  ].filter((e: any) => e.date && e.date !== "null");

  const eventsOn = (y: number, m: number, d: number) => {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return events.filter((e: any) => e.date === key);
  };
  const dayEvents = calDay ? eventsOn(calY, calM, calDay) : [];
  const monthEventCount = events.filter((e: any) => e.date.startsWith(`${calY}-${String(calM + 1).padStart(2, "0")}`)).length;

  // ---- Action Queue ----
  type Action = { id: string; icon: any; title: string; sub: string; tone: string; cta?: () => void; href?: string; ctaLabel: string };
  const actionQueue: Action[] = [
    ...(!isPro && bidCredits <= 3
      ? [{ id: "credits", icon: Zap, title: bidCredits === 0 ? "Out of bid credits" : `Only ${bidCredits} bids left`, sub: "Top up to keep applying", tone: "text-warning bg-warning/10", cta: () => setPaywallOpen(true), ctaLabel: "Top up" }]
      : []),
    ...openHitl.slice(0, 3).map((h: any) => ({
      id: h.id, icon: TriangleAlert, title: h.type, sub: `${h.entity} · ${h.priority} priority`,
      tone: "text-destructive bg-destructive/10", cta: () => resolveHitl(h), ctaLabel: "Resolve",
    })),
    ...clients.filter((c: any) => c.sentiment === "at-risk").slice(0, 2).map((c: any) => ({
      id: `risk-${c.id}`, icon: Heart, title: `${c.name} at risk`, sub: "Client sentiment dropped — reach out",
      tone: "text-warning bg-warning/10", href: "/dashboard/command?tab=work", ctaLabel: "View",
    })),
    ...hotLeads.map((l: any) => ({
      id: l.id, icon: Radar, title: l.title, sub: `${l.platform} · ${l.matchScore}% match`,
      tone: "text-primary bg-primary/10", href: "/dashboard/job-radar", ctaLabel: "View",
    })),
  ];

  const pulse = [
    { label: "Revenue (MTD)", value: `$${(kpis.revenueMonth / 1000).toFixed(1)}k`, trend: 8.1, icon: CircleDollarSign },
    { label: "Live Margin", value: `$${(kpis.liveMargin / 1000).toFixed(1)}k`, trend: kpis.marginTrend, icon: Gauge },
    { label: "Clients", value: String(clients.length), trend: 0, icon: Users },
    { label: "Active Work", value: String(activeContracts.length), trend: 0, icon: Briefcase },
  ];

  const hubActions = [
    { label: "AI Gig Builder", sub: "Generate a listing", href: "/dashboard/accounts?action=builder", icon: Sparkles, tone: "bg-primary/15 text-primary" },
    { label: "Publish a Gig", sub: "List across platforms", href: "/dashboard/accounts?action=gig", icon: Plug, tone: "bg-fuchsia-500/15 text-fuchsia-400" },
    { label: "Find Gigs", sub: "Scan & propose", href: "/dashboard/gigs", icon: Radar, tone: "bg-cyan-500/15 text-cyan-400" },
    { label: "Onboard Client", sub: "New project", href: "/dashboard/onboarding", icon: Users, tone: "bg-success/15 text-success" },
  ];

  const mGroups = ["Pending", "In Progress", "Approved"] as const;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="panel aurora relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{greeting}, {firstName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Dash<span className="gradient-text">board</span></h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {demoMode && `${activeAgents} agents running · `}{activeContracts.length} active contracts · {openHitl.length} need attention
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="gradient" onClick={runCycle} disabled={cycleBusy}>
              {cycleBusy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Run cycle
            </Button>
            <Button variant="outline" asChild><Link href="/dashboard/automation"><Rocket className="size-4" /> Automation</Link></Button>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-y-4 border-t border-border/50 px-6 py-4 sm:grid-cols-4">
          {pulse.map((p: any) => (
            <div key={p.label}>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <p.icon className="size-3.5 text-primary" /> {p.label}
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight">
                {p.value}
                {p.trend !== 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${p.trend > 0 ? "text-success" : "text-destructive"}`}>
                    {p.trend > 0 ? "+" : ""}{p.trend}%
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick create strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {hubActions.map((a: any) => (
          <Link key={a.label} href={a.href}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3.5 transition-all hover:border-primary/50 hover:bg-primary/[0.06]">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${a.tone}`}><a.icon className="size-[18px]" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">{a.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{a.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Main: workspace tabs + right Action Queue rail */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="work">
            <TabsList>
              <TabsTrigger value="work"><Briefcase className="mr-1.5 size-4" />Work</TabsTrigger>
              <TabsTrigger value="clients"><UsersRound className="mr-1.5 size-4" />Clients{atRisk > 0 && <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">{atRisk}</span>}</TabsTrigger>
              <TabsTrigger value="inbox"><MessagesSquare className="mr-1.5 size-4" />Inbox</TabsTrigger>
            </TabsList>

            {/* Work tab — contracts + milestone kanban */}
            <TabsContent value="work" className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">Active Contracts</CardTitle>
                  <span className="text-xs text-muted-foreground">{formatCurrency(contracts.reduce((a, c) => a + c.value, 0))} total</span>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activeContracts.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{c.title}</p>
                        <span className="text-sm font-semibold">{formatCurrency(c.value)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{c.client} · {c.milestonesDone}/{c.milestonesTotal} milestones · {c.freelancer}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <Progress value={(c.milestonesDone / Math.max(c.milestonesTotal, 1)) * 100} className="mt-2 h-1.5" />
                    </div>
                  ))}
                  {activeContracts.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">No active work yet — run a cycle or send proposals to win contracts.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {mGroups.map((g: any) => {
                  const items = milestones.filter((m: any) => m.status === g);
                  return (
                    <div key={g}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          {g === "Approved" ? <CheckCircle2 className="size-4 text-success" /> : g === "In Progress" ? <Clock className="size-4 text-warning" /> : <Circle className="size-4 text-muted-foreground" />}
                          {g}
                        </h3>
                        <Badge variant="secondary">{items.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {items.slice(0, 4).map((m: any) => (
                          <Card key={m.id}><CardContent className="p-3">
                            <p className="text-sm font-medium">{m.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{m.contract}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm font-semibold">{formatCurrency(m.amount)}</span>
                              <span className="text-xs text-muted-foreground">due {formatDate(m.due)}</span>
                            </div>
                          </CardContent></Card>
                        ))}
                        {items.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">None</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Clients tab */}
            <TabsContent value="clients" className="space-y-2">
              {clients.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center gap-3 p-3.5">
                    <Avatar name={c.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name} <span className="text-muted-foreground">· {c.company}</span></p>
                      <p className="text-xs text-muted-foreground">{c.contracts} contracts · {c.source}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(c.ltv)}</span>
                    <Badge variant={sentimentMap[c.sentiment]} className="capitalize">{c.sentiment}</Badge>
                    <StatusBadge status={c.status} />
                  </CardContent>
                </Card>
              ))}
              {clients.length === 0 && (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No clients yet — win your first through Job Radar or Get First Clients.</CardContent></Card>
              )}
            </TabsContent>

            {/* Calendar tab — hidden; Calendar is now its own page */}
            <TabsContent value="calendar">
              <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base">
                    {new Date(calY, calM).toLocaleString("default", { month: "long", year: "numeric" })}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{monthEventCount} events</span>
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { const d = new Date(calY, calM - 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); setCalDay(null); }}><ChevronLeft className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCalY(today.getFullYear()); setCalM(today.getMonth()); setCalDay(today.getDate()); }}>Today</Button>
                    <Button size="sm" variant="ghost" onClick={() => { const d = new Date(calY, calM + 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); setCalDay(null); }}><ChevronRight className="size-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1">
                    {DOW.map((d: any) => <p key={d} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</p>)}
                    {cells.map((d, i) => {
                      const evs = d ? eventsOn(calY, calM, d) : [];
                      const isToday = d === today.getDate() && calM === today.getMonth() && calY === today.getFullYear();
                      return (
                        <button key={i} disabled={!d} onClick={() => setCalDay(d)}
                          className={cn(
                            "relative flex h-14 flex-col items-center justify-start rounded-lg border p-1 text-xs transition-colors md:h-16",
                            !d && "invisible",
                            calDay === d ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-accent/50",
                            isToday && "ring-1 ring-primary"
                          )}>
                          <span className={cn("font-medium", isToday && "text-primary")}>{d}</span>
                          <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                            {evs.slice(0, 3).map((e, j) => <span key={j} className={`size-1.5 rounded-full ${KIND_DOT[e.kind]}`} />)}
                            {evs.length > 3 && <span className="text-[9px] text-muted-foreground">+{evs.length - 3}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Milestone due</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Invoice due</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Contract</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-fuchsia-500" /> Campaign</span>
                  </div>
                  {calDay && (
                    <div className="mt-4 space-y-1.5 border-t pt-3">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {new Date(calY, calM, calDay).toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled.</p>}
                      {dayEvents.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} />
                          <span className="truncate">{e.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inbox tab */}
            <TabsContent value="inbox" className="space-y-2">
              {conversations.map((c: any) => (
                <Link key={c.id} href="/dashboard/conversations" className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-primary/50 hover:bg-accent/50">
                  <Avatar name={c.contact ?? c.client ?? "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{c.contact ?? c.client}</p>
                      {c.unread > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{c.unread}</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.last ?? c.lastMessage}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{c.channel ?? c.platform}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
              <Link href="/dashboard/conversations" className="block pt-1 text-sm text-primary hover:underline">Open full inbox →</Link>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail: Action Queue + compact agent strip */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-2">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" /> Action Queue</CardTitle>
              <Badge variant={actionQueue.length ? "destructive" : "secondary"} className="h-5">{actionQueue.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {actionQueue.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                </div>
              )}
              {actionQueue.map((a: any) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`rounded-md p-1.5 ${a.tone}`}><a.icon className="size-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    {a.href ? (
                      <Button size="sm" variant="outline" asChild><Link href={a.href}>{a.ctaLabel} <ChevronRight className="size-3.5" /></Link></Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={a.cta}>{a.ctaLabel}</Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Agent strip — demo only: the agents don't run for real accounts yet */}
              {demoMode && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Bot className="size-3.5 text-primary" /> Agents</span>
                  <span className="text-xs text-muted-foreground">{activeAgents} live</span>
                </p>
                <div className="space-y-1">
                  {agents.slice(0, 4).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className={cn("size-1.5 shrink-0 rounded-full", a.status === "running" ? "bg-success animate-pulse" : "bg-muted-foreground")} />
                        <span className="truncate">{a.name}</span>
                      </span>
                      <button onClick={() => toggleAgent(a)} className="shrink-0 text-muted-foreground hover:text-foreground">
                        {a.status === "running" ? "Pause" : "Start"}
                      </button>
                    </div>
                  ))}
                  <Link href="/dashboard/agents" className="block pt-1 text-xs text-primary hover:underline">Manage fleet →</Link>
                </div>
              </div>
              )}

              {/* Live stream — condensed */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-1.5"><Activity className="size-3.5 text-primary" /> Latest</span>
                  <Link href="/dashboard/audit-log" className="text-xs text-primary hover:underline">Log</Link>
                </p>
                <div className="space-y-1.5">
                  {audit.slice(0, 4).map((a: any) => (
                    <p key={a.id} className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{a.agent}</span> — {a.action}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} kind="bids" />
    </div>
  );
}
