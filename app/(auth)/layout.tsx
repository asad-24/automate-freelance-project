import Link from "next/link";
import { Bot, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefCapture } from "./signup/ref-capture";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <RefCapture />
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-purple-700 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/20">
            <Bot className="size-5" />
          </span>
          Autopilot
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            The AI client-finding engine for freelancers
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            Join freelancers and agencies who find work, send better proposals, and manage clients in one workspace.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Live job radar across 40+ sources",
              "AI-drafted proposals you review & send",
              "Client portal, milestones & invoice chasing",
              "Unified revenue tracking",
            ].map((f: any) => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/90">
                <CheckCircle2 className="size-4" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">&copy; {new Date().getFullYear()} Autopilot Agency</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
              <Bot className="size-4" />
            </span>
            Autopilot
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
