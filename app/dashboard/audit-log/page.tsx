"use client";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { auditLog as auditLogSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatRelative } from "@/lib/utils";

type Row = (typeof auditLogSeed)[number];

export default function AuditLogPage() {
  const auditLog = useEntity("audit-log", auditLogSeed, 4000);
  const columns: Column<Row>[] = [
    {
      key: "status",
      header: "",
      render: (r) => (
        <span
          className={`inline-block size-2.5 rounded-full ${
            r.status === "success" ? "bg-success" : r.status === "warning" ? "bg-warning" : "bg-destructive"
          }`}
        />
      ),
      className: "w-8",
    },
    { key: "agent", header: "Agent", render: (r) => <span className="font-medium">{r.agent}</span> },
    { key: "action", header: "Action", render: (r) => <span className="text-muted-foreground">{r.action}</span> },
    { key: "statusLabel", header: "Status", render: (r) => <Badge variant={r.status === "success" ? "success" : r.status === "warning" ? "warning" : "destructive"}>{r.status}</Badge> },
    { key: "time", header: "Time", render: (r) => <span className="text-muted-foreground">{formatRelative(r.time)}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit Log" description="Complete agent run history and system events." />
      <DataTable columns={columns} data={auditLog} searchKeys={["agent", "action"]} searchPlaceholder="Search events..." />
    </>
  );
}
