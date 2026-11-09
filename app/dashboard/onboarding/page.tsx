"use client";
import * as React from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, FileText, ListChecks, Sparkles, User } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Client", icon: User },
  { id: 2, label: "Project", icon: Building2 },
  { id: 3, label: "Milestones", icon: ListChecks },
  { id: 4, label: "Review", icon: FileText },
];

type Milestone = { title: string; amount: string; due: string };

export default function OnboardingPage() {
  const { toast } = useToast();
  const [step, setStep] = React.useState(1);
  const [done, setDone] = React.useState<any>(null);
  const [form, setForm] = React.useState({
    clientName: "", company: "", source: "Referral",
    projectTitle: "", projectValue: "", due: "2026-12-01",
  });
  const [milestones, setMilestones] = React.useState<Milestone[]>([
    { title: "", amount: "", due: "2026-12-01" },
  ]);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setMs(i: number, k: keyof Milestone, v: string) {
    setMilestones((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  }

  async function submit() {
    const res = await apiPost<any>("/api/onboarding", {
      clientName: form.clientName,
      company: form.company,
      source: form.source,
      projectTitle: form.projectTitle,
      projectValue: Number(form.projectValue) || 0,
      due: form.due,
      milestones: milestones.filter((m: any) => m.title.trim()).map((m: any) => ({
        title: m.title, amount: Number(m.amount) || 0, due: m.due,
      })),
    });
    if (res?.ok) {
      toast({ title: `${form.company} onboarded — contract created`, variant: "success" });
      setDone(res);
    } else {
      toast({ title: "Backend unreachable — check the API is running" });
    }
  }

  if (done) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client Onboarded" description="The client is now live in the system." />
        <Card className="mx-auto max-w-lg border-success/30">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="rounded-full bg-success/10 p-4"><CheckCircle2 className="size-8 text-success" /></div>
            <div>
              <p className="text-lg font-semibold">{done.client.company}</p>
              <p className="text-sm text-muted-foreground">
                {done.contract.title} · ${done.contract.value.toLocaleString()} · {done.contract.milestonesTotal} milestones
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild><Link href="/dashboard/clients">View in CRM</Link></Button>
              <Button variant="outline" asChild><Link href="/dashboard/command">Command Center</Link></Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setDone(null); setStep(1); }}>Onboard another client</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Onboarding"
        description="Bring a new client into the system — client record, contract, and milestones created in one flow."
      />

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              aria-current={step === s.id ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                step === s.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : step > s.id
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-border text-muted-foreground"
              )}
            >
              <s.icon className="size-4" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-4 bg-border sm:w-8" />}
          </React.Fragment>
        ))}
      </div>

      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{steps[step - 1].label} details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Client contact name</Label>
                <Input placeholder="e.g. Marcus Reed" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input placeholder="e.g. Platinum Sound Records" value={form.company} onChange={(e) => set("company", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <div className="flex flex-wrap gap-2">
                  {["Referral", "Upwork", "B2B Direct", "Reddit", "Inbound"].map((s: any) => (
                    <Badge
                      key={s}
                      variant="outline"
                      onClick={() => set("source", s)}
                      className={cn("cursor-pointer", form.source === s && "border-primary bg-primary/10 text-primary")}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label>Project title</Label>
                <Input placeholder="e.g. AI Music Production Hub (MVP)" value={form.projectTitle} onChange={(e) => set("projectTitle", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Contract value ($)</Label>
                  <Input type="number" placeholder="24000" value={form.projectValue} onChange={(e) => set("projectValue", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery due</Label>
                  <Input type="date" value={form.due} onChange={(e) => set("due", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">Define payment milestones — each becomes an escrow-backed invoice.</p>
              {milestones.map((m, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                  <Input placeholder={`Milestone ${i + 1} title`} value={m.title} onChange={(e) => setMs(i, "title", e.target.value)} className="sm:col-span-1" />
                  <Input type="number" placeholder="Amount ($)" value={m.amount} onChange={(e) => setMs(i, "amount", e.target.value)} />
                  <Input type="date" value={m.due} onChange={(e) => setMs(i, "due", e.target.value)} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setMilestones((ms) => [...ms, { title: "", amount: "", due: form.due }])}>
                + Add milestone
              </Button>
            </>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-4 space-y-1.5">
                <p><span className="text-muted-foreground">Client:</span> <span className="font-medium">{form.clientName}</span> — {form.company}</p>
                <p><span className="text-muted-foreground">Project:</span> <span className="font-medium">{form.projectTitle}</span></p>
                <p><span className="text-muted-foreground">Value:</span> <span className="font-medium">${(Number(form.projectValue) || 0).toLocaleString()}</span> · due {form.due}</p>
              </div>
              <div className="space-y-1.5">
                {milestones.filter((m: any) => m.title.trim()).map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>{m.title}</span>
                    <span className="text-muted-foreground">${(Number(m.amount) || 0).toLocaleString()} · {m.due}</span>
                  </div>
                ))}
                {milestones.every((m: any) => !m.title.trim()) && <p className="text-muted-foreground">No milestones — a single delivery milestone will be implied.</p>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next <ArrowRight className="size-4" /></Button>
            ) : (
              <Button onClick={submit}><Sparkles className="size-4" /> Create client &amp; project</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
