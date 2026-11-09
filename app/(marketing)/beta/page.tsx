"use client";
import * as React from "react";
import { useState } from "react";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_URL, fetchWithTimeout } from "@/lib/api";

export default function BetaPage() {
  const [form, setForm] = useState({ name: "", email: "", role: "freelancer", area: "", feedback: "", rating: 0 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/beta-testers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 409) { setError("This email is already in the beta — thanks for joining earlier!"); return; }
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("Couldn't submit right now — try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h1 className="mt-4 text-2xl font-bold">You're in.</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We'll send your invite and put your feedback in front of the team. Thanks for helping shape Autopilot.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Rocket className="size-6" /></div>
          <CardTitle className="text-2xl">Join the Autopilot beta</CardTitle>
          <CardDescription>25 testers, first come first served. Tell us who you are and what you're struggling with — we read everything.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>I'm a…</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="freelancer">Freelancer</option>
                <option value="agency">Agency owner</option>
                <option value="client">Client hiring freelancers</option>
                <option value="other">Something else</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>What would you use Autopilot for? (optional)</Label>
              <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Finding clients, proposals, invoicing…" />
            </div>
            <div className="space-y-1.5">
              <Label>Feedback or biggest pain point (optional)</Label>
              <Textarea rows={3} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="What hurts most in your freelance workflow today?" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="gradient" className="w-full" disabled={busy || !form.name || !form.email}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Join the beta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
