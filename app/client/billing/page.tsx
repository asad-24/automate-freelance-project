"use client";
import { CreditCard, Rocket, Download, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subscriptionPlans as subscriptionPlansSeed, addonMarketplace as addonMarketplaceSeed, clientInvoices as clientInvoicesSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export default function ClientBillingPage() {
  const { toast } = useToast();
  const subscriptionPlans = useEntity("plans", subscriptionPlansSeed);
  const addonMarketplace = useEntity("addons", addonMarketplaceSeed);
  const clientInvoices = useEntity("client/invoices", clientInvoicesSeed);
  const clientAddons = addonMarketplace.filter((a: any) => a.for === "Clients");
  const clientPlans = subscriptionPlans.filter((p: any) => ["free", "starter", "pro", "business"].includes(p.id));
  const invoiceCols: Column<(typeof clientInvoicesSeed)[number]>[] = [
    { key: "title", header: "Invoice", render: (r) => <span className="font-medium">{r.title}</span> },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "due", header: "Due", render: (r) => formatDate(r.due) },
    {
      key: "action",
      header: "",
      render: (r) =>
        r.status === "Due" ? (
          <Button size="sm" variant="default" onClick={() => { apiPost(`/api/client/invoices/${r.id}/pay`); toast({ title: "Online payment is not connected yet", description: "Your agency will send payment instructions. No charge was made." }); }}>
            Pay now
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => toast({ title: "Receipt downloaded" })}>
            <Download className="size-4" />
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Billing & Plan" description="Your subscription, invoices, and available upgrades." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Basic Plan
            </CardTitle>
            <CardDescription>You're on the Basic plan — upgrade for faster delivery.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>• 1 project / month</li>
              <li>• Standard delivery queue</li>
              <li>• Community support</li>
            </ul>
            <Button variant="gradient" className="mt-5 w-full" onClick={() => toast({ title: "Upgrade started", variant: "success" })}>
              Upgrade — 3-day trial
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <h3 className="mb-3 font-semibold">Upgrade your plan</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {clientPlans.filter((p: any) => p.id !== "free").map((p: any) => (
              <Card key={p.id} className={cn(p.id === "pro" && "border-primary")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.name}</p>
                    <Badge variant="outline">3-day trial</Badge>
                  </div>
                  <p className="mt-1 text-xl font-bold">
                    {formatCurrency(p.price)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.audience}</p>
                  <ul className="mt-3 space-y-1">
                    {p.features.slice(0, 3).map((f: any) => (
                      <li key={f} className="text-xs text-muted-foreground">• {f}</li>
                    ))}
                  </ul>
                  <Button size="sm" variant={p.id === "pro" ? "gradient" : "outline"} className="mt-4 w-full"
                    onClick={() => { apiPost(`/api/billing/plan/${p.id}`); toast({ title: `Upgrading to ${p.name}`, description: "Your 3-day trial is on us.", variant: "success" }); }}>
                    Try {p.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Client add-ons */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Project Add-ons</CardTitle>
          <CardDescription>Accelerate delivery and get extra attention on your projects.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {clientAddons.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-primary">{a.price}</span>
                <Button size="sm" variant="outline" onClick={() => { apiPost(`/api/addons/${a.id}/purchase`); toast({ title: `${a.name} added`, variant: "success" }); }}>
                  Add
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-8">
        <h3 className="mb-3 font-semibold">Invoices</h3>
        <DataTable columns={invoiceCols} data={clientInvoices} />
      </div>
    </>
  );
}
