"use client";
import { GitPullRequest, CheckCircle2, XCircle, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { qaRuns as qaRunsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatRelative } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";

type Row = (typeof qaRunsSeed)[number];

export default function FreelancerQaPage() {
  const { toast } = useToast();
  const qaRuns = useEntity("qa-runs", qaRunsSeed);
  const myRuns = qaRuns.filter((r: any) => r.freelancer === "FL-3821");
  const columns: Column<Row>[] = [
    { key: "contract", header: "Contract", render: (r) => <span className="font-medium">{r.contract}</span> },
    { key: "pr", header: "PR", render: (r) => <Badge variant="outline" className="gap-1"><GitPullRequest className="size-3" /> {r.pr}</Badge> },
    { key: "lint", header: "Lint", render: (r) => <StatusBadge status={r.lint} /> },
    { key: "tests", header: "Tests", render: (r) => <StatusBadge status={r.tests} /> },
    { key: "sonar", header: "SonarQube", render: (r) => <Badge variant={r.sonar >= 80 ? "success" : "warning"}>{r.sonar}/100</Badge> },
    { key: "status", header: "Result", render: (r) => <StatusBadge status={r.status} /> },
    { key: "time", header: "Run", render: (r) => <span className="text-muted-foreground">{formatRelative(r.time)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="QA & Submissions"
        description="Your pull requests must pass the automated quality gate before payment is released."
        actions={
          <Button variant="gradient" onClick={() => toast({ title: "PR opened", variant: "success" })}>
            <Upload className="size-4" /> Submit for review
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Submissions" value={String(myRuns.length)} icon={<GitPullRequest className="size-5" />} href="/freelancer/qa" />
        <StatCard label="Passed" value={String(myRuns.filter((r: any) => r.status === "Passed").length)} icon={<CheckCircle2 className="size-5" />} href="/freelancer/contracts" />
        <StatCard label="Failed" value={String(myRuns.filter((r: any) => r.status === "Failed").length)} icon={<XCircle className="size-5" />} href="/freelancer/messages" />
      </div>
      <div className="mt-6">
        <DataTable columns={columns} data={myRuns} searchKeys={["contract"]} searchPlaceholder="Search runs..." />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quality Gate Requirements</CardTitle>
          <CardDescription>Your PR must pass all checks before the milestone is approved.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            { name: "Linting", desc: "ESLint / Black must pass clean" },
            { name: "Tests", desc: "Pytest / Jest suite must be green" },
            { name: "SonarQube", desc: "Code quality score ≥ 80" },
          ].map((s: any) => (
            <div key={s.name} className="rounded-lg border p-4">
              <p className="font-medium">{s.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
