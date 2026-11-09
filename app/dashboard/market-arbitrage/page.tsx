import { redirect } from "next/navigation";

// Merged into the unified Money page (Market Rates tab).
export default function MarketArbitrageRedirect() {
  redirect("/dashboard/money");
}
