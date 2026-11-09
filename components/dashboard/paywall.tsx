"use client";
import * as React from "react";
import { Sparkles, CreditCard, Zap, CheckCircle2, Loader2, Crown } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useDemoStore } from "@/lib/demo-store";
import { CREDIT_PACKS } from "@/lib/demo-engine";
import { PAYMENTS_LIVE } from "@/lib/flags";

/**
 * Upgrade / top-up dialog shown when free credits run out.
 * Checkout stays closed until NEXT_PUBLIC_PAYMENTS_LIVE=true (lib/flags.ts); with it set,
 * the purchase is still simulated server-side until Stripe is wired (see SERVICES.md).
 */
export function PaywallDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "bids" | "profiles";
}) {
  const demo = useDemoStore();
  const { toast } = useToast();
  const [step, setStep] = React.useState<"offer" | "checkout">("offer");
  const [choice, setChoice] = React.useState<"pack" | "pro">("pack");
  const [processing, setProcessing] = React.useState(false);
  const [card, setCard] = React.useState({ number: "", name: "", exp: "", cvc: "" });

  const pack = CREDIT_PACKS[kind];
  const isPro = demo?.state.monetization.plan === "pro";

  React.useEffect(() => {
    if (open) {
      setStep("offer");
      setProcessing(false);
      setCard({ number: "", name: "", exp: "", cvc: "" });
    }
  }, [open]);

  const pay = async () => {
    setProcessing(true);
    const done = choice === "pro" ? await demo?.upgradePlan() : await demo?.buyCredits(kind);
    setProcessing(false);
    if (!done) {
      toast({ title: "Purchase didn't go through", description: "Nothing was charged. Please try again." });
      return;
    }
    if (choice === "pro") {
      toast({ title: "Welcome to Pro", description: "Unlimited bids & platform profiles.", variant: "success" });
    } else {
      toast({ title: `${pack.label} added`, description: `$${pack.price} — receipt in Billing.`, variant: "success" });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {step === "offer" ? (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              {kind === "bids" ? "You're out of job bids" : "You're out of profile slots"}
            </DialogTitle>
            <DialogDescription>
              {kind === "bids"
                ? "Your plan includes 10 agent bids. Top up or go unlimited."
                : "Your plan includes 2 platform profiles. Add another or go unlimited."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button
              onClick={() => setChoice("pack")}
              className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${choice === "pack" ? "border-primary bg-accent" : "hover:bg-accent/50"}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Zap className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">{pack.label}</p>
                  <p className="text-xs text-muted-foreground">One-time top-up</p>
                </div>
              </div>
              <span className="font-semibold">${pack.price}</span>
            </button>
            <button
              onClick={() => setChoice("pro")}
              className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${choice === "pro" ? "border-primary bg-accent" : "hover:bg-accent/50"}`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2 text-warning"><Crown className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">Pro — unlimited everything</p>
                  <p className="text-xs text-muted-foreground">All agents, unlimited bids & profiles, priority queue</p>
                </div>
              </div>
              <span className="font-semibold">$19<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
            </button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Maybe later</Button>
            <Button
              variant="gradient"
              onClick={() => (isPro && choice === "pro" ? onOpenChange(false) : setStep("checkout"))}
              disabled={isPro && choice === "pro"}
            >
              Continue
            </Button>
          </div>
        </>
      ) : !PAYMENTS_LIVE ? (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="size-5 text-primary" /> Payments open soon</DialogTitle>
            <DialogDescription>Online checkout isn&apos;t live yet, so nothing was charged and no card details were collected. Upgrades and credit packs will be available shortly.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("offer")}>Back</Button>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </>
      ) : (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" /> Checkout
            </DialogTitle>
            <DialogDescription>
              {choice === "pro" ? "Pro plan — $19/month" : `${pack.label} — $${pack.price} one-time`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            <Input placeholder="Card number" inputMode="numeric" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="MM / YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
              <Input placeholder="CVC" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" /> Secured checkout · cancel anytime
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("offer")}>Back</Button>
            <Button variant="gradient" onClick={pay} disabled={processing}>
              {processing ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              {processing ? "Processing…" : `Pay ${choice === "pro" ? "$19" : `$${pack.price}`}`}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
