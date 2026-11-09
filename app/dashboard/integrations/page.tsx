"use client";
import * as React from "react";
import { Plug, Mic, FileCheck2, ScrollText, CheckCircle2, XCircle, Import, Download, Upload, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { apiGet, apiPost } from "@/lib/api";
import { PlatformMatrix } from "@/components/dashboard/platform-matrix";
import { useEntity } from "@/lib/use-entity";
import { useDemoStore } from "@/lib/demo-store";
import { useToast } from "@/components/ui/toast";
import {
  integrations as integrationsSeed, voiceCalls as voiceSeed,
  qaRuns as qaSeed, auditLog as auditSeed,
} from "@/lib/mock-data";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const demo = useDemoStore();
  const integrations = useEntity("integrations", integrationsSeed);
  const voiceCalls = useEntity("voice-calls", voiceSeed);
  const qaRuns = useEntity("qa-runs", qaSeed);
  const audit = useEntity("audit-log", auditSeed, 4000);
  const [marketplaceCapabilities, setMarketplaceCapabilities] = React.useState<any>(null);

  React.useEffect(() => {
    let active = true;
    apiGet<any>("/api/integrations/capabilities").then((data) => {
      if (active && data) setMarketplaceCapabilities(data);
    });
    return () => { active = false; };
  }, []);

  const connected = integrations.filter((i: any) => i.status === "Connected").length;
  const byCategory = integrations.reduce<Record<string, any[]>>((acc, i: any) => {
    (acc[i.category] ||= []).push(i);
    return acc;
  }, {});

  const voiceCols: Column<any>[] = [
    { key: "client", header: "Client", render: (r) => <span className="font-medium">{r.client}</span> },
    { key: "date", header: "Date" },
    { key: "duration", header: "Duration" },
    { key: "requirements", header: "Requirements", render: (r) => <Badge variant="secondary">{r.requirements} extracted</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const qaCols: Column<any>[] = [
    { key: "contract", header: "Contract", render: (r) => <span className="font-medium">{r.contract}</span> },
    { key: "pr", header: "PR", render: (r) => <code className="text-xs">{r.pr}</code> },
    { key: "lint", header: "Lint", render: (r) => r.lint === "pass" ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" /> },
    { key: "tests", header: "Tests", render: (r) => r.tests === "pass" ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" /> },
    { key: "sonar", header: "Sonar", render: (r) => <span className="font-medium">{r.sonar}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Integrations"
        description={`${connected}/${integrations.length} connected — plus voice, QA and activity in one hub.`}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Marketplace access readiness</CardTitle>
          <CardDescription>
            Live actions appear ready only when server credentials and the matching approval switches are configured. Readiness does not mean a user account is connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {marketplaceCapabilities?.platforms ? Object.entries(marketplaceCapabilities.platforms).map(([platform, actions]: [string, any]) => (
            <div key={platform} className="rounded-lg border p-4">
              <h3 className="mb-3 font-semibold">{platform}</h3>
              <div className="space-y-3">
                {Object.entries(actions).map(([action, status]: [string, any]) => (
                  <div key={action} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{action.replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{status.reason}</p>
                    </div>
                    <Badge variant={status.ready ? "success" : "secondary"} className="shrink-0">
                      {status.ready ? status.mode : "not enabled"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Capability status is unavailable until the backend is connected.</p>}
          {marketplaceCapabilities?.job_finder && <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">Job finder sources</h3>
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {Object.entries(marketplaceCapabilities.job_finder)
                .sort(([, a]: [string, any], [, b]: [string, any]) => Number(b.ready) - Number(a.ready))
                .map(([source, status]: [string, any]) => (
                <div key={source} className="flex items-start justify-between gap-3 text-sm">
                  <div><p className="font-medium">{source}</p><p className="text-xs text-muted-foreground">{status.reason}</p></div>
                  <Badge variant={status.ready ? "success" : "secondary"} className="shrink-0">{status.ready ? status.mode : "not enabled"}</Badge>
                </div>
              ))}
            </div>
          </div>}
          {marketplaceCapabilities?.product_features && <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-semibold">Product workflows</h3>
            <div className="space-y-3">
              {Object.entries(marketplaceCapabilities.product_features).map(([feature, status]: [string, any]) => (
                <div key={feature} className="flex items-start justify-between gap-3 text-sm">
                  <div><p className="font-medium">{feature.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{status.reason}</p></div>
                  <Badge variant={status.ready ? "success" : "secondary"} className="shrink-0">{status.ready ? status.mode : "not enabled"}</Badge>
                </div>
              ))}
            </div>
          </div>}
        </CardContent>
      </Card>

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities"><LayoutGrid className="mr-1.5 size-3.5" /> Capability Map</TabsTrigger>
          <TabsTrigger value="connections"><Plug className="mr-1.5 size-3.5" /> Connections</TabsTrigger>
          <TabsTrigger value="migrate"><Import className="mr-1.5 size-3.5" /> Migrate</TabsTrigger>
          <TabsTrigger value="voice"><Mic className="mr-1.5 size-3.5" /> Voice</TabsTrigger>
          <TabsTrigger value="qa"><FileCheck2 className="mr-1.5 size-3.5" /> QA &amp; Delivery</TabsTrigger>
          <TabsTrigger value="activity"><ScrollText className="mr-1.5 size-3.5" /> Activity</TabsTrigger>
        </TabsList>

        {/* Capability Map — platforms separated by which hubs they can do */}
        <TabsContent value="capabilities">
          <PlatformMatrix />
        </TabsContent>

        {/* Connections */}
        <TabsContent value="connections" className="space-y-8">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i: any) => (
                  <Card key={i.id}>
                    <CardHeader className="flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plug className="size-4" /></div>
                        <CardTitle className="text-base">{i.name}</CardTitle>
                      </div>
                      <StatusBadge status={i.status} />
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">{i.desc}</CardDescription>
                      <Button size="sm" variant={i.status === "Connected" ? "outline" : "default"}
                        onClick={() => { apiPost(`/api/integrations/${i.id}/toggle`); toast({ title: `${i.name} ${i.status === "Connected" ? "configured" : "connected"}`, variant: "success" }); }}>
                        {i.status === "Connected" ? "Configure" : "Connect"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Migrate — agency owners bring their existing setup in one paste */}
        <TabsContent value="migrate">
          <MigratePanel demo={demo} toast={toast} />
        </TabsContent>

        {/* Voice calls */}
        <TabsContent value="voice">
          <DataTable columns={voiceCols} data={voiceCalls} searchKeys={["client"]} searchPlaceholder="Search calls..." />
        </TabsContent>

        {/* QA runs */}
        <TabsContent value="qa">
          <DataTable columns={qaCols} data={qaRuns} searchKeys={["contract", "freelancer"]} searchPlaceholder="Search QA runs..." />
        </TabsContent>

        {/* Activity / audit */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {audit.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className={`mt-1 size-1.5 shrink-0 rounded-full ${a.status === "warning" ? "bg-warning" : "bg-primary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate"><span className="font-medium">{a.agent}</span> — {a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.status} · {timeAgo(a.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

// ----------------------------------------------------------------------- //
// Migrate — bring your existing agency setup in one paste, or export it out.
// ----------------------------------------------------------------------- //
function MigratePanel({ demo, toast }: { demo: ReturnType<typeof useDemoStore>; toast: any }) {
  const [agenciesCsv, setAgenciesCsv] = React.useState("");
  const [gigsCsv, setGigsCsv] = React.useState("");

  const importAgencies = () => {
    const rows = agenciesCsv.split("\n").map((l: any) => l.trim()).filter(Boolean);
    if (!rows.length) return;
    let n = 0;
    for (const row of rows) {
      const [name, email, focus, size] = row.split(",").map((s: any) => s?.trim());
      if (!name || !email) continue;
      demo?.addAgency({ name, email, focus: focus || "", size: size || "" });
      n++;
    }
    setAgenciesCsv("");
    toast({ title: `Imported ${n} ${n === 1 ? "agency" : "agencies"}`, description: "Find them under Outreach → Agencies.", variant: "success" });
  };

  const importGigs = () => {
    const rows = gigsCsv.split("\n").map((l: any) => l.trim()).filter(Boolean);
    if (!rows.length) return;
    let n = 0;
    for (const row of rows) {
      const [platform, title, price, category] = row.split(",").map((s: any) => s?.trim());
      if (!platform || !title) continue;
      demo?.createGig({ platform, title, price: Number(price) || 0, category: category || "General" });
      n++;
    }
    setGigsCsv("");
    toast({ title: `Imported ${n} ${n === 1 ? "gig" : "gigs"}`, description: "Find them under Accounts → Gigs.", variant: "success" });
  };

  const exportState = () => {
    const data = JSON.stringify(demo?.state ?? {}, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `autopilot-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast({ title: "Export downloaded", description: "Your full workspace — clients, gigs, campaigns, pipeline." });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="size-5 text-primary" /> Import your existing setup</CardTitle>
          <CardDescription>Switching is seamless — paste your agency targets and gigs from a spreadsheet export. One row per line, comma-separated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Agencies / targets <span className="text-xs font-normal text-muted-foreground">— name, email, focus, size</span></p>
            <Textarea rows={4} className="font-mono text-xs" placeholder={"Acme Studio, hello@acme.dev, Web design, 10-50\nBright Labs, ops@brightlabs.io, SaaS, 50-200"} value={agenciesCsv} onChange={(e) => setAgenciesCsv(e.target.value)} />
            <Button size="sm" onClick={importAgencies} disabled={!agenciesCsv.trim()}><Upload className="size-4" /> Import agencies</Button>
          </div>
          <div className="space-y-2 border-t pt-5">
            <p className="text-sm font-medium">Gigs / services <span className="text-xs font-normal text-muted-foreground">— platform, title, price, category</span></p>
            <Textarea rows={4} className="font-mono text-xs" placeholder={"Upwork, Landing page redesign, 800, Design\nFiverr, Next.js bug fixes, 250, Development"} value={gigsCsv} onChange={(e) => setGigsCsv(e.target.value)} />
            <Button size="sm" onClick={importGigs} disabled={!gigsCsv.trim()}><Upload className="size-4" /> Import gigs</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="size-5 text-primary" /> Export everything</CardTitle>
          <CardDescription>Your data is yours — download your whole workspace as JSON anytime, or hand it to a teammate to replicate your setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Exports include clients, gigs, campaigns, applications, saved searches, contracts and settings — everything an agency needs to replicate its setup here or archive it safely.
          </div>
          <Button variant="gradient" onClick={exportState}><Download className="size-4" /> Download full export (.json)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
