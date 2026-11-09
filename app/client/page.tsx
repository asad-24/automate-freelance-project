"use client";
import Link from "next/link";
import { FolderKanban, ListChecks, Receipt, MessageSquare, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { clientProjects as clientProjectsSeed, clientInvoices as clientInvoicesSeed, milestones as milestonesSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ClientDashboard() {
  const { user } = useAuth();
  const clientProjects = useEntity("client/projects", clientProjectsSeed);
  const clientInvoices = useEntity("client/invoices", clientInvoicesSeed);
  const milestones = useEntity("client/milestones", milestonesSeed);
  const pendingApprovals = milestones.filter((m: any) => m.status !== "Approved").length;
  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description="Track your projects, approve milestones, and message your team."
        actions={
          <Button variant="gradient" asChild>
            <Link href="/client/messages">
              <MessageSquare className="size-4" /> Message team
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Projects" value={String(clientProjects.length)} icon={<FolderKanban className="size-5" />} href="/client/projects" />
        <StatCard label="Pending Approvals" value={String(pendingApprovals)} icon={<ListChecks className="size-5" />} href="/client/milestones" />
        <StatCard label="Open Invoices" value={String(clientInvoices.filter((i: any) => i.status !== "Paid").length)} icon={<Receipt className="size-5" />} href="/client/invoices" />
        <StatCard label="Total Invested" value={formatCurrency(clientInvoices.filter((i: any) => i.status === "Paid").reduce((s, i) => s + i.amount, 0))} icon={<Receipt className="size-5" />} href="/client/billing" />
      </div>

      {/* Projects */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Your Projects</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/client/projects">View all <ArrowRight className="size-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientProjects.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No projects yet — your agency's agents will create them here once work starts.</p>
          )}
          {clientProjects.map((p: any) => (
            <div key={p.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">Next: {p.nextMilestone} · due {formatDate(p.due)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={p.pm} size={28} />
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{p.progress}%</span>
                </div>
                <Progress value={p.progress} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming Milestones</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/client/milestones">View all <ArrowRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {milestones.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No milestones yet.</p>
            )}
            {milestones.filter((m: any) => m.status !== "Approved").slice(0, 3).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.contract}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(m.amount)}</p>
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/client/invoices">View all <ArrowRight className="size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {clientInvoices.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {clientInvoices.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">due {formatDate(i.due)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(i.amount)}</p>
                  <StatusBadge status={i.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
