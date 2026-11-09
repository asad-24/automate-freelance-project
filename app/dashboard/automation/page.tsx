"use client";
import * as React from "react";
import {
  Bot, Loader2, CheckCircle2, CircleDashed, PauseCircle, XCircle, Play, Plus, ShieldCheck, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiCall } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, formatRelative } from "@/lib/utils";

type Step = { step: string; status: string; detail?: string };
type Job = {
  id: string; kind: string; platform: string; title: string; url: string;
  status: string; steps: Step[]; engine?: string; createdAt: string; updatedAt: string;
};

const KINDS = [
  { v: "auto_apply", label: "Auto-apply to a job" },
  { v: "post_gig", label: "Post a gig" },
  { v: "send_message", label: "Send a message" },
  { v: "custom", label: "Custom task" },
];

/** Mirrors the backend's step plans so the frontend-only demo works without a server. */
const PLANS: Record<string, string[]> = {
  auto_apply: ["Open the job posting", "Read the application form", "Fill your details",
    "Attach resume / portfolio", "Answer screening questions", "Submit the application"],
  post_gig: ["Open the gig form", "Fill title, description, packages", "Add tags & FAQ", "Publish the gig"],
  send_message: ["Open the thread", "Compose the reply", "Send the message"],
  custom: ["Plan the task", "Execute browser actions", "Complete the final action"],
};

function simSteps(kind: string, approved: boolean): Step[] {
  const plan = PLANS[kind] ?? PLANS.custom;
  return plan.map((s, i) =>
    i === plan.length - 1 && !approved
      ? { step: s, status: "paused", detail: "Awaiting your approval." }
      : { step: s, status: "done" });
}

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  running: { label: "Running", cls: "text-primary bg-primary/10", icon: Loader2 },
  needs_approval: { label: "Needs approval", cls: "text-warning bg-warning/10", icon: PauseCircle },
  completed: { label: "Completed", cls: "text-success bg-success/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "text-muted-foreground bg-muted", icon: XCircle },
  failed: { label: "Failed", cls: "text-destructive bg-destructive/10", icon: XCircle },
};

