import { redirect } from "next/navigation";

// Merged into the unified Clients & Work workspace.
export default function Redirect() {
  redirect("/dashboard/clients");
}
