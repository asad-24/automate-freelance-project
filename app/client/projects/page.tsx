"use client";
import Link from "next/link";
import { FolderKanban, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { clientProjects as clientProjectsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { formatDate } from "@/lib/utils";

export default function ClientProjectsPage() {
  const clientProjects = useEntity("client/projects", clientProjectsSeed);
  return (
    <>
      <PageHeader title="Projects" description="All your engagements with our agency." />
      <div className="grid gap-6 md:grid-cols-2">
        {clientProjects.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No projects yet — once your agency wins work for you, it will appear here.
          </p>
        )}
        {clientProjects.map((p: any) => (
          <Card key={p.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-xs text-muted-foreground">Next: {p.nextMilestone}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{p.progress}%</span>
                </div>
                <Progress value={p.progress} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar name={p.pm} size={28} />
                  <span className="text-xs text-muted-foreground">PM: {p.pm}</span>
                </div>
                <span className="text-xs text-muted-foreground">Due {formatDate(p.due)}</span>
              </div>
              <Link href="/client/milestones" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                View milestones <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
