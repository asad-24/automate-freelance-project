import Link from "next/link";
import { ArrowRight, Briefcase, Gauge, Users, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const roles = [
  {
    href: "/signup/admin",
    icon: Gauge,
    title: "Agency / Admin",
    desc: "Run the autonomous agency — control agents, arbitrage, margins, and payouts.",
  },
  {
    href: "/signup/freelancer",
    icon: Briefcase,
    title: "Freelancer",
    desc: "Join the vetted pool, bid on broadcast specs, deliver, and get paid.",
  },
  {
    href: "/signup/client",
    icon: Users,
    title: "Client",
    desc: "Get world-class software delivered — track milestones and pay securely.",
  },
];

export default function SignupPage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <Badge className="mb-3 gap-1.5" variant="default">
          <Sparkles className="size-3.5" /> 3-day trial on all paid plans
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose the account type that fits you.</p>
      </div>

      <div className="space-y-3">
        {roles.map((r: any) => (
          <Link key={r.href} href={r.href}>
            <Card className="group cursor-pointer transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <r.icon className="size-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
                <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
