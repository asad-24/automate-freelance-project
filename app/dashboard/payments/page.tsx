import { redirect } from "next/navigation";

// Merged into the unified Money page (Payments tab).
export default function PaymentsRedirect() {
  redirect("/dashboard/money");
}
