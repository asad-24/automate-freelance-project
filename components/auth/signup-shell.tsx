"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth, dashboardHomeFor, type Role } from "@/lib/auth";
import { apiCall } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export function SignupShell({
  role,
  title,
  subtitle,
  children,
}: {
  role: Role;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { login, demoMode } = useAuth();
  const { toast } = useToast();
  const [agree, setAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/signup">
          <ArrowLeft className="size-4" /> All account types
        </Link>
      </Button>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const val = (id: string) =>
            (form.querySelector(`#${id}`) as HTMLInputElement | null)?.value?.trim() || "";
          const first = val("first");
          const last = val("last");
          const name = [first, last].filter(Boolean).join(" ") || undefined;
          const email = val("email") || undefined;
          const company = val("agency") || val("company") || undefined;
          const password = val("password");
          const confirm = val("confirm");
          if (confirm && password !== confirm) {
            toast({ title: "Passwords don't match" });
            return;
          }
          setLoading(true);
          try {
            // Frontend-only demo (no backend) continues with a local session;
            // with a backend the account and session come from the server.
            const res = await apiCall<{ ok: boolean; token?: string; user?: any; detail?: string }>(
              "/api/auth/signup",
              { name: name ?? "", email: email ?? "", password, role, company: company ?? "" }
            );
            if (!res && !demoMode) {
              toast({ title: "Can't reach the server", description: "Check your connection and try again." });
              return;
            }
            if (res && res.status >= 400) {
              toast({
                title: res.status === 409 ? "Email already registered" : "Couldn't create account",
                description: res.data.detail ?? "Please try again.",
              });
              return;
            }
            const user = res?.data?.user;
            login(role, {
              ...(user?.id ? { id: user.id } : {}),
              name: user?.name ?? name,
              email: user?.email ?? email,
              company: user?.company || company,
              owner: user?.owner,
            }, res?.data?.token);
            if (res?.data?.ok) {
              toast({ title: "Account created", description: "Your workspace is saved to the database.", variant: "success" });
            }
            // New agency owners go through the guided "get your first clients"
            // onboarding; other roles land on their portals.
            router.push(role === "admin" ? "/dashboard/command" : dashboardHomeFor(role));
          } finally {
            setLoading(false);
          }
        }}
      >
        {children}
        <div className="flex items-start gap-2">
          <Checkbox id="agree" checked={agree} onCheckedChange={setAgree} />
          <Label htmlFor="agree" className="text-sm font-normal text-muted-foreground">
            I agree to the{" "}
            <Link href="/legal/terms" className="text-primary hover:underline">Terms</Link> and{" "}
            <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </Label>
        </div>
        <Button type="submit" variant="gradient" className="w-full" disabled={!agree || loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
