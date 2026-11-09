"use client";
import { CheckCircle2, Circle, Clock, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { milestones as milestonesSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function ClientMilestonesPage() {
  const { toast } = useToast();
  const milestones = useEntity("client/milestones", milestonesSeed);
  return (
    <>
      <PageHeader title="Milestones" description="Approve completed milestones to release escrowed funds." />
      <div className="space-y-3">
        {milestones.map((m: any) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  {m.status === "Approved" ? (
                    <CheckCircle2 className="size-6 text-success" />
                  ) : m.status === "In Progress" ? (
                    <Clock className="size-6 text-warning" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted-foreground">{m.contract} · due {formatDate(m.due)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCurrency(m.amount)}</span>
                <StatusBadge status={m.status} />
                {m.status === "In Progress" && (
                  <Button size="sm" variant="gradient" onClick={() => { apiPost(`/api/client/milestones/${m.id}/approve`); toast({ title: "Milestone approved", description: "Approval recorded. Payment release is not connected yet, so no money moved.", variant: "success" }); }}>
                    <CreditCard className="size-4" /> Approve & Pay
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
