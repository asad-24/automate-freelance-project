import { redirect } from "next/navigation";

// Dashboard + Command Center are now merged into one "Mission Control".
export default function DashboardIndex() {
  redirect("/dashboard/command");
}
