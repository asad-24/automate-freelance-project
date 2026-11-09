"use client";
import { CreditCard, Rocket, Crown, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { billingHistory as billingHistorySeed, addonMarketplace as addonMarketplaceSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function FreelancerBillingPage() {
  const { toast } = useToast();
  const billingHistory = useEntity("billing-history", billingHistorySeed);
  const addonMarketplace = useEntity("addons", addonMarketplaceSeed);
  const freelancerAddons = addonMarketplace.filter((a: any) => a.for === "Freelancers");
  const historyCols: Column<(typeof billingHistorySeed)[number]>[] = [
    { key: "description", header: "Description", render: (r) => <span className="font-medium">{r.description}</span> },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "",
      render: () => (
        <Button size="sm" variant="ghost" onClick={() => toast({ title: "Receipt downloaded" })}>
          <Download className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Billing & Plan"
        description="Your subscription, boosts, and payment history."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="size-5 text-primary" /> Pro Plan
            </CardTitle>
            <CardDescription>3-day trial — extends to 7 days when you share or refer · then $19/mo</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="success" className="mb-4">Trial active</Badge>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Bids this month</span>
                  <span className="font-medium">Unlimited</span>
                </div>
                <Progress value={100} indicatorClassName="bg-success" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Priority dispatch</span>
                  <span className="font-medium">Enabled</span>
                </div>
                <Progress value={100} indicatorClassName="bg-success" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span className="font-medium">4% (Pro tier)</span>
                </div>
                <Progress value={80} />
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <Button variant="outline" onClick={() => toast({ title: "Payment method updated", variant: "success" })}>
                <CreditCard className="size-4" /> Update payment method
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Boosts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-primary" /> Boosts & Add-ons
            </CardTitle>
            <CardDescription>Stand out in the blind-auction pool — paid visibility & perks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {freelancerAddons.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{a.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-primary">{a.price}</span>
                  <Button size="sm" variant="outline" onClick={() => { apiPost(`/api/addons/${a.id}/purchase`); toast({ title: `${a.name} activated`, variant: "success" }); }}>
                    Activate
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="mb-3 font-semibold">Billing History</h3>
        <DataTable columns={historyCols} data={billingHistory} />
      </div>
    </>
  );
}
