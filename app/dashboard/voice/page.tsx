import { redirect } from "next/navigation";

// Absorbed into Integrations → Voice tab.
export default function Redirect() {
  redirect("/dashboard/integrations");
}
