"use client";
import { Megaphone, Mail, Globe, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { salesLeads as salesLeadsSeed, emailSequences as emailSequencesSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Lead = (typeof salesLeadsSeed)[number];
type Seq = (typeof emailSequencesSeed)[number];

export default function MarketingPage() {
  const salesLeads = useEntity("sales-leads", salesLeadsSeed);
  const emailSequences = useEntity("sequences", emailSequencesSeed);
  const leadColumns: Column<Lead>[] = [
    { key: "company", header: "Company", render: (r) => <span className="font-medium">{r.company}</span> },
    { key: "industry", header: "Industry" },
    { key: "funding", header: "Funding", render: (r) => <Badge variant="secondary">{r.funding}</Badge> },
    { key: "source", header: "Source", render: (r) => <Badge variant="outline">{r.source}</Badge> },
    { key: "stage", header: "Stage", render: (r) => <StatusBadge status={r.stage} /> },
    { key: "microsite", header: "Micro-site", render: (r) => <span className="text-sm text-primary">{r.microsite}</span> },
    { key: "contact", header: "Contact", render: (r) => <span className="text-muted-foreground">{r.contact}</span> },
  ];

  const seqColumns: Column<Seq>[] = [
    { key: "name", header: "Sequence", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "steps", header: "Steps", render: (r) => `${r.steps}` },
    { key: "active", header: "Active Recipients", render: (r) => `${r.active}` },
    { key: "openRate", header: "Open Rate", render: (r) => <Badge variant="secondary">{r.openRate}%</Badge> },
    { key: "replyRate", header: "Reply Rate", render: (r) => <Badge variant="success">{r.replyRate}%</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Marketing & Sales Engine"
        description="B2B direct lead-gen — Clutch/LinkedIn scraping, cold email via n8n, personalized micro-sites, Cal.com booking."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="B2B Leads" value="268" trend={18} icon={<Megaphone className="size-5" />} href="/dashboard/bidding" />
        <StatCard label="Emails Sent" value="1,840" trend={22} icon={<Mail className="size-5" />} href="/dashboard/marketing" />
        <StatCard label="Micro-sites Live" value="86" icon={<Globe className="size-5" />} href="/dashboard/portfolio" />
        <StatCard label="Calls Booked" value="14" trend={6} icon={<CalendarCheck className="size-5" />} href="/dashboard/voice" />
      </div>

      <Tabs defaultValue="leads" className="mt-6">
        <TabsList>
          <TabsTrigger value="leads">Sales Leads</TabsTrigger>
          <TabsTrigger value="sequences">Email Sequences</TabsTrigger>
        </TabsList>
        <TabsContent value="leads">
          <DataTable columns={leadColumns} data={salesLeads} searchKeys={["company", "industry"]} searchPlaceholder="Search leads..." />
        </TabsContent>
        <TabsContent value="sequences">
          <DataTable columns={seqColumns} data={emailSequences} searchKeys={["name"]} />
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personalized Micro-sites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {salesLeads.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{l.company}</p>
                  <p className="text-xs text-primary">{l.microsite}</p>
                </div>
                <StatusBadge status={l.stage} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["New", "Email Opened", "Reply Received", "Call Booked", "Proposal", "Won"].map((stage, i) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="w-32 text-sm">{stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
                    style={{ width: `${[100, 68, 42, 22, 12, 8][i]}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-medium">{[268, 182, 112, 59, 32, 21][i]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
