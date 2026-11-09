import { redirect } from "next/navigation";

// Merged into the unified Money page (Plan & Credits tab).
export default function BillingRedirect() {
  redirect("/dashboard/money");
}
