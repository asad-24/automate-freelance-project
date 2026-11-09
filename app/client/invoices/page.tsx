"use client";
import { CreditCard, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clientInvoices as clientInvoicesSeed } from "@/lib/mock-data";
import { apiPost } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

function downloadReceipt(i: any) {
  const lines = [
    "RECEIPT",
    `Invoice: ${i.id}`,
    `Description: ${i.title ?? i.description ?? i.project ?? "Invoice"}`,
    `Amount: ${formatCurrency(i.amount)}`,
    `Status: ${i.status}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = `receipt-${i.id}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ClientInvoicesPage() {
  const { toast } = useToast();
  const clientInvoices = useEntity("client/invoices", clientInvoicesSeed);
  return (
    <>
      <PageHeader title="Invoices" description="Pay milestones securely via Stripe." />
      <div className="space-y-3">
        {clientInvoices.map((i: any) => (
          <Card key={i.id}>
            <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium">{i.title}</p>
                <p className="text-sm text-muted-foreground">Due {formatDate(i.due)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">{formatCurrency(i.amount)}</span>
                <StatusBadge status={i.status} />
                {i.status === "Due" ? (
                  <Button variant="gradient" size="sm" onClick={() => { apiPost(`/api/client/invoices/${i.id}/pay`); toast({ title: "Online payment is not connected yet", description: "Your agency will send payment instructions. No charge was made." }); }}>
                    <CreditCard className="size-4" /> Pay now
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => downloadReceipt(i)}>
                    <Download className="size-4" /> Receipt
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
