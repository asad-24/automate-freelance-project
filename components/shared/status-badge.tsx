import { Badge } from "@/components/ui/badge";

const map: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  // success-ish
  active: "success",
  running: "success",
  passing: "success",
  passed: "success",
  paid: "success",
  completed: "success",
  won: "success",
  accepted: "success",
  approved: "success",
  awarded: "success",
  delivered: "success",
  connected: "success",
  positive: "success",
  sent: "success",
  // warning-ish
  pending: "warning",
  "in progress": "warning",
  review: "warning",
  screening: "warning",
  bidding: "warning",
  "under review": "warning",
  drafting: "warning",
  neutral: "warning",
  invited: "warning",
  due: "warning",
  scheduled: "warning",
  "pending approval": "warning",
  "closing soon": "warning",
  "email opened": "warning",
  // destructive-ish
  failing: "destructive",
  failed: "destructive",
  overdue: "destructive",
  error: "destructive",
  "at-risk": "destructive",
  escalated: "destructive",
  disconnected: "destructive",
  open: "destructive",
  "not selected": "destructive",
  high: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  let variant = map[key];
  if (!variant) {
    if (key.includes("skip")) variant = "secondary";
    else if (key.includes("open")) variant = "default";
    else variant = "secondary";
  }
  return <Badge variant={variant}>{status}</Badge>;
}
