"use client";
import * as React from "react";
import { Activity, DollarSign, Percent, Server, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarginAreaChart, RevenueBarChart } from "@/components/charts/charts";
import { formatCurrency } from "@/lib/utils";
import { kpis as kpisSeed, marginTimeseries as marginTimeseriesSeed, marginByProject as marginByProjectSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";

type Row = (typeof marginByProjectSeed)[number];

export default function MarginsPage() {
  const kpis = useEntity("kpis", kpisSeed);
  const marginTimeseries = useEntity("margins/timeseries", marginTimeseriesSeed);
  const marginByProject = useEntity("margins/by-project", marginByProjectSeed);
  const [live, setLive] = React.useState(kpisSeed.liveMargin);
  React.useEffect(() => {
    const t = setInterval(() => setLive((v) => v + Math.round((Math.random() - 0.3) * 120)), 2000);
    return () => clearInterval(t);
  }, []);

  const columns: Column<Row>[] = [
    { key: "project", header: "Project", render: (r) => <span className="font-medium">{r.project}</span> },
    { key: "client", header: "Client", render: (r) => <span className="text-muted-foreground">{r.client}</span> },
    { key: "payment", header: "Client Payment", render: (r) => formatCurrency(r.payment) },
    { key: "freelancerCost", header: "Freelancer Cost", render: (r) => <span className="text-muted-foreground">{formatCurrency(r.freelancerCost)}</span> },
    { key: "apiOverhead", header: "API Overhead", render: (r) => <span className="text-muted-foreground">{formatCurrency(r.apiOverhead)}</span> },
    {
      key: "margin",
      header: "Net Margin",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-success">{formatCurrency(r.margin)}</span>
          <Badge variant="success">{Math.round((r.margin / r.payment) * 100)}%</Badge>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Real-Time Margin Tracker"
        description="Live profit per project — Client payment − Freelancer cost − API overhead."
        actions={
          <Badge variant="success" className="gap-1.5">
            <Activity className="size-3.5 animate-pulse" /> Live via WebSocket
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live Margin (MTD)" value={formatCurrency(live)} trend={kpis.marginTrend} icon={<DollarSign className="size-5" />} href="/dashboard/analytics" />
        <StatCard label="Revenue (MTD)" value={formatCurrency(kpis.revenueMonth)} trend={8.1} icon={<TrendingUp className="size-5" />} href="/dashboard/monetization" />
        <StatCard label="Avg Margin %" value="48%" trend={2.4} icon={<Percent className="size-5" />} href="/dashboard/market-arbitrage" />
        <StatCard label="API Overhead" value={formatCurrency(kpis.apiOverheadMonth)} trend={-4.2} icon={<Server className="size-5" />} hint="lower is better" href="/dashboard/security" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net Margin Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <MarginAreaChart data={marginTimeseries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={marginTimeseries} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Margin by Project</h2>
        <DataTable columns={columns} data={marginByProject} searchKeys={["project", "client"]} searchPlaceholder="Search projects..." />
      </div>
    </>
  );
}
