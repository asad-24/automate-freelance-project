"use client";
import { Briefcase, Target, Zap, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { appliedJobs as appliedJobsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatDate } from "@/lib/utils";

type Row = (typeof appliedJobsSeed)[number];

export default function JobHunterPage() {
  const appliedJobs = useEntity("jobs", appliedJobsSeed);
  const columns: Column<Row>[] = [
    { key: "title", header: "Job Title", render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "company", header: "Company" },
    { key: "source", header: "Source", render: (r) => <Badge variant="outline">{r.source}</Badge> },
    { key: "location", header: "Location", render: (r) => <span className="text-muted-foreground">{r.location}</span> },
    {
      key: "match",
      header: "Match",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.match} className="w-16" />
          <span className="text-sm font-medium">{r.match}%</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Date", render: (r) => <span className="text-muted-foreground">{formatDate(r.date)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Job Hunter"
        description="Autonomous direct-employment applications — JobSpy feed → match → tailor → apply."
        actions={<Badge variant="outline">Max 10 applications / day</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications Today" value="8" icon={<Briefcase className="size-5" />} hint="of 10 limit" href="/dashboard/settings" />
        <StatCard label="Avg Match Score" value="86%" icon={<Target className="size-5" />} hint=">80% threshold" href="/dashboard/settings" />
        <StatCard label="Applied This Month" value="142" trend={10} icon={<Zap className="size-5" />} href="/dashboard/analytics" />
        <StatCard label="Résumé Versions" value="6" icon={<FileText className="size-5" />} hint="auto-tailored" href="/dashboard/personas" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily Application Limit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium">8 / 10</span>
          </div>
          <Progress value={80} />
          <p className="mt-2 text-xs text-muted-foreground">
            Celery enforces randomized submission intervals to mimic human behavior.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Jobs Applied To</h2>
        <DataTable columns={columns} data={appliedJobs} searchKeys={["title", "company"]} searchPlaceholder="Search jobs..." />
      </div>
    </>
  );
}
