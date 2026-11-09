"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Bot, Gauge, Network, DollarSign, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const steps = [
  {
    icon: Bot,
    title: "Welcome to Autopilot",
    body: "The AI client-finding engine for freelancers. Find work, send better proposals, and manage your whole business in one workspace.",
    bullets: ["Live job radar across 40+ sources", "AI-drafted proposals you approve", "Clients, contracts & revenue in one place"],
  },
  {
    icon: Network,
    title: "How it works",
    body: "Job Radar scans marketplaces for gigs matching your skills, AI drafts a tailored proposal for each one, and you review and send it yourself — then track the contract through delivery and payment.",
    bullets: ["Scan → Draft → You approve & send", "Milestones, invoices & client portal", "Real results tracked on your dashboard"],
  },
  {
    icon: DollarSign,
    title: "Grow with referrals",
    body: "Every account starts with a 3-day full-access trial. Share Autopilot or refer a friend and your trial extends to a full week — then keep the momentum with outreach campaigns.",
    bullets: ["3-day trial, extends to 7 on share", "Referral link & tracking built in", "Upgrade for unlimited bids & profiles"],
  },
];

export default function WelcomePage() {
  const [step, setStep] = React.useState(0);
  const router = useRouter();
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-accent/40 hero-grid">
      <header className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
            <Bot className="size-5" />
          </span>
          Autopilot
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">Skip</Link>
          </Button>
        </div>
      </header>

      <div className="container flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto mb-8 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-white shadow-lg">
            <s.icon className="size-9" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{s.title}</h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">{s.body}</p>

          <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-2 text-left">
            {s.bullets.map((b: any) => (
              <li key={b} className="flex items-center gap-2 text-sm">
                <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="size-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((v) => v - 1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {!last ? (
              <Button variant="gradient" onClick={() => setStep((v) => v + 1)}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button variant="gradient" onClick={() => router.push("/signup")}>
                Get Started <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
