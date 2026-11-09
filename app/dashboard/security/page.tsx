"use client";
import { useToast } from "@/components/ui/toast";
import { KeyRound, Lock, RotateCcw, ShieldAlert, ShieldCheck, ShieldHalf, Copy, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntityQuery } from "@/lib/use-entity";
import { apiPost } from "@/lib/api";
import {
  apiCredentials as credSeed, securityControls as controlsSeed,
  securityEvents as eventsSeed,
} from "@/lib/mock-data";

const statusTone: Record<string, string> = {
  Connected: "text-success bg-success/10 border-success/30",
  Pending: "text-warning bg-warning/10 border-warning/30",
  Standby: "text-muted-foreground bg-muted border-border",
};

const controlTone: Record<string, string> = {
  Enforced: "text-success bg-success/10 border-success/30",
  Configured: "text-primary bg-primary/10 border-primary/30",
  "In progress": "text-warning bg-warning/10 border-warning/30",
  Planned: "text-muted-foreground bg-muted border-border",
};

const sevTone: Record<string, string> = {
  info: "text-primary bg-primary/10 border-primary/30",
  warning: "text-warning bg-warning/10 border-warning/30",
  critical: "text-destructive bg-destructive/10 border-destructive/30",
};

export default function SecurityPage() {
  const { toast } = useToast();
  const { data: credentials, refresh } = useEntityQuery("credentials", credSeed);
  const { data: security } = useEntityQuery("security", {
    controls: controlsSeed, events: eventsSeed,
    enforced: controlsSeed.filter((c: any) => c.status === "Enforced").length,
    total: controlsSeed.length,
  } as any);
  const sec = security as any;
  const controls = sec.controls ?? controlsSeed;
  const events = sec.events ?? eventsSeed;

  const connected = credentials.filter((c: any) => c.status === "Connected").length;
  const enforcedPct = Math.round(((sec.enforced ?? 0) / Math.max(sec.total ?? 1, 1)) * 100);
  const score = Math.round((enforcedPct + (connected / Math.max(credentials.length, 1)) * 100) / 2);
  const openIssues = controls.filter((c: any) => c.status !== "Enforced").length;

  async function rotate(cred: any) {
    const res = await apiPost<any>(`/api/credentials/${cred.id}/rotate`);
    if (res?.lastRotated) { toast({ title: `${cred.service} key rotated`, variant: "success" }); refresh(); }
  }
  async function toggle(cred: any) {
    const res = await apiPost<any>(`/api/credentials/${cred.id}/toggle`);
    if (res) { toast({ title: `${cred.service} → ${res.status}`, variant: "success" }); refresh(); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Security & API" description="Your credential vault, security posture and access — centrally managed." />

      {/* Security score hero */}
      <Card className="overflow-hidden bg-gradient-to-br from-success/10 via-card to-card">
        <CardContent className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center">
          {/* Score ring */}
          <div className="relative grid size-24 shrink-0 place-items-center">
            <svg viewBox="0 0 36 36" className="size-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--success))" strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <div className="absolute text-center"><p className="text-2xl font-bold">{score}</p><p className="text-[10px] text-muted-foreground">score</p></div>
          </div>
          <div className="flex-1">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-success" /> Strong security posture</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected}/{credentials.length} services connected · {sec.enforced}/{sec.total} controls enforced
              {openIssues > 0 && ` · ${openIssues} to finish`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="success" className="gap-1"><Lock className="size-3" /> Vault-secured</Badge>
              <Badge variant="outline">2FA enforced</Badge>
              <Badge variant="outline">Keys masked</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => toast({ title: "Security scan started", description: "Full posture check running…" })}>Run scan</Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">All credentials are managed by your vault</p>
            <p className="mt-0.5 text-muted-foreground">
              Keys live in environment variables / a secrets manager — never in the repo, never in logs, masked everywhere in the UI.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="vault">
        <TabsList>
          <TabsTrigger value="vault"><KeyRound className="mr-1.5 size-3.5" /> API Vault</TabsTrigger>
          <TabsTrigger value="controls"><ShieldCheck className="mr-1.5 size-3.5" /> Controls</TabsTrigger>
          <TabsTrigger value="events"><ShieldAlert className="mr-1.5 size-3.5" /> Events</TabsTrigger>
        </TabsList>

        <TabsContent value="vault" className="mt-4">
          <DataTable
            columns={[
              { key: "service", header: "Service", render: (r: any) => <span className="font-medium">{r.service}</span> },
              { key: "category", header: "Category", render: (r: any) => <Badge variant="outline">{r.category}</Badge> },
              { key: "envVar", header: "Env Var", render: (r: any) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.envVar}</code> },
              { key: "maskedKey", header: "Key", render: (r: any) => <MaskedKey value={r.maskedKey} /> },
              { key: "status", header: "Status", render: (r: any) => <Badge variant="outline" className={statusTone[r.status]}>{r.status}</Badge> },
              { key: "lastRotated", header: "Rotated" },
              { key: "actions", header: "", render: (r: any) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); rotate(r); }}><RotateCcw className="size-3.5" /> Rotate</Button>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); toggle(r); }}>{r.status === "Connected" ? "Disconnect" : "Connect"}</Button>
                </div>
              )},
            ]}
            data={credentials}
            searchKeys={["service", "category", "envVar"]}
            searchPlaceholder="Search services..."
          />
        </TabsContent>

        <TabsContent value="controls" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Security Controls</CardTitle><CardDescription>{sec.enforced} of {sec.total} enforced</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {controls.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0"><p className="text-sm">{c.control}</p><p className="text-xs text-muted-foreground">{c.area}</p></div>
                  <Badge variant="outline" className={controlTone[c.status]}>{c.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Security Events</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {events.map((e: any) => (
                <div key={e.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{e.event}</p>
                    <Badge variant="outline" className={sevTone[e.severity]}>{e.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground/60">{e.time}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaskedKey({ value }: { value: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="flex items-center gap-1.5">
      <code className="text-xs text-muted-foreground">{show ? value.replace(/•/g, "x") : value}</code>
      <button onClick={(e) => { e.stopPropagation(); setShow((v) => !v); }} className="text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value); }} className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}
