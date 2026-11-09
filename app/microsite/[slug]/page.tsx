import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { portfolioItems } from "@/lib/mock-data";

function titleCase(slug: string) {
  return slug
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((w: any) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function MicrositePage({ params }: { params: { slug: string } }) {
  const company = titleCase(params.slug);
  const relevant = portfolioItems.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/30">
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
            <Bot className="size-5" />
          </span>
          Autopilot × {company}
        </div>
        <Button variant="gradient" asChild>
          <Link href="/contact">Book a call</Link>
        </Button>
      </header>

      <section className="container py-20 text-center">
        <Badge className="mx-auto mb-5 w-fit gap-1.5">
          <Sparkles className="size-3.5" /> Personalized for {company}
        </Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
          {company}, here's how we'd build <span className="gradient-text">your next product</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          We hand-picked the work below because it semantically matches what {company} is looking for. Delivered
          fast, gated by automated QA, and shipped under one dedicated team.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="xl" variant="gradient" asChild>
            <Link href="/contact">
              Start a project <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild>
            <Link href="/portfolio">See full portfolio</Link>
          </Button>
        </div>
      </section>

      <section className="container pb-16">
        <h2 className="mb-6 text-center text-2xl font-bold">Relevant work for {company}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {relevant.map((p: any) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="aspect-video overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
              </div>
              <CardContent className="p-5">
                <h3 className="font-semibold">{p.title}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t: any) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container pb-24">
        <Card className="border-0 bg-gradient-to-br from-primary to-purple-600 text-white">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <h2 className="max-w-xl text-3xl font-bold">Let's build something for {company}</h2>
            <div className="flex flex-wrap justify-center gap-6 pt-2 text-sm text-white/90">
              {["Fixed milestones", "QA-gated delivery", "Dedicated team"].map((t: any) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> {t}
                </span>
              ))}
            </div>
            <Button size="xl" variant="secondary" className="mt-2" asChild>
              <Link href="/contact">Book your discovery call</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
