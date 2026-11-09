"use client";
import { CheckCircle2, AlertTriangle, Info, BellOff } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notifications as notificationsSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntityQuery } from "@/lib/use-entity";
import { formatRelative, cn } from "@/lib/utils";

const iconMap: Record<string, any> = { success: CheckCircle2, warning: AlertTriangle, info: Info };

export default function NotificationsPage() {
  const { data: notifications, refresh } = useEntityQuery("notifications", notificationsSeed);
  const unread = notifications.filter((n: any) => !n.read).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description="System alerts, contract wins, HITL escalations, and self-healing scraper events."
        actions={
          <Button variant="outline" onClick={async () => { await apiPost("/api/notifications/read-all"); refresh(); }}>
            <BellOff className="size-4" /> Mark all read{unread > 0 ? ` (${unread})` : ""}
          </Button>
        }
      />
      {notifications.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><BellOff className="size-6 text-muted-foreground" /><p className="font-medium">No notifications yet</p><p className="text-sm text-muted-foreground">Alerts about job matches, messages and your account will appear here.</p></CardContent></Card>
      )}
      <div className="space-y-3">
        {notifications.map((n: any) => {
          const Icon = iconMap[n.type] ?? Info;
          return (
            <Card key={n.id} className={cn(!n.read && "border-l-4 border-l-primary")}>
              <CardContent className="flex items-start gap-4 p-4">
                <div
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                    n.type === "success" ? "bg-success/15 text-success" : n.type === "warning" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read && <span className="size-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(n.time)}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
