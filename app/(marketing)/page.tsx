import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Briefcase,
  CheckCircle2,
  Gauge,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Megaphone,
  DollarSign,
  Radar,
  FileCheck2,
  Users,
  Receipt,
  PenLine,
  Store,
  Eye,
  Gift,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const steps = [
  { icon: Radar, title: "Scan", desc: "Job Radar watches live feeds across marketplaces and remote boards, ranked by how well each gig matches your skills." },
  { icon: PenLine, title: "Draft", desc: "AI writes a tailored proposal for each opportunity — specific plan, relevant skills, a real question for the client." },
  { icon: Eye, title: "You review & send", desc: "Nothing goes out without your approval. Edit the draft, copy it, and submit it yourself — you're always in control." },
  { icon: DollarSign, title: "Track & get paid", desc: "Contracts, milestones, invoices and revenue live in one workspace — see exactly what your pipeline is worth." },
];

const capabilities = [
  { icon: Radar, name: "Job Radar", tag: "Acquisition", desc: "Live scans across remote boards and marketplaces, matched to your skills — 40+ sources refreshed continuously." },
  { icon: PenLine, name: "Proposal Writer", tag: "Conversion", desc: "AI drafts a personalized bid per job. You review, edit and send it yourself — every word is yours." },
  { icon: Store, name: "AI Gig Builder", tag: "Storefront", desc: "Generates complete Fiverr/Upwork listings — titles, descriptions, 3-tier pricing, tags and FAQ." },
  { icon: Megaphone, name: "Outreach Engine", tag: "B2B Direct", desc: "Agency email campaigns and platform outreach with AI-personalized drafts — human-reviewed, provider-delivered." },
  { icon: MessagesSquare, name: "Client Manager", tag: "Delivery", desc: "Conversations, contracts and milestone tracking in one inbox — chase invoices with one click." },
  { icon: ShieldCheck, name: "Quality & Trust", tag: "Control", desc: "Human-in-the-loop by design: approve every send, monitor every agent action in the audit log." },
];

const strategies = [
  { icon: Radar, title: "Multi-Source Job Scanning" },
  { icon: PenLine, title: "AI Proposal Drafting" },
  { icon: Store, title: "AI Gig Builder" },
  { icon: Megaphone, title: "Agency Email Campaigns" },
  { icon: Users, title: "Client Portal & Milestones" },
  { icon: Receipt, title: "Invoice & Payment Chasing" },
  { icon: Gauge, title: "Market Rate Intelligence" },
  { icon: Gift, title: "Referral Growth Engine" },
  { icon: Wallet, title: "Unified Revenue Tracking" },
  { icon: ShieldCheck, title: "Human-Approval Workflow" },
  { icon: Bot, title: "Agent Activity Audit Log" },
  { icon: FileCheck2, title: "Deliverable QA Checks" },
];

