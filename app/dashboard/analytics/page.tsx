"use client";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FunnelBarChart, MarginAreaChart, CategoryPieChart } from "@/components/charts/charts";
import { marginTimeseries as marginTimeseriesSeed, funnelData as funnelDataSeed, kpis as kpisSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency } from "@/lib/utils";

const channelMixSeed = [
  { name: "Upwork", value: 46 },
  { name: "B2B Direct", value: 28 },
  { name: "Reddit", value: 14 },
  { name: "Fiverr", value: 12 },
];

export default function AnalyticsPage() {
  const marginTimeseries = useEntity("margins/timeseries", marginTimeseriesSeed, 4000);
  const funnelData = useEntity("funnel", funnelDataSeed, 4000);
  const kpis = useEntity("kpis", kpisSeed, 4000);
  const channelMix = useEntity("channel-mix", channelMixSeed, 4000);

  const leadsTotal = funnelData.find((f: any) => f.stage === "Leads Scraped")?.value ?? 1240;
  const bidsTotal = funnelData.find((f: any) => f.stage === "Bids Submitted")?.value ?? 480;
  const wonTotal = funnelData.find((f: any) => f.stage === "Contracts Won")?.value ?? 62;

  return (
    <>
      <PageHeader title="Analytics" description="Acquisition funnel, win rates, and channel performance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Leads" value={leadsTotal.toLocaleString()} trend={12.4} href="/dashboard/bidding" />
        <StatCard label="Bids Submitted" value={bidsTotal.toLocaleString()} trend={6.1} href="/dashboard/bidding" />
        <StatCard label="Contracts Won" value={wonTotal.toLocaleString()} trend={kpis.winRateTrend} href="/dashboard/contracts" />
        <StatCard label="Revenue (MTD)" value={formatCurrency(kpis.revenueMonth)} trend={8.1} href="/dashboard/margins" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelBarChart data={funnelData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={channelMix} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {channelMix.map((c: any) => (
                <div key={c.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-semibold">{c.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Margin Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <MarginAreaChart data={marginTimeseries} />
        </CardContent>
      </Card>
    </>
  );
}
