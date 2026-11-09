import Link from "next/link";
import { Bot, Github, Linkedin, Twitter } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/services", label: "Toolkit" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
    ],
  },
  {
    title: "Access",
    links: [
      { href: "/login", label: "Login" },
      { href: "/signup", label: "Sign Up" },
      { href: "/client", label: "Client Portal" },
      { href: "/freelancer", label: "Freelancer Portal" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/legal/ai-disclosure", label: "AI Disclosure" },
      { href: "/welcome", label: "Product Tour" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                <Bot className="size-5" />
              </span>
              <span className="text-lg">Autopilot</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              The AI client-finding engine for freelancers. You approve, we draft.
            </p>
            <div className="mt-4 flex gap-3 text-muted-foreground">
              <Twitter className="size-5 hover:text-primary" />
              <Linkedin className="size-5 hover:text-primary" />
              <Github className="size-5 hover:text-primary" />
            </div>
          </div>
          {columns.map((c: any) => (
            <div key={c.title}>
              <h4 className="mb-3 text-sm font-semibold">{c.title}</h4>
              <ul className="space-y-2">
                {c.links.map((l: any) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted-foreground hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Autopilot Agency. All rights reserved.</p>
          <p>Built with Next.js · Deployed on Vercel</p>
        </div>
      </div>
    </footer>
  );
}
