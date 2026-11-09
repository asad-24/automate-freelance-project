import Link from "next/link";
import { ArrowRight, Radar, PenLine, Store, Megaphone, MessagesSquare, DollarSign, Gift, Plug, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const services = [
  { icon: Radar, title: "Job Radar", desc: "Live scans across remote boards and marketplaces, ranked by how well each gig matches your skills.", price: "Included in all plans" },
  { icon: PenLine, title: "AI Proposal Writer", desc: "A tailored, editable draft for every opportunity — you review and send it yourself.", price: "Included in all plans" },
  { icon: Store, title: "AI Gig Builder", desc: "Complete Fiverr/Upwork listings — titles, descriptions, packages, tags and FAQ.", price: "Plus & Pro" },
  { icon: Megaphone, title: "Agency Outreach", desc: "Target lists, AI-drafted campaigns and delivery tracking for agency pipeline.", price: "Plus & Pro" },
  { icon: MessagesSquare, title: "Client Workspace", desc: "Conversations, contracts and milestones in one place — chase invoices in one click.", price: "Included in all plans" },
  { icon: DollarSign, title: "Revenue Tracking", desc: "Earnings, invoices, payouts and market-rate intelligence on one dashboard.", price: "Included in all plans" },
  { icon: Gift, title: "Referral Growth", desc: "Share your link, extend your trial from 3 days to 7, and track every signup.", price: "Included in all plans" },
  { icon: Plug, title: "Platform Connections", desc: "Link your Upwork, Fiverr, LinkedIn and other accounts — the workspace works through them.", price: "Plus & Pro" },
  { icon: ShieldCheck, title: "Human-First Controls", desc: "Approval queues, audit logs and compliance mode — you stay in control of every send.", price: "Included in all plans" },
];

export default function ServicesPage() {
  return (
    <div>
      <section className="border-b bg-muted/30 py-20">
        <div className="container max-w-3xl text-center">
          <Badge className="mb-4">The Toolkit</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Everything you need to win clients</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            One workspace for finding work, drafting proposals, building gigs, running outreach,
            managing clients and tracking income — with you approving every send.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s: any) => (
            <Card key={s.title} className="flex flex-col transition-shadow hover:shadow-md">
              <CardContent className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.desc}</p>
                <p className="mt-4 text-sm font-semibold text-primary">{s.price}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30 py-16">
        <div className="container flex flex-col items-center gap-5 text-center">
          <h2 className="text-2xl font-bold">See it working on your own gigs</h2>
          <p className="max-w-xl text-muted-foreground">
            Start your 3-day trial — run a real job scan and get a real proposal drafted in the next two minutes.
          </p>
          <Button size="lg" variant="gradient" asChild>
            <Link href="/signup">
              Start your trial <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
