import { redirect } from "next/navigation";

// Merged into the unified Money page.
export default function MonetizationRedirect() {
  redirect("/dashboard/money");
}
