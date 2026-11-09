"use client";
import { AlertTriangle, Heart, Sparkles, Banknote, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hitlQueue as hitlQueueSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { useDemoStore } from "@/lib/demo-store";
import { formatRelative } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const iconMap: Record<string, any> = {
  "Sentiment Escalation": Heart,
  "Hallucination Flag": Sparkles,
  "Payout Approval": Banknote,
  "Timeline Promise": Clock,
};

const priorityVariant: Record<string, "destructive" | "warning" | "secondary"> = {
  High: "destructive",
  Medium: "warning",
  Low: "secondary",
};

export default function HitlPage() {
  const { toast } = useToast();
  const demo = useDemoStore();
  const hitlQueue = useEntity("hitl", hitlQueueSeed, 4000);
  const open = hitlQueue.filter((h: any) => h.status === "Open");
  const sentiment = open.filter((h: any) => h.type === "Sentiment Escalation").length;
  const payouts = open.filter((h: any) => h.type === "Payout Approval").length;

  const resolve = (h: (typeof hitlQueue)[number]) => {
    demo?.resolveHitl(h.id);
    apiPost(`/api/hitl/${h.id}/resolve`);
    toast({ title: "Resolved", variant: "success" });
  };
  const take = (h: (typeof hitlQueue)[number]) => {
    apiPost(`/api/hitl/${h.id}/take`);
    toast({ title: "Assigned to you" });
  };

  return (
    <>
      <PageHeader
        title="Human-in-the-Loop Queue"
        description="Escalations that pause autonomy and await human review — sentiment, hallucinations, payout approvals."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open Items" value={String(open.length)} icon={<AlertTriangle className="size-5" />} hint="needs action" href="/dashboard/command" />
        <StatCard label="Sentiment Escalations" value={String(sentiment)} icon={<Heart className="size-5" />} href="/dashboard/conversations" />
        <StatCard label="Payout Approvals" value={String(payouts)} icon={<Banknote className="size-5" />} href="/dashboard/payments" />
      </div>

      <div className="mt-6 space-y-3">
        {hitlQueue.map((h: any) => {
          const Icon = iconMap[h.type] ?? AlertTriangle;
          return (
            <Card key={h.id} className="border-l-4" style={{ borderLeftColor: h.priority === "High" ? "hsl(var(--destructive))" : h.priority === "Medium" ? "hsl(var(--warning))" : "hsl(var(--border))" }}>
              <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{h.type}</p>
                      <Badge variant={priorityVariant[h.priority]}>{h.priority}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{h.entity}</p>
                    <p className="text-sm text-muted-foreground">{h.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelative(h.created)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {h.status === "Resolved" ? (
                    <Badge variant="success">Resolved</Badge>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => take(h)}>Take</Button>
                      <Button size="sm" variant="default" onClick={() => resolve(h)}>Resolve</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
