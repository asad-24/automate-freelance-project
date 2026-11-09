"use client";
import * as React from "react";
import { FlaskConical, RefreshCw, Star, Users2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { apiGet, apiPatch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { formatRelative } from "@/lib/utils";

const ROLES: Record<string, string> = { freelancer: "Freelancer", agency: "Agency", client: "Client", other: "Other" };

export default function UserTestingPage() {
  const { toast } = useToast();
  const [testers, setTesters] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await apiGet("/api/beta-testers");
    setTesters(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const setStatus = async (t: any, status: string) => {
    const res = await apiPatch(`/api/beta-testers/${t.id}`, { status });
    if (res) {
      setTesters((p) => p.map((x: any) => (x.id === t.id ? { ...x, status } : x)));
      toast({ title: `${t.name} → ${status}`, variant: "success" });
    }
  };

  const cols: Column<any>[] = [
    { key: "name", header: "Tester", render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div> },
    { key: "role", header: "Role", render: (r) => <Badge variant="secondary">{ROLES[r.role] ?? r.role}</Badge> },
    { key: "area", header: "Interested in", render: (r) => <span className="text-sm">{r.area || "—"}</span> },
    {
      key: "feedback", header: "Feedback", render: (r) => (
        <div className="max-w-64">
          {r.rating > 0 && <p className="mb-0.5 flex gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3 fill-warning text-warning" />)}</p>}
          <p className="truncate text-xs text-muted-foreground">{r.feedback || "—"}</p>
        </div>
      ),
    },
    { key: "at", header: "Joined", render: (r) => <span className="text-xs text-muted-foreground">{formatRelative(r.at)}</span> },
    {
      key: "status", header: "Status", render: (r) => (
        <Select value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="h-8 w-28 text-xs">
          <option value="Invited">Invited</option>
          <option value="Onboarded">Onboarded</option>
          <option value="Testing">Testing</option>
          <option value="Feedback sent">Feedback sent</option>
          <option value="Churned">Churned</option>
        </Select>
      ),
    },
  ];

  const withFeedback = testers.filter((t: any) => t.feedback).length;

  return (
    <>
      <PageHeader
        title="Beta testers"
        description="The 25-user test group — signups and feedback from /beta, stored in MongoDB."
        actions={<Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Testers signed up</p><p className="mt-1 text-2xl font-bold">{testers.length}<span className="text-sm font-normal text-muted-foreground"> / 25</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Left feedback</p><p className="mt-1 text-2xl font-bold text-success">{withFeedback}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Actively testing</p><p className="mt-1 text-2xl font-bold text-primary">{testers.filter((t: any) => t.status === "Testing").length}</p></CardContent></Card>
      </div>
      <div className="mt-6">
        <DataTable columns={cols} data={testers} searchKeys={["name", "email", "area", "feedback"]} searchPlaceholder="Search testers..." />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4 text-primary" /> Send testers to</CardTitle>
          <CardDescription>Share this link — signups land here automatically.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="rounded-md bg-muted px-3 py-2 text-sm">/beta</code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/beta`); toast({ title: "Link copied" }); }}>
            <Users2 className="size-4" /> Copy beta link
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
