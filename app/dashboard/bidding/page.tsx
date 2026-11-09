"use client";
import * as React from "react";
import { Gavel, DollarSign, FileEdit, Trophy, Send, Star, Radar, Loader2, Sparkles, ExternalLink, CheckCircle2, Search, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { API_URL, apiGet, apiCall } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { freelanceLeads as freelanceLeadsSeed, proposals as proposalsSeed, kpis as kpisSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { proposalBodyText } from "@/lib/demo-engine";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatRelative } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Lead = (typeof freelanceLeadsSeed)[number];
type Prop = (typeof proposalsSeed)[number];

export default function BiddingPage() {
  const freelanceLeads = useEntity("leads", freelanceLeadsSeed, 4000);
  const proposals = useEntity("proposals", proposalsSeed, 4000);
  const kpis = useEntity("kpis", kpisSeed, 4000);
  const [viewing, setViewing] = React.useState<(Prop & { body?: string }) | null>(null);

  const highMargin = freelanceLeads.filter((l: any) => l.budget >= 500 && l.margin >= 45).length;
  const sentProposals = proposals.filter((p: any) => p.status === "Sent" || p.status === "Accepted").length;
  const won = freelanceLeads.filter((l: any) => l.status === "Won").length;
  const leadColumns: Column<Lead>[] = [
    { key: "title", header: "Job", render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "platform", header: "Platform", render: (r) => <Badge variant="outline">{r.platform}</Badge> },
    { key: "budget", header: "Budget", render: (r) => formatCurrency(r.budget) },
    {
      key: "margin",
      header: "Margin",
      render: (r) => <Badge variant={r.margin >= 50 ? "success" : "secondary"}>{r.margin}%</Badge>,
    },
    {
      key: "matchScore",
      header: "Match",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.matchScore} className="w-14" />
          <span className="text-sm">{r.matchScore}%</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "posted", header: "Posted", render: (r) => <span className="text-muted-foreground">{r.posted}</span> },
  ];

  const propColumns: Column<Prop>[] = [
    { key: "leadTitle", header: "Lead", render: (r) => <span className="font-medium">{r.leadTitle}</span> },
    { key: "platform", header: "Platform", render: (r) => <Badge variant="outline">{r.platform}</Badge> },
    { key: "words", header: "Words", render: (r) => `${r.words}` },
    {
      key: "quality",
      header: "Quality",
      render: (r) => (r.quality ? <span className="font-medium">{r.quality}/100</span> : <span className="text-muted-foreground">—</span>),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "submitted",
      header: "Submitted",
      render: (r) => <span className="text-muted-foreground">{r.submitted ? formatRelative(r.submitted) : "—"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Bidding & Acquisition"
        description="Find matching jobs from enabled feeds, draft personalized proposals, and review each one before submitting through an approved workflow or manually."
        actions={<Badge variant="outline">Review before every submission</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads (current pool)" value={String(freelanceLeads.length)} trend={14} icon={<Gavel className="size-5" />} href="/dashboard/marketing" />
        <StatCard label="High-Margin (>$500)" value={String(highMargin)} icon={<DollarSign className="size-5" />} href="/dashboard/margins" />
        <StatCard label="Proposals Sent" value={String(sentProposals)} trend={6} icon={<FileEdit className="size-5" />} href="/dashboard/analytics" />
        <StatCard label="Contracts Won (MTD)" value={String(kpis.activeContracts)} trend={5} icon={<Trophy className="size-5" />} href="/dashboard/contracts" />
      </div>

      <Tabs defaultValue="live" className="mt-6">
        <TabsList>
          <TabsTrigger value="live"><Radar className="mr-1.5 size-4" />Freelancer.com</TabsTrigger>
          <TabsTrigger value="upwork"><Radar className="mr-1.5 size-4" />Upwork</TabsTrigger>
          <TabsTrigger value="leads">Saved Leads</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <LiveBidding platform="freelancer" />
        </TabsContent>
        <TabsContent value="upwork">
          <LiveBidding platform="upwork" />
        </TabsContent>
        <TabsContent value="leads">
          <DataTable columns={leadColumns} data={freelanceLeads} searchKeys={["title", "platform"]} searchPlaceholder="Search leads..." />
        </TabsContent>
        <TabsContent value="proposals">
          <DataTable
            columns={propColumns}
            data={proposals}
            searchKeys={["leadTitle", "platform"]}
            searchPlaceholder="Search proposals... (click a row to read the bid)"
            onRowClick={setViewing}
          />
        </TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Proposal Generation Pipeline</CardTitle>
          <CardDescription>Job details → personalized draft → your review → manual submission or an explicitly approved API path.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            {["Read JD", "RAG Portfolio", "Draft (~150 words)", "Critique & Refine", "Submit"].map((s, i) => (
              <div key={s} className="rounded-lg border p-4 text-center">
                <div className="mx-auto mb-2 flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <p className="text-sm font-medium">{s}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proposal viewer — see exactly what the agent sent */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        {viewing && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="size-4 text-primary" /> Proposal record
              </DialogTitle>
              <DialogDescription>
                Proposal draft or status record · {viewing.platform}
                {viewing.submitted ? ` · ${formatRelative(viewing.submitted)}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="mb-4 flex items-center gap-3 text-sm">
              <Badge variant="outline">{viewing.leadTitle}</Badge>
              <StatusBadge status={viewing.status} />
              {viewing.quality > 0 && (
                <Badge variant="success" className="gap-1"><Star className="size-3" /> {viewing.quality}/100</Badge>
              )}
            </div>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 font-sans text-sm leading-relaxed">
              {viewing.body ?? proposalBodyText(viewing)}
            </pre>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </>
  );
}

// --------------------------------------------------------------------------- //
// Unified live bidding hub — one component, driven by a per-platform config.
// Sanctioned APIs (Freelancer REST / Upwork GraphQL) with demo fallback.
// Scan → AI-draft → human approves → submit. Nothing submits without approval.
// --------------------------------------------------------------------------- //
type LiveJob = {
  id: string; title: string; description: string; skills: string[]; type: string;
  matchScore?: number;
  currency?: string; budgetMin?: number | null; budgetMax?: number | null;
  budget?: number | null; hourlyMin?: number | null; hourlyMax?: number | null;
  bidCount?: number; proposals?: number; url: string; source: string;
};
type SavedBidDraft = { id: string; jobId: string; platform: string; jobTitle: string; body: string; amount?: number; status: string };

const PLATFORM_CFG = {
  freelancer: {
    name: "Freelancer.com",
    statusPath: "/api/freelancer/status",
    jobsPath: "/api/freelancer/projects",
    preparePath: "/api/freelancer/bid/prepare",
    submitPath: "/api/freelancer/bid/place",
    liveLabel: "LIVE", demoLabel: "SANDBOX",
  },
  upwork: {
    name: "Upwork",
    statusPath: "/api/upwork/status",
    jobsPath: "/api/upwork/jobs",
    preparePath: "/api/upwork/proposal/prepare",
    submitPath: "/api/upwork/proposal/submit",
    liveLabel: "LIVE", demoLabel: "DEMO",
  },
} as const;

function budgetLabel(j: LiveJob) {
  if (j.type === "hourly" && (j.hourlyMin || j.hourlyMax)) return `$${j.hourlyMin ?? ""}–${j.hourlyMax ?? ""}/hr`;
  if (j.budgetMin != null && j.budgetMax != null) return `${j.currency ?? "$"} ${j.budgetMin}–${j.budgetMax}`;
  if (j.budget != null) return `$${j.budget}`;
  return "";
}

function LiveBidding({ platform }: { platform: keyof typeof PLATFORM_CFG }) {
  const cfg = PLATFORM_CFG[platform];
  const { toast } = useToast();
  const { user } = useAuth();
  const [live, setLive] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [q, setQ] = React.useState("react, next.js, python");
  const [jobs, setJobs] = React.useState<LiveJob[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<LiveJob | null>(null);
  const [amount, setAmount] = React.useState("");
  const [period, setPeriod] = React.useState("7");
  const [proposal, setProposal] = React.useState("");
  const [proposalId, setProposalId] = React.useState("");
  const [savedDrafts, setSavedDrafts] = React.useState<SavedBidDraft[]>([]);
  const [drafting, setDrafting] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);
  const [bidRules, setBidRules] = React.useState({ minimumMatchScore: 0, minimumBudget: 0, dailyBidCap: 5 });
  const [rulesSaving, setRulesSaving] = React.useState(false);

  React.useEffect(() => { apiGet<any>(cfg.statusPath).then((s) => setConnected(!!s?.connected)).catch(() => {}); }, [cfg.statusPath]);
  React.useEffect(() => { apiGet<typeof bidRules>("/api/freelancer/bid-rules").then((r) => r && setBidRules(r)); }, []);
  React.useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    apiGet<SavedBidDraft[]>("/api/radar/proposals").then((items) => {
      if (alive && items) setSavedDrafts(items.filter((item) => item.status === "draft"));
    });
    return () => { alive = false; };
  }, []);

  const saveBidRules = async () => {
    setRulesSaving(true);
    const res = await apiCall<typeof bidRules>("/api/freelancer/bid-rules", bidRules, "PUT");
    setRulesSaving(false);
    toast(res && res.status < 400
      ? { title: "Bid rules saved", description: "The server will enforce these limits before every bid." }
      : { title: "Couldn't save bid rules", description: "Check the server connection and try again." });
  };

  const scan = async () => {
    setLoading(true);
    const res = await apiGet<{ jobs?: LiveJob[]; projects?: LiveJob[]; live: boolean }>(`${cfg.jobsPath}?q=${encodeURIComponent(q)}&limit=30`);
    const list = res?.jobs ?? res?.projects ?? [];
    setJobs(list);
    setLive(res?.live ?? false);
    setLoading(false);
    if (res) toast({ title: `${list.length} jobs`, description: res.live ? `Live from ${cfg.name}` : "Demo feed — connect a token to go live" });
  };

  const openBid = (j: LiveJob) => {
    setSelected(j);
    const saved = savedDrafts.find((item) => item.jobId === j.id && item.platform === cfg.name);
    setProposal(saved?.body ?? "");
    setProposalId(saved?.id ?? "");
    const base = j.type === "hourly" ? (j.hourlyMax ?? 50)
      : (j.budgetMin != null && j.budgetMax != null ? Math.round((j.budgetMin + j.budgetMax) / 2) : (j.budget ?? j.budgetMax ?? 500));
    setAmount(String(saved?.amount ?? base));
  };

  const draft = async () => {
    if (!selected) return;
    setDrafting(true);
    const payload = platform === "freelancer"
      ? { projectId: selected.id, title: selected.title, description: selected.description, skills: selected.skills, budgetMin: selected.budgetMin, budgetMax: selected.budgetMax, userName: user?.name ?? "" }
      : { jobId: selected.id, title: selected.title, description: selected.description, skills: selected.skills, type: selected.type, budget: selected.budget, hourlyMax: selected.hourlyMax, userName: user?.name ?? "" };
    const res = await apiCall<any>(cfg.preparePath, payload);
    if (res && res.status < 400) {
      setProposal(res.data.proposal);
      setProposalId(res.data.proposalId ?? "");
      const amt = res.data.suggestedAmount ?? res.data.suggestedRate;
      if (amt) setAmount(String(amt));
      if (res.data.proposalId) setSavedDrafts((items) => [{
        id: res.data.proposalId, jobId: selected.id, platform: cfg.name,
        jobTitle: selected.title, body: res.data.proposal, amount: amt, status: "draft",
      }, ...items.filter((item) => item.id !== res.data.proposalId)]);
      if (!res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a template. Edit freely." });
    } else {
      toast({ title: "Couldn't draft the proposal", description: res?.data?.detail ?? "Can't reach the server — try again." });
    }
    setDrafting(false);
  };

  const saveDraft = async () => {
    if (!proposalId || !proposal.trim()) return;
    const res = await apiCall<SavedBidDraft>(`/api/radar/proposals/${encodeURIComponent(proposalId)}`, {
      body: proposal, amount: Number(amount),
    }, "PUT");
    if (res && res.status < 400) {
      setSavedDrafts((items) => items.map((item) => item.id === proposalId
        ? { ...item, body: proposal, amount: Number(amount) }
        : item));
      toast({ title: "Draft saved", description: "Your proposal and amount are saved for this job." });
    } else toast({ title: "Couldn't save draft", description: (res?.data as any)?.detail ?? "Check the backend connection and try again." });
  };

  const place = async () => {
    if (!selected || !proposal) return;
    setPlacing(true);
    const payload = platform === "freelancer"
      ? { projectId: selected.id, amount: Number(amount), periodDays: Number(period), proposal, proposalId, approved: true, matchScore: selected.matchScore ?? 0 }
      : { jobId: selected.id, rate: Number(amount), proposal, proposalId, approved: true };
    const res = await apiCall<any>(cfg.submitPath, payload);
    setPlacing(false);
    if (res?.data?.ok) {
      if (proposalId) setSavedDrafts((items) => items.filter((item) => item.id !== proposalId));
      toast({ title: res.data.live ? `Submitted on ${cfg.name}` : "Recorded (demo)", description: res.data.message, variant: "success" });
      setSelected(null);
    } else {
      toast({ title: "Couldn't submit", description: res?.data?.message ?? res?.data?.detail ?? "Check the connection." });
    }
  };

  return (
    <div className="space-y-4">
      {platform === "freelancer" && <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your bidding limits</CardTitle><CardDescription className="text-xs">Enforced by the server before each bid. Human approval is always required.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1"><Label htmlFor="min-match">Minimum match score</Label><Input id="min-match" type="number" min="0" max="100" value={bidRules.minimumMatchScore} onChange={(e) => setBidRules({ ...bidRules, minimumMatchScore: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label htmlFor="min-budget">Minimum bid ($)</Label><Input id="min-budget" type="number" min="0" value={bidRules.minimumBudget} onChange={(e) => setBidRules({ ...bidRules, minimumBudget: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label htmlFor="daily-cap">Daily bid cap</Label><Input id="daily-cap" type="number" min="0" max="100" value={bidRules.dailyBidCap} onChange={(e) => setBidRules({ ...bidRules, dailyBidCap: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={saveBidRules} disabled={rulesSaving}>{rulesSaving ? "Saving…" : "Save limits"}</Button></div>
        </CardContent>
      </Card>}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 text-white"><Radar className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{cfg.name} — live bidding</p>
            <p className="text-xs text-muted-foreground">
              {connected ? "Connected to your account" : "Demo feed"} · official API · everything needs your approval before it's submitted
            </p>
          </div>
          <Badge variant={live ? "success" : "secondary"}>{live ? cfg.liveLabel : cfg.demoLabel}</Badge>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} placeholder="Skills — react, python, shopify…" />
        </div>
        <Button variant="gradient" onClick={scan} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />} Scan jobs</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {jobs.length === 0 && !loading && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Scan to pull live {cfg.name} jobs.</CardContent></Card>
          )}
          {jobs.map((j: any) => (
            <button key={j.id} onClick={() => openBid(j)}
              className={cn("w-full rounded-xl border bg-card p-3.5 text-left transition-all hover:border-primary/50", selected?.id === j.id && "border-primary ring-1 ring-primary/30")}>
              <p className="text-sm font-medium leading-snug">{j.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{j.type}</Badge>
                {budgetLabel(j) && <span className="font-medium text-foreground">{budgetLabel(j)}</span>}
                <span>· {(j.bidCount ?? j.proposals ?? 0)} bids</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">{j.skills.slice(0, 4).map((s: any) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
            </button>
          ))}
        </div>

        <div className={cn("lg:col-span-3", !selected && "hidden lg:block")}>
          {!selected ? (
            <Card className="flex min-h-72 items-center justify-center"><CardContent className="text-center text-sm text-muted-foreground"><Gavel className="mx-auto mb-3 size-8 text-muted-foreground/50" />Select a job to draft a {platform === "upwork" ? "proposal" : "bid"}.</CardContent></Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{selected.title}</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => window.open(selected.url, "_blank", "noopener")}><ExternalLink className="size-4" /></Button>
                </div>
                <CardDescription>{budgetLabel(selected)} · {(selected.bidCount ?? selected.proposals ?? 0)} bids · {selected.type}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="max-h-28 overflow-y-auto text-sm text-muted-foreground">{selected.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>{selected.type === "hourly" ? "Your rate ($/hr)" : "Your bid ($)"}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                  {platform === "freelancer" && <div className="space-y-1.5"><Label>Delivery (days)</Label><Input type="number" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>}
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">{platform === "upwork" ? "Proposal / cover letter" : "Bid proposal"}</p>
                    <div className="flex items-center gap-1">
                    {API_URL && proposalId && <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => void saveDraft()}><Save className="size-3.5" /> Save</Button>}
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-primary" disabled={drafting} onClick={draft}>
                      {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}{proposal ? "Regenerate" : "AI Draft"}
                    </Button>
                    </div>
                  </div>
                  <Textarea rows={7} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Generate with AI or write your own — nothing is submitted without your approval." />
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="gradient" disabled={!proposal || placing} onClick={place}>
                      {placing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve &amp; submit
                    </Button>
                    <p className="text-xs text-muted-foreground">You approve everything.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
