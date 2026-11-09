"use client";
import { FileDown, FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clientFiles as clientFilesSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export default function ClientFilesPage() {
  const clientFiles = useEntity("client/files", clientFilesSeed);
  const { toast } = useToast();
  return (
    <>
      <PageHeader
        title="Files & Deliverables"
        description="Download your rebranded deliverables, release notes, and project assets."
      />
      <div className="space-y-3">
        {clientFiles.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No deliverables yet — they'll appear here as work is completed.
          </p>
        )}
        {clientFiles.map((f: any) => (
          <Card key={f.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderOpen className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.type} · {f.size} · {formatDate(f.date)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                if (f.url) window.open(f.url, "_blank", "noopener,noreferrer");
                else toast({ title: "File not available yet", description: "Ask your agency to re-upload this deliverable." });
              }}>
                <FileDown className="size-4" /> Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
