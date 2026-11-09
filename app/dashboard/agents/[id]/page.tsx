"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, Bot, Briefcase, CheckCircle2, DollarSign, Gavel, Loader2, Megaphone,
  MessagesSquare, Network, Package, Pause, Play, RotateCw, Settings2, ShieldCheck, Sparkles,
  Target, Terminal, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { PaywallDialog } from "@/components/dashboard/paywall";
import { useDemoStore } from "@/lib/demo-store";
import { useEntity } from "@/lib/use-entity";
import { apiPost } from "@/lib/api";
import {
  agents as agentsSeed, auditLog as auditSeed, freelanceLeads as leadsSeed,
  proposals as proposalsSeed, contracts as contractsSeed, salesLeads as salesSeed,
  conversations as convSeed, appliedJobs as jobsSeed, qaRuns as qaSeed,
} from "@/lib/mock-data";
import { cn, formatRelative, formatCurrency } from "@/lib/utils";

const iconMap: Record<string, any> = {
  briefcase: Briefcase, megaphone: Megaphone, gavel: Gavel,
  "messages-square": MessagesSquare, network: Network, "shield-check": ShieldCheck,
  package: Package, target: Target,
};

const MODELS = ["Claude Sonnet", "Claude Opus", "GPT-4o", "Llama 3.1 70B (Groq)"];
const SCHEDULES = ["Realtime", "Every 2h", "Every 6h", "Daily @ 06:00", "On contract win", "On PR push", "Manual only"];

// What each agent produces — feeds the Output tab.
const artifactFor: Record<string, { key: string; label: string; title: (r: any) => string; sub: (r: any) => string; href: string }> = {
  "Bidding & Acquisition": {
    key: "proposals", label: "Proposals", href: "/dashboard/bidding",
    title: (r) => r.leadTitle,
    sub: (r) => `${r.platform} · ${r.status}${r.quality ? ` · quality ${r.quality}` : ""}`,
  },
  "Marketing & Sales": {
    key: "sales-leads", label: "Sales leads", href: "/dashboard/marketing",
    title: (r) => r.company,
    sub: (r) => `${r.industry} · ${r.stage}`,
  },
  "Stealth Client Manager": {
    key: "conversations", label: "Conversations", href: "/dashboard/conversations",
    title: (r) => r.contact,
    sub: (r) => `${r.channel} · ${r.persona}`,
  },
  "Arbitrage Dispatcher": {
    key: "contracts", label: "Contracts", href: "/dashboard/contracts",
    title: (r) => r.title,
    sub: (r) => `${r.client} · ${formatCurrency(r.value)} · ${r.status}`,
  },
  "Job Hunter": {
    key: "jobs", label: "Applications", href: "/dashboard/job-hunter",
    title: (r) => r.title,
    sub: (r) => `${r.company} · ${r.status} · ${r.match}% match`,
  },
  "QA & Delivery": {
    key: "qa-runs", label: "QA runs", href: "/dashboard/qa",
    title: (r) => r.contract,
    sub: (r) => `${r.status} · sonar ${r.sonar} · ${formatRelative(r.time)}`,
  },
  "Prospect Scout": {
    key: "sales-leads", label: "Prospects found", href: "/dashboard/growth",
    title: (r) => r.company,
    sub: (r) => `${r.industry} · ${r.stage}`,
  },
};

