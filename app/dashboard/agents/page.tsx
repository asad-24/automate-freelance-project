"use client";
import * as React from "react";
import Link from "next/link";
import {
  Bot, Briefcase, Gavel, Megaphone, MessagesSquare, Network, ShieldCheck,
  Play, Pause, RotateCw, Settings2, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { agents as agentsSeed, auditLog as auditSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { useDemoStore } from "@/lib/demo-store";
import { formatRelative } from "@/lib/utils";

const iconMap: Record<string, any> = {
  briefcase: Briefcase, megaphone: Megaphone, gavel: Gavel,
  "messages-square": MessagesSquare, network: Network, "shield-check": ShieldCheck,
};

export default function AgentsPage() {
  const { toast } = useToast();
  const demo = useDemoStore();
  const agents = useEntity("agents", agentsSeed, 4000);
  const auditLog = useEntity("audit-log", auditSeed, 4000);

  const lastAction = (name: string) => auditLog.find((e: any) => e.agent === name)?.action;

  const toggle = (a: (typeof agents)[number]) => {
    const updated = demo?.toggleAgent(a.id);
    apiPost(`/api/agents/${a.id}/toggle`);
    toast({
      title: `${a.name} ${updated?.status ?? "updated"}`,
      description: `Agent is now ${updated?.status}.`,
      variant: "success",
    });
  };

  const resumeAll = () => {
    agents.filter((a: any) => a.status !== "running").forEach((a: any) => demo?.toggleAgent(a.id));
    apiPost("/api/agents/resume-all");
    toast({ title: "All agents resumed", variant: "success" });
  };

  return (
    <>
      <PageHeader
        title="Agent Fleet"
        description="Start, pause, run and inspect each agent — every action is recorded."
        actions={
          <Button variant="outline" onClick={resumeAll}>
            <Play className="size-4" /> Resume all
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a: any) => {
          const Icon = iconMap[a.icon] ?? Bot;
          return (
            <Card key={a.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <CardDescription>{a.subtitle}</CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="text-sm text-muted-foreground">{a.description}</p>
                {lastAction(a.name) && (
                  <p className="mt-3 line-clamp-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Last action:</span> {lastAction(a.name)}
                  </p>
                )}
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Schedule</span><span className="font-medium text-foreground">{a.schedule}</span></div>
                  <div className="flex justify-between"><span>Runs today</span><span className="font-medium text-foreground">{a.runsToday}</span></div>
                  <div className="flex justify-between"><span>Last run</span><span className="font-medium text-foreground">{formatRelative(a.lastRun)}</span></div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Success rate</span>
                    <span className="font-medium">{a.successRate}%</span>
                  </div>
                  <Progress value={a.successRate} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {a.status === "running" ? (
                    <Button size="sm" variant="outline" onClick={() => toggle(a)}>
                      <Pause className="size-4" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="default" onClick={() => toggle(a)}>
                      <Play className="size-4" /> Start
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/dashboard/agents/${a.id}`}>
                      <RotateCw className="size-4" /> Open console
                    </Link>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full justify-between" asChild>
                  <Link href={`/dashboard/agents/${a.id}`}>
                    View activity & output <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
