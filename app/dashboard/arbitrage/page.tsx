"use client";
import { Network, Users, TrendingDown, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { blindBids as blindBidsSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type Row = (typeof blindBidsSeed)[number];

export default function ArbitragePage() {
  const { toast } = useToast();
  const blindBids = useEntity("bids", blindBidsSeed);
  const winner = blindBids.find((b: any) => b.awarded);

  const columns: Column<Row>[] = [
    { key: "freelancer", header: "Freelancer", render: (r) => <Badge variant="secondary">{r.freelancer}</Badge> },
    { key: "hours", header: "Hours", render: (r) => `${r.hours}h` },
    { key: "rate", header: "Rate", render: (r) => `${formatCurrency(r.rate)}/h` },
    { key: "total", header: "Total", render: (r) => <span className="font-semibold">{formatCurrency(r.total)}</span> },
    { key: "delivery", header: "Delivery", render: (r) => `${r.delivery} days` },
    { key: "quality", header: "Quality", render: (r) => `${r.quality}/100` },
    {
      key: "roi",
      header: "ROI Score",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.roi} className="w-16" />
          <span className="text-sm font-semibold">{r.roi}</span>
        </div>
      ),
    },
    {
      key: "awarded",
      header: "Status",
      render: (r) => (r.awarded ? <Badge variant="success">Awarded</Badge> : <Badge variant="secondary">Outbid</Badge>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Dynamic Arbitrage Dispatcher"
        description="Blind-auction specs to vetted freelancers — highest ROI wins. Client budget never disclosed."
        actions={
          <Button
            variant="gradient"
            onClick={() => { apiPost("/api/specs/broadcast"); toast({ title: "Spec broadcast sent", description: "Spec dispatched to 15 freelancers.", variant: "success" }); }}
          >
            <Network className="size-4" /> Broadcast spec
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Auctions" value="6" icon={<Network className="size-5" />} href="/dashboard/freelancers" />
        <StatCard label="Avg Freelancers/Spec" value="16" icon={<Users className="size-5" />} hint="10–20 pool" href="/dashboard/freelancers" />
        <StatCard label="Avg Price Drop" value="-27%" icon={<TrendingDown className="size-5" />} hint="blind auction" href="/dashboard/margins" />
        <StatCard label="NDA Shielded" value="100%" icon={<ShieldCheck className="size-5" />} href="/dashboard/security" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Live Blind Auction — SaaS analytics dashboard</CardTitle>
          <CardDescription>
            Scored on Cost vs. Budget (margin), Historical Quality, and Time to Deliver. Client budget is hidden
            from all bidders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={blindBids} />
        </CardContent>
      </Card>

      {winner && (
        <Card className="mt-6 border-success/40 bg-success/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Auto-awarded to</p>
              <p className="text-lg font-bold">{winner.freelancer} — {formatCurrency(winner.total)} · ROI {winner.roi}</p>
            </div>
            <Badge variant="success" className="gap-1.5">
              <ShieldCheck className="size-3.5" /> NDA shield active
            </Badge>
          </CardContent>
        </Card>
      )}
    </>
  );
}
