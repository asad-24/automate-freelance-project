"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
          <MailCheck className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a password reset link to your inbox. It may take a few minutes to arrive.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/login">
            <ArrowLeft className="size-4" /> Back to login
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Forgot password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we'll send you a reset link.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" required />
        </div>
        <Button type="submit" variant="gradient" className="w-full">
          Send reset link
        </Button>
      </form>
      <Button variant="ghost" size="sm" className="mt-4 w-full" asChild>
        <Link href="/login">
          <ArrowLeft className="size-4" /> Back to login
        </Link>
      </Button>
    </div>
  );
}