// What each agent can do — the sales pitch for agency users.
const capabilitiesFor: Record<string, string[]> = {
  "Job Hunter": ["Daily scans across LinkedIn, Indeed & boards", "Auto-tailored cover letters", "Application tracker with status sync"],
  "Marketing & Sales": ["Scrapes funded startups from Clutch/LinkedIn", "Cold-email sequences via your SMTP", "Micro-sites on demand per prospect"],
  "Bidding & Acquisition": ["Scans enabled public feeds and approved APIs", "Matches jobs to saved skills", "Prepares proposals for human review"],
  "Stealth Client Manager": ["Multi-channel client comms", "Upsell & renewal detection", "Escalates to you before anything sensitive"],
  "Arbitrage Dispatcher": ["Broadcasts specs to vetted freelancers", "Blind auction by ROI score", "Auto-award + kickoff message"],
  "QA & Delivery": ["Lint + test suites on every PR", "SonarQube quality gate", "Auto-delivers on green"],
  "Gig Studio": ["Title + tagline optimised for search", "3-tier packages with pricing math", "FAQ + imagery prompts, one-click publish"],
  "Prospect Scout": ["Agency directories + hiring posts", "Scores leads by fit & budget", "Feeds your Outreach campaigns directly"],
};

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const demo = useDemoStore();
  const { toast } = useToast();

  const agents = useEntity("agents", agentsSeed, 4000);
  const auditLog = useEntity("audit-log", auditSeed, 4000);
  const proposals = useEntity("proposals", proposalsSeed);
  const salesLeads = useEntity("sales-leads", salesSeed);
  const conversations = useEntity("conversations", convSeed);
  const contracts = useEntity("contracts", contractsSeed);
  const jobs = useEntity("jobs", jobsSeed);
  const qaRuns = useEntity("qa-runs", qaSeed);
  const collections: Record<string, any[]> = {
    proposals, "sales-leads": salesLeads, conversations, contracts, jobs, "qa-runs": qaRuns,
  };

  const agent = agents.find((a: any) => a.id === id);
  const Icon = agent ? (iconMap[agent.icon] ?? Bot) : Bot;
  const activity = auditLog.filter((e: any) => e.agent === agent?.name || (e.agent === "Operator" && e.action.includes(`'${agent?.name}'`)));
  const artifact = agent ? artifactFor[agent.name] : undefined;
  const artifacts = artifact ? (collections[artifact.key] ?? []).slice(0, 8) : [];
  const capabilities = agent ? (capabilitiesFor[agent.name] ?? []) : [];
  const successRuns = activity.filter((e: any) => e.status === "success").length;
  const errorRuns = activity.filter((e: any) => e.status === "error").length;

  const [running, setRunning] = React.useState(false);
  const [liveFeed, setLiveFeed] = React.useState<{ agent: string; action: string; status: string }[]>([]);
  const [paywallOpen, setPaywallOpen] = React.useState(false);
  const [hitl, setHitl] = React.useState(true);
  const [budgetCap, setBudgetCap] = React.useState("");
  const [schedule, setSchedule] = React.useState("");
  const [model, setModel] = React.useState("");
  const [instructions, setInstructions] = React.useState("");

  React.useEffect(() => {
    if (!agent) return;
    const a = agent as any;
    setSchedule(a.schedule);
    setModel(a.model ?? MODELS[0]);
    setInstructions(a.instructions ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, agent?.schedule]);

  if (!agent) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Agent not found. <Link href="/dashboard/agents" className="text-primary hover:underline">Back to fleet</Link>
      </div>
    );
  }

  const toggle = () => {
    const updated = demo?.toggleAgent(agent.id);
    apiPost(`/api/agents/${agent.id}/toggle`);
    toast({ title: `${agent.name} ${updated?.status ?? (agent.status === "running" ? "paused" : "running")}`, variant: "success" });
  };

  const runNow = async () => {
    if (running) return;
    setRunning(true);
    apiPost(`/api/agents/${agent.id}/run`);
    const res = demo?.runAgent(agent.name);
    if (res) {
      setLiveFeed([]);
      for (let i = 0; i < res.events.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 500));
        setLiveFeed((p) => [res.events[i], ...p]);
      }
      toast({
        title: `${agent.name} finished`,
        description: res.deltas.clients
          ? `+${res.deltas.clients} client · +${res.deltas.contractsWon} contract · ${formatCurrency(res.deltas.revenue)}`
          : `+${res.deltas.leads} leads · +${res.deltas.proposals} proposals`,
        variant: "success",
      });
      if (res.needsCredits) setPaywallOpen(true);
    }
    setRunning(false);
  };

  const saveConfig = () => {
    demo?.updateAgent(agent.id, { schedule, model, instructions });
    apiPost(`/api/agents/${agent.id}/config`, { schedule, model, instructions, hitl, budgetCap });
    toast({ title: `${agent.name} configuration saved`, variant: "success" });
  };

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.subtitle}
        actions={<Button variant="outline" asChild><Link href="/dashboard/agents"><ArrowLeft className="size-4" /> Fleet</Link></Button>}
      />

      {/* Control strip */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("relative flex size-14 items-center justify-center rounded-xl text-white",
              agent.status === "running" ? "bg-gradient-to-br from-primary to-purple-500" : "bg-muted-foreground/40")}>
              <Icon className="size-7" />
              {agent.status === "running" && <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-success ring-2 ring-background" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{agent.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={agent.status} />
                {hitl && <Badge variant="secondary" className="text-[10px]">Human-approved</Badge>}
              </div>
              <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {agent.name === "Gig Studio" && (
              <Button variant="outline" asChild><Link href="/dashboard/accounts?action=builder"><Sparkles className="size-4" /> Build a gig</Link></Button>
            )}
            {agent.status === "running" ? (
              <Button variant="outline" onClick={toggle}><Pause className="size-4" /> Pause</Button>
            ) : (
              <Button variant="default" onClick={toggle}><Play className="size-4" /> Start</Button>
            )}
            <Button variant="gradient" onClick={runNow} disabled={running}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              {running ? "Running…" : "Run now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <Stat icon={<Zap className="size-4 text-primary" />} label="Runs today" value={String(agent.runsToday)} />
        <Stat icon={<RotateCw className="size-4 text-primary" />} label="Last run" value={formatRelative(agent.lastRun)} />
        <Stat icon={<Settings2 className="size-4 text-primary" />} label="Schedule" value={agent.schedule} />
        <div className="rounded-xl border p-4">
          <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Success rate</span><span className="font-medium">{agent.successRate}%</span></div>
          <Progress value={agent.successRate} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">{successRuns} ok · {errorRuns} errors logged</p>
        </div>
        <Stat icon={<DollarSign className="size-4 text-success" />} label="Output this week" value={String(artifacts.length)} />
      </div>

      <Tabs defaultValue="console" className="mt-6">
        <TabsList>
          <TabsTrigger value="console"><Terminal className="mr-1.5 size-4" />Console</TabsTrigger>
          <TabsTrigger value="output"><ArrowUpRight className="mr-1.5 size-4" />Output</TabsTrigger>
          <TabsTrigger value="activity"><Bot className="mr-1.5 size-4" />Activity{activity.length > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px]">{activity.length}</span>}</TabsTrigger>
          <TabsTrigger value="configure"><Settings2 className="mr-1.5 size-4" />Configure</TabsTrigger>
        </TabsList>

        {/* Console — live run output */}
        <TabsContent value="console" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live console</CardTitle>
              <CardDescription>What this agent is doing right now, streamed as it works.</CardDescription>
            </CardHeader>
            <CardContent>
              {liveFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-muted-foreground">
                  <Bot className="size-8 opacity-50" />
                  <p className="text-sm">Press <span className="font-medium text-foreground">Run now</span> to watch {agent.name} work in real time.</p>
                </div>
              ) : (
                <div className="space-y-2 font-mono text-[13px]">
                  {running && <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-primary"><Loader2 className="size-3.5 animate-spin" /><span>Agent still working…</span></div>}
                  {liveFeed.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 animate-fade-in">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span>{e.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Output — what this agent produced */}
        <TabsContent value="output" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{artifact ? artifact.label : "Recent output"}</CardTitle>
                  <CardDescription>Work this agent has produced — click through to act on it.</CardDescription>
                </div>
                {artifact && <Button size="sm" variant="outline" asChild><Link href={artifact.href}>Open <ArrowUpRight className="size-3.5" /></Link></Button>}
              </CardHeader>
              <CardContent className="space-y-2">
                {artifacts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing yet — run the agent to generate output.</p>}
                {artifacts.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/40">
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{artifact!.title(r)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{artifact!.sub(r)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Capabilities</CardTitle><CardDescription>What this agent handles for you.</CardDescription></CardHeader>
              <CardContent className="space-y-2.5">
                {capabilities.map((c: any) => (
                  <div key={c} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{c}</span></div>
                ))}
                {agent.name === "Gig Studio" && (
                  <Button size="sm" variant="gradient" className="mt-2 w-full" asChild><Link href="/dashboard/accounts?action=builder"><Sparkles className="size-4" /> Open AI Gig Builder</Link></Button>
                )}
                {agent.name === "Prospect Scout" && (
                  <Button size="sm" variant="gradient" className="mt-2 w-full" asChild><Link href="/dashboard/growth"><Target className="size-4" /> View target lists</Link></Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Activity — full audit history */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity history</CardTitle>
              <CardDescription>Every operation this agent has performed (mirrors the audit log).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activity.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No activity yet — this agent hasn't run.</p>}
              {activity.slice(0, 20).map((e: any) => (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.status === "success" ? "bg-success" : e.status === "warning" ? "bg-warning" : "bg-destructive")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{e.action}</p>
                    <p className="text-xs text-muted-foreground">{e.agent} · {formatRelative(e.time)}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{e.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configure — inline, not a modal */}
        <TabsContent value="configure" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Runtime</CardTitle><CardDescription>How and when this agent operates.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Schedule</Label>
                  <Select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                    {SCHEDULES.map((s: any) => <option key={s}>{s}</option>)}
                    {schedule && !SCHEDULES.includes(schedule) && <option>{schedule}</option>}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Select value={model} onChange={(e) => setModel(e.target.value)}>
                    {MODELS.map((m: any) => <option key={m}>{m}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Daily spend cap (optional)</Label>
                  <Input type="number" min={0} placeholder="e.g. 50 — agent pauses after this much spend" value={budgetCap} onChange={(e) => setBudgetCap(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Bidding/outreach spend only — protects your budget while agents run.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Behaviour</CardTitle><CardDescription>Guidance + guardrails.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Human approval before sending</p>
                    <p className="text-xs text-muted-foreground">Agent drafts; you approve before anything goes out.</p>
                  </div>
                  <Switch checked={hitl} onCheckedChange={setHitl} />
                </div>
                <div className="space-y-1.5">
                  <Label>Operating instructions</Label>
                  <Textarea rows={4} placeholder="e.g. Prioritise budgets above $2k with >50% margin. Skip WordPress jobs." value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Freeform guidance the agent follows on every run.</p>
                </div>
                <Button variant="gradient" className="w-full" onClick={saveConfig}><CheckCircle2 className="size-4" /> Save configuration</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} kind="bids" />
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
