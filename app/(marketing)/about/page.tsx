import { Bot, Target, Rocket, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const values = [
  { icon: Rocket, title: "Velocity", desc: "We build on proven, production-grade infrastructure and ship improvements to the workspace every week." },
  { icon: Target, title: "Results-obsessed", desc: "Every feature exists to move one number: clients won. Leads, proposals, conversions and revenue are always measurable." },
  { icon: ShieldCheck, title: "Human in control", desc: "Human-in-the-loop by design — you review every proposal and message before it goes out. Nothing sends silently." },
];

export default function AboutPage() {
  return (
    <div>
      <section className="border-b bg-muted/30 py-20">
        <div className="container max-w-3xl text-center">
          <Badge className="mb-4">About Us</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            One workspace for <span className="gradient-text">winning work</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Autopilot is the AI client-finding engine for freelancers and agencies. We connect job discovery,
            proposal writing, client management and revenue tracking into a single workflow — with a human
            approving every send.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container grid gap-6 md:grid-cols-3">
          {values.map((v: any) => (
            <Card key={v.title}>
              <CardContent className="p-6">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <v.icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-20">
        <div className="container flex flex-col items-center gap-4 text-center">
          <Bot className="size-10 text-primary" />
          <h2 className="max-w-xl text-2xl font-bold">Modern stack, built to stay online</h2>
          <p className="max-w-2xl text-muted-foreground">
            Built on Next.js, FastAPI, MongoDB, Tailwind CSS and Groq LLM — deployed on Vercel and Render
            for fast, reliable delivery.
          </p>
        </div>
      </section>
    </div>
  );
}