const stack = [
  "Next.js", "FastAPI", "MongoDB", "Groq LLM", "Tailwind CSS", "Resend", "Vercel",
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden hero-grid">
        <div className="container relative py-24 text-center md:py-32">
          <Badge className="mx-auto mb-6 w-fit gap-1.5 px-3 py-1">
            <Sparkles className="size-3.5" /> The AI client-finding engine for freelancers
          </Badge>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl">
            Find clients. Send better proposals.{" "}
            <span className="gradient-text">You approve, we draft.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Autopilot scans job boards and marketplaces for work that fits your skills, drafts the
            proposal, and builds your gigs — you review everything and hit send yourself.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="xl" variant="gradient" asChild>
              <Link href="/signup">
                Start Your Trial <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">3-day trial · extends to 7 when you share · no card required</p>
          <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { k: "40+", v: "Job sources scanned" },
              { k: "8", v: "AI workspace agents" },
              { k: "100%", v: "Human-approved sends" },
              { k: "24/7", v: "Always-on radar" },
            ].map((s: any) => (
              <div key={s.v}>
                <p className="text-3xl font-bold gradient-text">{s.k}</p>
                <p className="text-sm text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <SectionHeading
            eyebrow="How It Works"
            title="From job post to paid invoice — one workflow"
            subtitle="AI does the scanning and drafting. You keep approval over everything that goes out."
          />
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <Card key={s.title} className="relative">
                <CardContent className="p-6">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">STEP {i + 1}</div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20">
        <div className="container">
          <SectionHeading
            eyebrow="The Workspace"
            title="Everything a freelancer needs to win work"
            subtitle="One place to find opportunities, build your storefront, manage clients and track income."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((a: any) => (
              <Card key={a.name} className="group transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                      <a.icon className="size-5" />
                    </div>
                    <Badge variant="secondary">{a.tag}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold">{a.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature wall */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <SectionHeading
            eyebrow="Built-In Toolkit"
            title="Every tool, working together"
            subtitle="Finding work, winning it, delivering it, and getting paid — connected in one place."
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {strategies.map((s: any) => (
              <div
                key={s.title}
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <s.icon className="size-5 shrink-0 text-primary" />
                <span className="text-sm font-medium">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20">
        <div className="container">
          <SectionHeading
            eyebrow="Built for every role"
            title="Tailored dashboards for every user"
            subtitle="Freelancers, clients, and agencies each get a purpose-built experience."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { role: "Freelancer / Operator", href: "/dashboard", desc: "Job radar, AI proposals, gig builder, outreach tools, clients and revenue — your whole business in one console.", icon: Gauge },
              { role: "Client", href: "/client", desc: "A clean portal to track milestones, review files, message the team, and pay invoices.", icon: Users },
              { role: "Team Member", href: "/freelancer", desc: "See assigned specs, submit your work, track contracts and earnings in your own workspace.", icon: Briefcase },
            ].map((r: any) => (
              <Card key={r.role} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <r.icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{r.role}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.desc}</p>
                  <Button variant="outline" className="mt-4 w-fit" asChild>
                    <Link href={r.href}>
                      Open dashboard <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container text-center">
          <SectionHeading
            eyebrow="Modern Stack"
            title="Built on proven, production-grade technology"
            subtitle="Fast, reliable infrastructure — so the tools you depend on stay online."
          />
          <div className="flex flex-wrap justify-center gap-3">
            {stack.map((t: any) => (
              <Badge key={t} variant="outline" className="px-4 py-2 text-sm">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-20">
        <div className="container">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing that pays for itself"
            subtitle="Start free. Upgrade when the pipeline starts working for you."
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { name: "Basic", price: "$0", who: "Try the platform — 10 bids + 2 profile slots" },
              { name: "Plus", price: "$9", who: "More bids, more scans, priority matching" },
              { name: "Pro", price: "$19", who: "Unlimited bids & profiles, full workspace", hot: true },
            ].map((t: any) => (
              <Card key={t.name} className={`text-center ${t.hot ? "border-2 border-primary" : ""}`}>
                <CardContent className="p-5">
                  {t.hot && <Badge className="mb-2">Popular</Badge>}
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="mt-1 text-2xl font-bold">{t.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.who}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button size="lg" variant="gradient" asChild>
              <Link href="/pricing">
                Compare all plans <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">3-day trial on every paid plan · extends to 7 days when you share</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-purple-600 text-white">
            <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
              <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">
                Your next client is already posted somewhere
              </h2>
              <p className="max-w-xl text-white/90">
                Run your first job scan in the next two minutes — see real opportunities matched to
                your skills, with a proposal drafted for each one.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="xl" variant="secondary" asChild>
                  <Link href="/signup">Start your trial</Link>
                </Button>
                <Button size="xl" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10" asChild>
                  <Link href="/contact">Talk to us</Link>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-6 pt-2 text-sm text-white/80">
                {["3-day trial on all plans", "No card required", "You approve every send"].map((t: any) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" /> {t}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
