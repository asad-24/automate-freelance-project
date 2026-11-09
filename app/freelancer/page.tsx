"use client";
import Link from "next/link";
import { Wallet, FileText, CheckCircle2, Gavel, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleLineChart } from "@/components/charts/charts";
import { freelancerEarnings as freelancerEarningsSeed, freelancerOpenSpecs as freelancerOpenSpecsSeed, freelancerContracts as freelancerContractsSeed, freelancerMyBids as freelancerMyBidsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency } from "@/lib/utils";

export default function FreelancerDashboard() {
  const freelancerEarnings = useEntity("freelancer/earnings", freelancerEarningsSeed);
  const freelancerOpenSpecs = useEntity("freelancer/specs", freelancerOpenSpecsSeed);
  const freelancerContracts = useEntity("freelancer/contracts", freelancerContractsSeed);
  const freelancerMyBids = useEntity("freelancer/bids", freelancerMyBidsSeed);
  const monthEarnings = freelancerEarnings[freelancerEarnings.length - 1]?.amount ?? 0;
  return (
    <>
      <PageHeader
        title="Freelancer Dashboard"
        description="Your earnings, active contracts, and new specs available for bidding."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Earnings (This Month)" value={formatCurrency(monthEarnings)} icon={<Wallet className="size-5" />} href="/freelancer/earnings" />
        <StatCard label="Active Contracts" value={String(freelancerContracts.length)} icon={<FileText className="size-5" />} href="/freelancer/contracts" />
        <StatCard label="Open Specs" value={String(freelancerOpenSpecs.length)} icon={<Gavel className="size-5" />} href="/freelancer/specs" />
        <StatCard label="Quality Score" value="—" icon={<CheckCircle2 className="size-5" />} href="/freelancer/qa" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {freelancerEarnings.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">No earnings yet — win your first spec bid to start earning.</p>
            ) : (
              <SimpleLineChart data={freelancerEarnings} dataKey="amount" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Open Specs to Bid On</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/freelancer/specs">View all <ArrowRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {freelancerOpenSpecs.map((s: any) => (
              <div key={s.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{s.title}</p>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.stack.map((t: any) => (
                    <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{s.estHours} · {s.deadline}</span>
                  <span>{s.bidsIn} bids in</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>My Bids</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/freelancer/bids">View all <ArrowRight className="size-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {freelancerMyBids.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No bids yet — pick an open spec to place your first bid.</p>
          )}
          {freelancerMyBids.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{b.spec}</p>
                <p className="text-xs text-muted-foreground">{b.hours}h @ {formatCurrency(b.rate)}/h</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{formatCurrency(b.total)}</span>
                <StatusBadge status={b.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
