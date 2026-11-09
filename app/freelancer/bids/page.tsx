"use client";
import { FileText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { freelancerMyBids as freelancerMyBidsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";

type Row = (typeof freelancerMyBidsSeed)[number];

export default function FreelancerBidsPage() {
  const freelancerMyBids = useEntity("freelancer/bids", freelancerMyBidsSeed);
  const columns: Column<Row>[] = [
    { key: "spec", header: "Spec", render: (r) => <span className="font-medium">{r.spec}</span> },
    { key: "hours", header: "Hours", render: (r) => `${r.hours}h` },
    { key: "rate", header: "Rate", render: (r) => `${formatCurrency(r.rate)}/h` },
    { key: "total", header: "Total", render: (r) => <span className="font-semibold">{formatCurrency(r.total)}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "submitted", header: "Submitted", render: (r) => <span className="text-muted-foreground">{formatDate(r.submitted)}</span> },
  ];

  return (
    <>
      <PageHeader title="My Bids" description="All your bids across the blind-auction pool." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Bids" value={String(freelancerMyBids.length)} icon={<FileText className="size-5" />} href="/freelancer/specs" />
        <StatCard label="Awarded" value="1" icon={<TrendingUp className="size-5" />} href="/freelancer/contracts" />
        <StatCard label="Bid Value" value="—" icon={<FileText className="size-5" />} href="/freelancer/earnings" />
      </div>
      <div className="mt-6">
        <DataTable columns={columns} data={freelancerMyBids} searchKeys={["spec"]} searchPlaceholder="Search bids..." />
      </div>
    </>
  );
}
