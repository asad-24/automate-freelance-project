"use client";
import * as React from "react";
import Link from "next/link";
import {
  Radar, Search, Copy, ExternalLink, Loader2, Sparkles, Bookmark,
  BookmarkCheck, X, Flame, Target, CalendarCheck, SlidersHorizontal,
  Plus, Trash2, Send, CheckCircle2, CircleDashed, Briefcase, Trophy,
  MessageCircle, Ghost, FileX, RefreshCw, Zap, PauseCircle, ShieldCheck,
  Save, Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { useDemoStore } from "@/lib/demo-store";
import { API_URL, apiGet, apiCall } from "@/lib/api";
import { cn, formatCurrency, formatRelative } from "@/lib/utils";
import { radarWeeklyCount } from "@/lib/demo-engine";
import { CompanyBoards } from "@/components/dashboard/company-boards";

type Job = {
  id: string; kind?: "job" | "gig"; title: string; company: string; source: string; url: string;
  tags: string[]; budget: number | null; currency?: string | null; description: string;
  postedAt: string; matchScore: number;
};

/** Feeds report budgets in their own currency (EUR, GBP…); never assume dollars. */
const money = (j: { budget?: number | string | null; currency?: string | null }) => {
  const amount = Number(j.budget);
  if (!j.budget || !Number.isFinite(amount)) return "";
  try { return formatCurrency(amount, j.currency || "USD"); } catch { return amount.toLocaleString(); }
};
type SavedSearch = { id: string; name: string; query: string; alertEnabled?: boolean; newSinceLast?: number; lastScanAt?: string };
type ProposalRecord = { id: string; jobId: string; jobTitle: string; body: string; status: string };

/** Automation-engine job record (mirrors /api/automation). */
type ApplyJob = { id: string; status: string; engine?: string; steps: { step: string; status: string; detail?: string }[] };

const AUTO_STEPS = ["Open the job posting", "Read the application form", "Fill your details",
  "Attach resume / portfolio", "Answer screening questions", "Submit the application"];
const simAutoSteps = (approved: boolean) => AUTO_STEPS.map((s, i) =>
  i === AUTO_STEPS.length - 1 && !approved
    ? { step: s, status: "paused", detail: "Awaiting your approval." }
    : { step: s, status: "done" });

const STAGES = ["Saved", "Drafted", "Applied", "Interview", "Won", "Lost", "Ghosted"];
const STAGE_ICON: Record<string, any> = {
  Saved: Bookmark, Drafted: CircleDashed, Applied: Send, Interview: MessageCircle,
  Won: Trophy, Lost: FileX, Ghosted: Ghost,
};

const CHECKLIST = [
  "References a specific detail from the job post",
  "Names your 2–3 step plan (not generic claims)",
  "Mentions budget, timeline or both",
  "Ends with one concrete question",
  "Under 200 words — scannable in 10 seconds",
];

const COPY = {
  job: { title: ["Job ", "Radar"], sub: "Jobs from accessible public feeds and approved APIs, matched to your skills.", feed: "Job Feed", empty: "jobs" },
  gig: { title: ["", "Gigs"], sub: "Freelance listings from accessible feeds, matched to your skills.", feed: "Gig Feed", empty: "gigs" },
} as const;

export function RadarFeed({ kind }: { kind: "job" | "gig" }) {
  const copy = COPY[kind];
  const { toast } = useToast();
  const { user, demoMode } = useAuth();
  const demo = useDemoStore();
  const radar = demo?.state.radar;

  const [skills, setSkills] = React.useState("react, next.js, typescript");
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [remoteSavedJobs, setRemoteSavedJobs] = React.useState<Job[]>([]);
  const [remoteSavedSearches, setRemoteSavedSearches] = React.useState<SavedSearch[]>([]);
  const [sources, setSources] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Job | null>(null);
  const [proposal, setProposal] = React.useState("");
  const [proposalId, setProposalId] = React.useState("");
  const [remoteProposals, setRemoteProposals] = React.useState<ProposalRecord[]>([]);
  const [genLoading, setGenLoading] = React.useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = React.useState("All");
  const [minMatch, setMinMatch] = React.useState(0);
  const [sortBy, setSortBy] = React.useState<"match" | "new">("match");
  const [showSavedOnly, setShowSavedOnly] = React.useState(false);

  // Save-search dialog
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [searchName, setSearchName] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    apiGet<{ skills?: string[] }>("/api/radar/profile").then((profile) => {
      if (alive && profile?.skills?.length) setSkills(profile.skills.join(", "));
    });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    apiGet<ProposalRecord[]>("/api/radar/proposals").then((items) => {
      if (alive && items) setRemoteProposals(items);
    });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    apiGet<{ jobs?: Job[]; searches?: SavedSearch[] }>("/api/radar/saved").then((saved) => {
      if (!alive || !saved) return;
      setRemoteSavedJobs(saved.jobs ?? []);
      setRemoteSavedSearches(saved.searches ?? []);
    });
    return () => { alive = false; };
  }, []);

  const savedJobs = API_URL ? remoteSavedJobs : [];
  const savedSearches: SavedSearch[] = API_URL ? remoteSavedSearches : (radar?.savedSearches ?? []) as SavedSearch[];
  const savedJobIds = API_URL ? savedJobs.map((job) => job.id) : radar?.saved ?? [];

  const toggleSavedJob = async (job: Job) => {
    if (!API_URL) {
      const saved = demo?.radarToggleSaved(job.id);
      toast({ title: saved ? "Saved" : "Unsaved" });
      return;
    }
    const alreadySaved = savedJobIds.includes(job.id);
    const response = await apiCall<{ jobs?: Job[] }>(
      `/api/radar/saved-jobs/${encodeURIComponent(job.id)}`,
      alreadySaved ? {} : job,
      alreadySaved ? "DELETE" : "PUT",
    );
    if (response && response.status < 400) {
      setRemoteSavedJobs(response.data.jobs ?? []);
      toast({ title: alreadySaved ? "Removed from saved jobs" : "Saved for later" });
    } else {
      toast({ title: "Couldn't update saved jobs", description: (response?.data as any)?.detail ?? "Check your connection and try again." });
    }
  };

  const saveSearch = async () => {
    const name = searchName.trim() || "Search";
    const query = skills.trim();
    if (!query) return;
    if (!API_URL) {
      demo?.radarSaveSearch(name, query);
      setSaveOpen(false);
      toast({ title: "Search saved", variant: "success" });
      return;
    }
    const response = await apiCall<{ searches?: SavedSearch[] }>("/api/radar/saved-searches", { name, query, alertEnabled: true });
    if (response && response.status < 400) {
      setRemoteSavedSearches(response.data.searches ?? []);
      setSaveOpen(false);
      toast({ title: "Search saved", description: "Strong matches will be included in scheduled alerts.", variant: "success" });
    } else toast({ title: "Couldn't save search", description: (response?.data as any)?.detail ?? "Check your connection and try again." });
  };

  const removeSearch = async (search: SavedSearch) => {
    if (!API_URL) {
      demo?.radarRemoveSearch(search.id);
      return;
    }
    const response = await apiCall<{ searches?: SavedSearch[] }>(`/api/radar/saved-searches/${encodeURIComponent(search.id)}`, {}, "DELETE");
    if (response && response.status < 400) setRemoteSavedSearches(response.data.searches ?? []);
    else toast({ title: "Couldn't remove search", description: (response?.data as any)?.detail ?? "Check your connection and try again." });
  };

  const scan = async (q?: string) => {
    const query = q ?? skills;
    setLoading(true);
    await apiCall("/api/radar/profile", { skills: query.split(",").map((s) => s.trim()).filter(Boolean) }, "PUT");
    const res = await apiGet<{ jobs: Job[]; sources: string[]; fetchedAt: string }>(
      `/api/radar/jobs?q=${encodeURIComponent(query)}&limit=60&kind=${kind}`
    );
    const fresh = res?.jobs ?? [];
    setJobs(fresh);
    setSources(res?.sources ?? []);
    const cutoff = radar?.lastVisitAt ? Date.parse(radar.lastVisitAt) : 0;
    const newCount = fresh.filter((j: any) => Date.parse(j.postedAt || "") > cutoff).length;
    demo?.radarRecordScan(query, newCount);
    setLoading(false);
    if (res) toast({ title: `${fresh.length} jobs found`, description: newCount > 0 ? `${newCount} posted since your last visit` : "All caught up — nothing new since last scan" });
    else toast({ title: "Scan failed", description: "Backend unreachable — start the API or check connection." });
  };

  const generate = async (job: Job) => {
    setGenLoading(true);
    const res = await apiCall<{ proposal: string; proposalId: string; aiGenerated: boolean }>("/api/radar/proposal", {
      jobId: job.id, jobTitle: job.title, jobDescription: job.description, jobUrl: job.url,
      platform: job.source, matchScore: job.matchScore, skills, userName: user?.name ?? "",
    });
    if (res?.data?.proposal) {
      setProposal(res.data.proposal);
      setProposalId(res.data.proposalId ?? "");
      if (res.data.proposalId) setRemoteProposals((items) => [{
        id: res.data.proposalId, jobId: job.id, jobTitle: job.title, body: res.data.proposal, status: "draft",
      }, ...items.filter((item) => item.id !== res.data.proposalId)]);
      demo?.radarTrackJob(job, "Drafted", res.data.proposal);
      if (!res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a template. Edit freely." });
    } else toast({ title: "Couldn't generate", description: "Backend/AI unavailable." });
    setGenLoading(false);
  };

  const saveProposal = async () => {
    if (!proposalId || !proposal.trim()) return;
    const res = await apiCall<ProposalRecord>(`/api/radar/proposals/${encodeURIComponent(proposalId)}`, { body: proposal }, "PUT");
    if (res && res.status < 400) {
      setRemoteProposals((items) => items.map((item) => item.id === proposalId ? { ...item, body: proposal } : item));
      toast({ title: "Proposal draft saved" });
    } else toast({ title: "Couldn't save proposal", description: (res?.data as any)?.detail ?? "Check the backend connection and try again." });
  };

  const selectJob = (job: Job) => {
    const trackedJob = tracked(job.id);
    const savedProposal = remoteProposals.find((item) => item.jobId === job.id && item.status === "draft");
    setSelected(job);
    setProposal(savedProposal?.body ?? trackedJob?.proposal ?? "");
    setProposalId(savedProposal?.id ?? "");
  };

  const copyProposal = () => {
    navigator.clipboard.writeText(proposal).then(() => toast({ title: "Proposal copied", variant: "success" })).catch(() => {});
  };

  const markApplied = (job: Job) => {
    demo?.radarTrackJob(job, "Applied", proposal);
    toast({ title: "Marked applied", description: "Tracked in your pipeline — good luck.", variant: "success" });
  };

  // --- Auto-apply via the Automation Engine (pauses before submit for approval) ---
  const [applyJobs, setApplyJobs] = React.useState<Record<string, ApplyJob>>({});
  const [applyBusy, setApplyBusy] = React.useState<string | null>(null);

  const autoApply = async (job: Job) => {
    setApplyBusy(job.id);
    const res = await apiCall<ApplyJob>("/api/automation/jobs", {
      kind: "auto_apply", platform: job.source,
      title: `${job.title} @ ${job.company}`, url: job.url,
      instructions: proposal ? `Use this proposal/cover letter: ${proposal}` : "Fill the application with my profile.",
      fields: { proposal, company: job.company, skills },
    });
    if (!res && !demoMode) {
      setApplyBusy(null);
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    setApplyBusy(null);
    if (res && res.status >= 400) {
      toast({ title: "Couldn't prepare the application", description: (res.data as any)?.detail ?? "Please try again." });
      return;
    }
    setApplyJobs((p) => ({ ...p, [job.id]: res?.data ?? { id: `local-${job.id}`, status: "needs_approval", engine: "simulation", steps: simAutoSteps(false) } }));
    demo?.radarTrackJob(job, "Drafted", proposal);
    toast({ title: "Auto-apply prepared", description: "Every step is ready — review it before approving." });
  };

  const approveApply = async (job: Job) => {
    const aj = applyJobs[job.id];
    if (!aj) return;
    setApplyBusy(job.id);
    const res = await apiCall<ApplyJob>(`/api/automation/jobs/${aj.id}/approve`, {});
    if (!res && !demoMode) {
      setApplyBusy(null);
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    setApplyBusy(null);
    if (res && res.status >= 400) {
      toast({
        title: res.status === 402 ? "Out of bid credits" : "Couldn't approve",
        description: (res.data as any)?.detail ?? "Please try again.",
      });
      return;
    }
    const done: ApplyJob = res?.data ?? { ...aj, status: "completed", steps: simAutoSteps(true) };
    setApplyJobs((p) => ({ ...p, [job.id]: done }));
    if (done.status !== "completed") {
      toast({ title: "Application not sent", description: done.steps.find((st) => st.status === "failed")?.detail ?? "The automation didn't finish." });
    } else if (done.engine === "worker") {
      demo?.radarTrackJob(job, "Applied", proposal);
      toast({ title: "Application submitted", description: "Tracked as Applied in your pipeline.", variant: "success" });
    } else {
      toast({ title: "Simulation finished — nothing was sent", description: "Open the job and apply with your drafted proposal." });
    }
  };

  const cancelApply = async (job: Job) => {
    const aj = applyJobs[job.id];
    if (!aj) return;
    const res = await apiCall<ApplyJob>(`/api/automation/jobs/${aj.id}/cancel`, {});
    if (!res && !demoMode) {
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    if (res && res.status >= 400) {
      toast({ title: "Couldn't cancel", description: (res.data as any)?.detail ?? "Please try again." });
      return;
    }
    setApplyJobs((p) => ({ ...p, [job.id]: res?.data ?? { ...aj, status: "cancelled" } }));
  };

  const isNew = (j: Job) => radar?.lastVisitAt ? Date.parse(j.postedAt || "") > Date.parse(radar.lastVisitAt) - 3600e3 : false;
  const tracked = (jobId: string) => radar?.applications.find((a: any) => a.jobId === jobId);

  const feedJobs = showSavedOnly && API_URL ? savedJobs.filter((job) => !job.kind || job.kind === kind) : jobs;
  const filtered = feedJobs
    .filter((j: any) => !(radar?.dismissed ?? []).includes(j.id))
    .filter((j: any) => (sourceFilter === "All" || j.source === sourceFilter))
    .filter((j: any) => j.matchScore >= minMatch)
    .filter((j: any) => !showSavedOnly || savedJobIds.includes(j.id))
    .sort((a, b) => sortBy === "new"
      ? Date.parse(b.postedAt || "0") - Date.parse(a.postedAt || "0")
      : b.matchScore - a.matchScore);

  const weekly = radar ? radarWeeklyCount(demo!.state) : 0;
  const goal = radar?.weeklyGoal ?? 10;
  const apps = radar?.applications ?? [];

  const stageStats = STAGES.map((s: any) => ({ s, n: apps.filter((a: any) => a.stage === s).length }));

  return (
    <div className="space-y-4">
      {/* Header + streak/goal strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{copy.title[0]}<span className="gradient-text">{copy.title[1]}</span></h1>
          <p className="text-sm text-muted-foreground">{copy.sub}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1.5 text-xs">
            <Flame className={cn("size-3.5", (radar?.scanStreak ?? 0) > 0 ? "text-orange-500" : "text-muted-foreground")} />
            {radar?.scanStreak ?? 0}d streak
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1.5 text-xs">
            <Target className="size-3.5 text-primary" /> {weekly}/{goal} this week
          </Badge>
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" asChild><Link href="/dashboard/accounts?action=builder"><Sparkles className="size-4" /> Gig Builder</Link></Button>
          <Button size="sm" variant="outline" className="flex-1 sm:flex-none" asChild><Link href="/dashboard/accounts?action=gig"><Plus className="size-4" /> Publish Gig</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed"><Radar className="mr-1.5 size-4" />{copy.feed}</TabsTrigger>
          <TabsTrigger value="tracker"><Briefcase className="mr-1.5 size-4" />Pipeline{apps.length > 0 && ` (${apps.length})`}</TabsTrigger>
          <TabsTrigger value="searches"><Bookmark className="mr-1.5 size-4" />Saved Searches{savedSearches.length ? ` (${savedSearches.length})` : ""}</TabsTrigger>
          {API_URL && <TabsTrigger value="companies"><Building2 className="mr-1.5 size-4" />Companies</TabsTrigger>}
        </TabsList>

        {/* ==================== FEED ==================== */}
        <TabsContent value="feed" className="space-y-4">
          {/* Scan hero */}
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-purple-500/[0.05]">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 text-white shadow-lg shadow-primary/25">
                  <Radar className={cn("size-5", loading && "animate-pulse")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{loading ? "Scanning enabled job feeds…" : jobs.length ? `${jobs.length} results from ${sources.length} active sources` : "Scan accessible sources in one click"}</p>
                  <p className="text-xs text-muted-foreground">Public feeds are available now; platform feeds appear only when configured and approved.</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <div className="relative min-w-0 flex-1 sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-10 pl-9" value={skills} onChange={(e) => setSkills(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && scan()}
                      placeholder="Skills — e.g. react, python, figma" />
                  </div>
                  <Button variant="gradient" size="lg" onClick={() => scan()} disabled={loading} className="shrink-0">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />} {loading ? "Scanning…" : "Scan now"}
                  </Button>
                  <Button variant="outline" size="lg" className="shrink-0" onClick={() => { setSearchName(skills.split(",")[0] || "My search"); setSaveOpen(true); }}>
                    <Plus className="size-4" /> <span className="hidden sm:inline">Save search</span>
                  </Button>
                </div>
              </div>
              {/* Quick skill presets */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Quick scans:</span>
                {["react, next.js, typescript", "python, django, api", "figma, ui design, logo", "shopify, ecommerce", "wordpress", "copywriting, content", "mobile app, flutter"].map((q: any) => (
                  <button key={q} onClick={() => { setSkills(q); scan(q); }}
                    className={cn("rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary",
                      skills === q ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                    {q.split(",")[0]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          {jobs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-8 w-44 text-xs">
                <option value="All">All sources</option>
                {sources.map((s: any) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as "match" | "new")} className="h-8 w-36 text-xs">
                <option value="match">Best match</option>
                <option value="new">Newest first</option>
              </Select>
              <Select value={String(minMatch)} onChange={(e) => setMinMatch(Number(e.target.value))} className="h-8 w-36 text-xs">
                <option value="0">Any match</option>
                <option value="50">50%+ match</option>
                <option value="70">70%+ match</option>
                <option value="85">85%+ match</option>
              </Select>
              <Button size="sm" variant={showSavedOnly ? "default" : "outline"} onClick={() => setShowSavedOnly(!showSavedOnly)}>
                <BookmarkCheck className="size-3.5" /> Saved ({savedJobIds.length})
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">{filtered.length} jobs</span>
            </div>
          )}

          {/* Split pane: feed + detail */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-2">
              {filtered.length === 0 && !loading && (
                <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <Radar className="size-10 text-muted-foreground/40" />
                  {jobs.length === 0
                    ? <><p className="font-medium text-foreground">No jobs yet</p><p>Hit <span className="font-medium text-primary">Scan now</span> to search accessible feeds and rank results by fit.</p></>
                    : "No jobs match these filters."}
                </CardContent></Card>
              )}
              {loading && filtered.length === 0 && (
                <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p>Scanning public feeds and any platform feeds enabled for this workspace…</p>
                </CardContent></Card>
              )}
              {filtered.map((j: any) => {
                const t = tracked(j.id);
                const saved = savedJobIds.includes(j.id);
                const fresh = isNew(j);
                return (
                  <button key={j.id} onClick={() => selectJob(j)}
                    className={cn(
                      "w-full rounded-xl border bg-card p-3.5 text-left transition-all hover:border-primary/50",
                      selected?.id === j.id && "border-primary ring-1 ring-primary/30"
                    )}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{j.title}</p>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        j.matchScore >= 80 ? "bg-success/15 text-success" : j.matchScore >= 60 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}>{j.matchScore}%</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{j.company}</span>·<span>{j.source}</span>
                      {money(j) ? <span className="font-medium text-foreground">{money(j)}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {fresh && <Badge variant="default" className="h-5 px-1.5 text-[10px]">NEW</Badge>}
                      {t && <Badge variant="success" className="h-5 px-1.5 text-[10px]">{t.stage}</Badge>}
                      {applyJobs[j.id]?.status === "needs_approval" && (
                        <Badge variant="warning" className="h-5 gap-1 px-1.5 text-[10px]"><PauseCircle className="size-3" /> Approve</Badge>
                      )}
                      {applyJobs[j.id]?.status === "completed" && (
                        <Badge variant="success" className="h-5 gap-1 px-1.5 text-[10px]"><Zap className="size-3" /> Auto-applied</Badge>
                      )}
                      {saved && <BookmarkCheck className="size-3.5 text-primary" />}
                      <span className="ml-auto text-[10px] text-muted-foreground">{j.postedAt ? formatRelative(j.postedAt) : ""}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail + composer */}
            <div className={cn("lg:col-span-3", !selected && "hidden lg:block")}>
              {!selected ? (
                <Card className="flex min-h-72 items-center justify-center">
                  <CardContent className="text-center text-sm text-muted-foreground">
                    <Radar className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                    Select a job to see details and draft a proposal.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base leading-snug">{selected.title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{selected.company} · {selected.source}{money(selected) ? ` · ${money(selected)}` : ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="Save for later"
                          onClick={() => void toggleSavedJob(selected)}>
                          {savedJobIds.includes(selected.id) ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" title="Hide this job"
                          onClick={() => { demo?.radarDismiss(selected.id); setSelected(null); }}>
                          <X className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => window.open(selected.url, "_blank", "noopener")}>
                          <ExternalLink className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {selected.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selected.tags.slice(0, 6).map((t: any) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="max-h-32 overflow-y-auto text-sm text-muted-foreground">{selected.description}</p>

                    {/* Proposal composer */}
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">Proposal draft</p>
                        <div className="flex items-center gap-1">
                        {API_URL && proposalId && <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => void saveProposal()}><Save className="size-3.5" /> Save</Button>}
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-primary" disabled={genLoading} onClick={() => generate(selected)}>
                          {genLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                          {proposal ? "Regenerate" : "AI Draft"}
                        </Button>
                        </div>
                      </div>
                      <Textarea rows={7} value={proposal} onChange={(e) => setProposal(e.target.value)}
                        placeholder="Generate with AI or write your own — nothing sends without you." />
                      {/* Quality checklist */}
                      <div className="mt-3 space-y-1">
                        {CHECKLIST.map((c: any) => (
                          <p key={c} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <CheckCircle2 className="size-3 text-success/70" /> {c}
                          </p>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={!proposal} onClick={copyProposal}><Copy className="size-4" /> Copy</Button>
                        <Button size="sm" variant="outline" onClick={() => window.open(selected.url, "_blank", "noopener")}>
                          <ExternalLink className="size-4" /> Open job
                        </Button>
                        <Button size="sm" variant="outline" disabled={!proposal} onClick={() => markApplied(selected)}>
                          <Send className="size-4" /> Mark applied
                        </Button>
                        <Button size="sm" variant="gradient" disabled={applyBusy === selected.id || !!applyJobs[selected.id]}
                          onClick={() => autoApply(selected)}>
                          {applyBusy === selected.id ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Auto-apply
                        </Button>
                      </div>

                      {/* Automation-engine progress — pauses before submit for approval */}
                      {(() => { const aj = applyJobs[selected.id]; if (!aj) return null;
                        return (
                          <div className={cn("mt-3 rounded-lg border p-3", aj.status === "needs_approval" ? "border-warning/30 bg-warning/5" : "bg-muted/30")}>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                              <Zap className="size-3.5 text-primary" /> Automation engine
                              {aj.engine !== "worker" && <Badge variant="secondary" className="text-[10px]">Simulated</Badge>}
                              <span className="ml-auto capitalize text-muted-foreground">{aj.status.replace("_", " ")}</span>
                            </p>
                            <div className="space-y-1">
                              {aj.steps.map((s, i) => (
                                <p key={i} className="flex items-center gap-1.5 text-[11px]">
                                  {s.status === "done" ? <CheckCircle2 className="size-3 shrink-0 text-success" />
                                    : s.status === "paused" ? <PauseCircle className="size-3 shrink-0 text-warning" />
                                    : s.status === "failed" ? <X className="size-3 shrink-0 text-destructive" />
                                    : <CircleDashed className="size-3 shrink-0 text-muted-foreground" />}
                                  <span className={cn(s.status === "paused" && "font-medium text-warning")}>{s.step}</span>
                                </p>
                              ))}
                            </div>
                            {aj.status === "needs_approval" && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <ShieldCheck className="size-4 shrink-0 text-warning" />
                                <p className="flex-1 text-[11px] text-muted-foreground">Prepared — approve to submit on your account.</p>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelApply(selected)}>Cancel</Button>
                                <Button size="sm" variant="gradient" className="h-7 text-xs" disabled={applyBusy === selected.id} onClick={() => approveApply(selected)}>
                                  {applyBusy === selected.id ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} Approve &amp; submit
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ==================== PIPELINE ==================== */}
        <TabsContent value="tracker" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {stageStats.map(({ s, n }) => {
              const Icon = STAGE_ICON[s];
              return (
                <div key={s} className="rounded-xl border bg-card p-3 text-center">
                  <Icon className={cn("mx-auto mb-1 size-4", s === "Won" ? "text-success" : s === "Lost" || s === "Ghosted" ? "text-muted-foreground" : "text-primary")} />
                  <p className="text-lg font-bold">{n}</p>
                  <p className="text-[11px] text-muted-foreground">{s}</p>
                </div>
              );
            })}
          </div>

          {apps.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No tracked jobs yet — save or apply to jobs from the feed and they'll show up here.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {apps.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.company} · {a.source}{money(a) ? ` · ${money(a)}` : ""} · {formatRelative(a.appliedAt)}</p>
                    </div>
                    <Select value={a.stage} onChange={(e) => demo?.radarPatchApp(a.id, { stage: e.target.value })} className="h-8 w-32 text-xs">
                      {STAGES.map((s: any) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <div className="flex gap-1">
                      {a.url && <Button size="sm" variant="ghost" onClick={() => window.open(a.url, "_blank", "noopener")}><ExternalLink className="size-4" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => demo?.radarRemoveApp(a.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== SAVED SEARCHES ==================== */}
        {API_URL && <TabsContent value="companies" className="space-y-4">
          <CompanyBoards />
        </TabsContent>}

        <TabsContent value="searches" className="space-y-4">
          {savedSearches.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No saved searches — run a scan, then hit "Save search" to re-run it anytime and get new-job counts.
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedSearches.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.query}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => void removeSearch(s)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {(s.newSinceLast ?? 0) > 0
                          ? <span className="font-semibold text-success">+{s.newSinceLast} new</span>
                          : s.lastScanAt ? `Scanned ${formatRelative(s.lastScanAt)}` : "Never scanned"}
                      </div>
                      <Button size="sm" variant="outline" disabled={loading} onClick={() => { setSkills(s.query); scan(s.query); }}>
                        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Scan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Save search dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogHeader>
          <DialogTitle>Save this search</DialogTitle>
          <DialogDescription>Re-run it anytime and see how many new jobs appeared since your last scan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="React gigs" /></div>
          <div className="space-y-1.5"><Label>Skills / keywords</Label><Input value={skills} onChange={(e) => setSkills(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button onClick={() => void saveSearch()}>Save</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
