import { redirect } from "next/navigation";

// Absorbed into Integrations → QA & Delivery tab.
export default function Redirect() {
  redirect("/dashboard/integrations");
}