export default function AutomationPage() {
  const { toast } = useToast();
  const { demoMode } = useAuth();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [status, setStatus] = React.useState<{ workerConfigured: boolean; engine: string; note?: string } | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [approving, setApproving] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ kind: "auto_apply", platform: "", title: "", url: "", instructions: "" });

  const load = React.useCallback(async () => {
    const [j, s] = await Promise.all([
      apiGet<Job[]>("/api/automation/jobs"),
      apiGet<any>("/api/automation/status"),
    ]);
    setJobs(Array.isArray(j) ? j : []);
    setStatus(s ?? null);
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.title.trim() && !form.url.trim() && !form.instructions.trim()) return;
    setBusy(true);
    const res = await apiCall<Job>("/api/automation/jobs", form);
    setBusy(false);
    if (!res && !demoMode) {
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    if (res && res.status >= 400) {
      toast({ title: "Couldn't queue the task", description: (res.data as any)?.detail ?? "Please try again." });
      return;
    }
    const job: Job = res?.data ?? {
      id: `job-local-${Date.now()}`, kind: form.kind, platform: form.platform,
      title: form.title || form.kind, url: form.url, status: "needs_approval",
      steps: simSteps(form.kind, false), engine: "simulation",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setJobs((p) => [job, ...p]);
    setOpen(false);
    setForm({ kind: "auto_apply", platform: "", title: "", url: "", instructions: "" });
    toast({ title: "Task queued", description: "Prepared — review the steps and approve the final action.", variant: "success" });
  };

  const approve = async (id: string) => {
    setApproving(id);
    const res = await apiCall<Job>(`/api/automation/jobs/${id}/approve`, {});
    setApproving(null);
    if (!res && !demoMode) {
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    if (res && res.status >= 400) {
      toast({
        title: res.status === 402 ? "Out of bid credits" : "Couldn't approve",
        description: (res.data as any)?.detail ?? "Please try again.",
      });
      if (res.status === 409) void load();
      return;
    }
    setJobs((p) => p.map((j: any) => (j.id === id
      ? (res?.data ?? { ...j, status: "completed", steps: simSteps(j.kind, true), updatedAt: new Date().toISOString() })
      : j)));
    const status = res?.data?.status ?? "completed";
    if (status !== "completed") {
      toast({ title: "Task didn't finish", description: "See the failed step for details." });
    } else if (res?.data?.engine === "worker") {
      toast({ title: "Approved — task completed", variant: "success" });
    } else {
      toast({ title: "Simulation finished — nothing was sent" });
    }
  };

  const cancel = async (id: string) => {
    const res = await apiCall<Job>(`/api/automation/jobs/${id}/cancel`, {});
    if (!res && !demoMode) {
      toast({ title: "Can't reach the server", description: "Nothing was changed — try again." });
      return;
    }
    if (res && res.status >= 400) {
      toast({ title: "Couldn't cancel", description: (res.data as any)?.detail ?? "Please try again." });
      return;
    }
    setJobs((p) => p.map((j: any) => (j.id === id
      ? (res?.data ?? { ...j, status: "cancelled", updatedAt: new Date().toISOString() })
      : j)));
  };

  const pending = jobs.filter((j: any) => j.status === "needs_approval").length;

  return (
    <>
      <PageHeader
        title="Automation Engine"
        description="Browser automation that does the work on your own accounts — and always stops for your approval before anything is sent."
        actions={<Button variant="gradient" onClick={() => setOpen(true)}><Plus className="size-4" /> New task</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="size-5" /></div>
          <div><p className="text-xs text-muted-foreground">Engine</p><p className="font-semibold capitalize">{status?.engine ?? "…"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-warning/10 text-warning"><PauseCircle className="size-5" /></div>
          <div><p className="text-xs text-muted-foreground">Awaiting your approval</p><p className="font-semibold">{pending}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-success/10 text-success"><ShieldCheck className="size-5" /></div>
          <div><p className="text-xs text-muted-foreground">Human-approved</p><p className="font-semibold">Always on</p></div>
        </CardContent></Card>
      </div>

      {!status?.workerConfigured && (
        <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Running in <span className="font-medium text-foreground">simulation mode</span> — the queue and approval flow work, but nothing is sent.{" "}
          {status?.note ?? "Real browser automation needs the worker service."}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {jobs.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Zap className="size-8 text-muted-foreground/40" />
            <p>No automation tasks yet. Queue one — it prepares everything, then waits for your approval before the final action.</p>
          </CardContent></Card>
        )}
        {jobs.map((j: any) => {
          const st = STATUS[j.status] ?? STATUS.running;
          const StIcon = st.icon;
          return (
            <Card key={j.id}>
              <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {j.title}
                    {j.engine !== "worker" && <Badge variant="secondary">Simulated</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {KINDS.find((k: any) => k.v === j.kind)?.label ?? j.kind}{j.platform && ` · ${j.platform}`} · {formatRelative(j.updatedAt)}
                  </CardDescription>
                </div>
                <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", st.cls)}>
                  <StIcon className={cn("size-3.5", j.status === "running" && "animate-spin")} /> {st.label}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  {j.steps.map((s: any, i: any) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {s.status === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                        : s.status === "paused" ? <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                        : s.status === "failed" ? <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <span className={cn(s.status === "paused" && "font-medium text-warning")}>{s.step}</span>
                        {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {j.status === "needs_approval" && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <ShieldCheck className="size-4 text-warning" />
                    <p className="flex-1 text-sm">Prepared and paused before the final step. Approve to let it finish on your account.</p>
                    <Button size="sm" variant="ghost" onClick={() => cancel(j.id)}>Cancel</Button>
                    <Button size="sm" variant="gradient" disabled={approving === j.id} onClick={() => approve(j.id)}>
                      {approving === j.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Approve &amp; finish
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>New automation task</DialogTitle>
          <DialogDescription>It prepares everything in a real browser on your account, then pauses for your approval before sending.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Task type</Label>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k: any) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Platform (optional)</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="Upwork, LinkedIn…" /></div>
            <div className="space-y-1.5"><Label>Label</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior React role @ Acme" /></div>
          </div>
          <div className="space-y-1.5"><Label>URL (optional)</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
          <div className="space-y-1.5"><Label>Instructions (optional)</Label><Textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Anything specific the agent should do or say." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="gradient" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Queue task
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
