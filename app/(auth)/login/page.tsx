"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github, Chrome, Briefcase, Users, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth, dashboardHomeFor, type Role } from "@/lib/auth";
import { apiCall } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const quickRoles: { role: Role; label: string; icon: any }[] = [
  { role: "admin", label: "Agent / Admin", icon: Gauge },
  { role: "freelancer", label: "Freelancer", icon: Briefcase },
  { role: "client", label: "Client", icon: Users },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, demoMode } = useAuth();
  const { toast } = useToast();
  const [remember, setRemember] = React.useState(true);
  const [role, setRole] = React.useState<Role>("admin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Frontend-only demo (no backend) signs in locally; with a backend the
      // session must come from the server.
      const res = await apiCall<{ ok: boolean; token?: string; user?: any; detail?: string }>(
        "/api/auth/login",
        { email, password, role }
      );
      if (!res && !demoMode) {
        toast({ title: "Can't reach the server", description: "Check your connection and try again." });
        return;
      }
      if (res && !res.data.ok) {
        toast({
          title: res.status === 401 ? "Invalid credentials" : res.status === 429 ? "Too many attempts" : "Sign-in failed",
          description: res.data.detail ?? "Check your email/password or create an account.",
        });
        return;
      }
      const user = res?.data?.user;
      // Always use the account's real role from the server — never the tab
      // the user happened to click.
      const actualRole = (user?.role as Role) ?? role;
      const name: string | undefined = user?.name ?? email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
      login(actualRole, {
        ...(user?.id ? { id: user.id } : {}),
        email: user?.email ?? (email || undefined),
        name: name ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined,
        company: user?.company,
        owner: user?.owner,
      }, res?.data?.token);
      router.push(dashboardHomeFor(actualRole));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your Autopilot account.</p>
      </div>

      <div className="mb-4">
        <Label className="mb-2 block">Sign in as</Label>
        <div className="grid grid-cols-3 gap-2">
          {quickRoles.map((r: any) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setRole(r.role)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${
                role === r.role ? "border-primary bg-accent text-primary" : "hover:bg-accent"
              }`}
            >
              <r.icon className="size-4" />
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="remember" checked={remember} onCheckedChange={setRemember} />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
            Remember me
          </Label>
        </div>
        <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={submit}>
          <Chrome className="size-4" /> Google
        </Button>
        <Button variant="outline" onClick={submit}>
          <Github className="size-4" /> GitHub
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
