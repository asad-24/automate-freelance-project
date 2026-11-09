"use client";
import { Gavel } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { freelancerOpenSpecs as freelancerOpenSpecsSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { useToast } from "@/components/ui/toast";

type Row = (typeof freelancerOpenSpecsSeed)[number];

export default function FreelancerSpecsPage() {
  const { toast } = useToast();
  const freelancerOpenSpecs = useEntity("freelancer/specs", freelancerOpenSpecsSeed);
  const columns: Column<Row>[] = [
    { key: "title", header: "Spec", render: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: "stack",
      header: "Stack",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.stack.map((t: any) => (
            <Badge key={t} variant="secondary" className="text-[11px]">{t}</Badge>
          ))}
        </div>
      ),
    },
    { key: "estHours", header: "Est. Hours", render: (r) => r.estHours },
    { key: "deadline", header: "Deadline", render: (r) => r.deadline },
    { key: "bidsIn", header: "Bids In", render: (r) => <Badge variant="outline">{r.bidsIn}</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "",
      render: (r) => (
        <Button size="sm" variant="gradient" onClick={() => { apiPost(`/api/freelancer/specs/${r.id}/bid`, { hours: 60, rate: 28 }); toast({ title: "Bid placed", description: `Bid submitted on "${r.title}".`, variant: "success" }); }}>
          <Gavel className="size-4" /> Bid
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Open Specs"
        description="Technical specs broadcast to the freelancer pool — submit your hours & rate in a blind auction."
      />
      <DataTable columns={columns} data={freelancerOpenSpecs} searchKeys={["title"]} searchPlaceholder="Search specs..." />
    </>
  );
}
