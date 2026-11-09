"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn, formatCurrency } from "@/lib/utils";
import { subscriptionPlans as subscriptionPlansSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";

export default function PricingPage() {
  const subscriptionPlans = useEntity("plans", subscriptionPlansSeed);
  const [yearly, setYearly] = React.useState(false);
  const price = (p: number) => (yearly ? Math.round(p * 0.8) : p);

  return (
    <div>
      <section className="border-b bg-muted/30 py-20">
        <div className="container max-w-3xl text-center">
          <Badge className="mb-4 gap-1.5" variant="default">
            <Sparkles className="size-3.5" /> 3-day trial on every paid plan
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Simple pricing that <span className="gradient-text">pays for itself.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Start free, upgrade when your pipeline fills up. Share or refer a friend and your
            trial extends from 3 days to a full week.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={cn("text-sm", !yearly && "font-semibold")}>Monthly</span>
            <Switch checked={yearly} onCheckedChange={setYearly} />
            <span className={cn("text-sm", yearly && "font-semibold")}>
              Yearly <Badge variant="success" className="ml-1">Save 20%</Badge>
            </span>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptionPlans.map((t: any) => (
            <Card
              key={t.id}
              className={cn("relative flex flex-col", t.highlight && "border-2 border-primary shadow-lg")}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1"><Sparkles className="size-3" /> Most popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  {t.name}
                  {t.id !== "free" && (
                    <Badge variant="outline" className="font-normal">3-day trial</Badge>
                  )}
                </CardTitle>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold">
                    {formatCurrency(price(t.price))}
                  </span>
                  <span className="mb-1 text-sm text-muted-foreground">/mo{yearly && t.price > 0 ? " billed yearly" : ""}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t.audience}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-2.5">
                  {t.features.map((f: any) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                        <Check className="size-3.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={t.highlight ? "gradient" : "outline"} asChild>
                  <Link href="/signup">{t.id === "free" ? "Get started" : "Start your trial"}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Every paid plan starts with a 3-day trial — share or refer and it extends to 7 days.
        </p>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <Card className="mx-auto max-w-4xl border-0 bg-gradient-to-br from-primary to-purple-600 text-white">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <Rocket className="size-10" />
              <h3 className="text-2xl font-bold">Find your next client this week</h3>
              <p className="max-w-md text-white/85">
                Run your first job scan, get a proposal drafted, and send it — all inside your trial.
              </p>
              <Button size="lg" variant="secondary" className="mt-2" asChild>
                <Link href="/signup">Start your trial</Link>
              </Button>
              <p className="text-xs text-white/70">No card required to start · cancel anytime</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
