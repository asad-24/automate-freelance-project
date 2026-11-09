"use client";
import { FolderKanban, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Progress } from "@/components/ui/progress";
import { freelancerContracts as freelancerContractsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";

type Row = (typeof freelancerContractsSeed)[number];

export default function FreelancerContractsPage() {
  const freelancerContracts = useEntity("freelancer/contracts", freelancerContractsSeed);
  const columns: Column<Row>[] = [
    { key: "title", header: "Contract", render: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: "milestonesDone",
      header: "Milestones",
      render: (r) => (
        <div className="w-32">
          <div className="mb-1 text-xs text-muted-foreground">{r.milestonesDone}/{r.milestonesTotal}</div>
          <Progress value={(r.milestonesDone / r.milestonesTotal) * 100} />
        </div>
      ),
    },
    { key: "value", header: "Value", render: (r) => <span className="font-semibold">{formatCurrency(r.value)}</span> },
    { key: "qa", header: "QA", render: (r) => <StatusBadge status={r.qa} /> },
    { key: "due", header: "Due", render: (r) => formatDate(r.due) },
  ];

  return (
    <>
      <PageHeader title="My Contracts" description="Contracts awarded to you through the blind-auction process." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Contracts" value={String(freelancerContracts.length)} icon={<FolderKanban className="size-5" />} href="/freelancer/contracts" />
        <StatCard label="Total Value" value={formatCurrency(freelancerContracts.reduce((a, c) => a + c.value, 0))} icon={<FolderKanban className="size-5" />} href="/freelancer/earnings" />
        <StatCard label="QA Passing" value="2/2" icon={<ShieldCheck className="size-5" />} href="/freelancer/qa" />
      </div>
      <div className="mt-6">
        <DataTable columns={columns} data={freelancerContracts} searchKeys={["title"]} searchPlaceholder="Search contracts..." />
      </div>
    </>
  );
}
