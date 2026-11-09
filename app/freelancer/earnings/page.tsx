"use client";
import { Wallet, TrendingUp, Banknote } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SimpleLineChart } from "@/components/charts/charts";
import { freelancerEarnings as freelancerEarningsSeed, payouts as payoutsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";

export default function FreelancerEarningsPage() {
  const freelancerEarnings = useEntity("freelancer/earnings", freelancerEarningsSeed);
  const payouts = useEntity("payouts", payoutsSeed);
  const myPayouts = payouts.filter((p: any) => p.freelancer === "FL-3821");
  const cols: Column<(typeof payouts)[number]>[] = [
    { key: "contract", header: "Contract", render: (r) => <span className="font-medium">{r.contract}</span> },
    { key: "amount", header: "Amount", render: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
  ];

  return (
    <>
      <PageHeader title="Earnings" description="Your payouts and earnings history via Stripe Connect." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Earned" value="—" icon={<Wallet className="size-5" />} href="/freelancer/contracts" />
        <StatCard label="Pending Payout" value="—" icon={<Banknote className="size-5" />} href="/freelancer/billing" />
        <StatCard label="This Month" value="—" icon={<TrendingUp className="size-5" />} href="/freelancer/earnings" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Earnings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={freelancerEarnings} dataKey="amount" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={cols} data={myPayouts} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
