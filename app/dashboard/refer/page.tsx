"use client";
import * as React from "react";
import {
  Gift, Share2, Copy, Users, CheckCircle2, Timer,
  Linkedin, Twitter, MessageCircle, Facebook,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useDemoStore } from "@/lib/demo-store";
import { formatRelative } from "@/lib/utils";
import { trialDaysLeft, trialExtended, TRIAL_BASE_DAYS, TRIAL_EXTENDED_DAYS } from "@/lib/demo-engine";
import { PAYMENTS_LIVE } from "@/lib/flags";

export default function ReferPage() {
  const { toast } = useToast();
  const demo = useDemoStore();
  const growth = demo?.state.growth;

  const daysLeft = growth ? trialDaysLeft(growth) : TRIAL_BASE_DAYS;
  const extended = growth ? trialExtended(growth) : false;
  const expired = daysLeft <= 0;
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : "https://autopilotv2.vercel.app"}/signup?ref=${growth?.referralCode ?? ""}`;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copied`, variant: "success" }); }
    catch { toast({ title: "Copy blocked by browser" }); }
  };

  const shareText = `I'm using Autopilot — AI that finds freelance gigs and drafts proposals I review and send. Try it with my link:`;
  const share = (channel: string, url?: string) => {
    const res = demo?.recordShare(channel);
    toast({
      title: res?.extended ? "Trial extended to 7 days!" : "Share recorded",
      description: res?.extended ? "Full access for a whole week — nice." : undefined,
      variant: "success",
    });
    if (url) window.open(url, "_blank", "noopener");
  };

  const [refName, setRefName] = React.useState("");
  const invite = () => {
    if (!refName.trim()) return;
    const res = demo?.addReferral(refName.trim(), "Direct");
    toast({
      title: res?.extended ? "Trial extended to 7 days!" : "Referral tracked",
      description: res?.extended ? `${refName} invited — and your trial just got longer.` : `${refName} added to your referral list.`,
      variant: "success",
    });
    setRefName("");
  };

  const referralCols: Column<any>[] = [
    { key: "name", header: "Friend", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "channel", header: "Channel", render: (r) => <Badge variant="outline">{r.channel}</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "at", header: "Invited", render: (r) => <span className="text-muted-foreground">{formatRelative(r.at)}</span> },
    { key: "x", header: "", render: (r) => r.status === "Invited" && (
      <Button size="sm" variant="ghost" className="text-success" onClick={() => demo?.markReferralSignedUp(r.id)}>
        Mark signed up
      </Button>
    ) },
  ];

  const shareButtons = [
    { label: "X / Twitter", icon: Twitter, url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + " " + referralLink)}` },
    { label: "LinkedIn", icon: Linkedin, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}` },
    { label: "WhatsApp", icon: MessageCircle, url: `https://wa.me/?text=${encodeURIComponent(shareText + " " + referralLink)}` },
    { label: "Facebook", icon: Facebook, url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}` },
  ];

  const signedUp = growth?.referrals.filter((r: any) => r.status !== "Invited").length ?? 0;

  return (
    <>
      <PageHeader
        title="Refer & Extend"
        description="Share Autopilot, grow your trial, and track every friend who joins through your link."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Trial status hero */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your trial</p>
                <p className="mt-1 text-4xl font-bold tracking-tight">
                  {expired ? "Ended" : `${daysLeft}d`}
                  {!expired && <span className="ml-1 text-base font-normal text-muted-foreground">left</span>}
                </p>
              </div>
              <Badge variant={expired ? "destructive" : extended ? "success" : "warning"}>
                {expired ? "Expired" : extended ? "Extended" : "Active"}
              </Badge>
            </div>
            <Progress
              className="mt-4"
              value={expired ? 100 : ((growth?.trialDays ?? TRIAL_BASE_DAYS) - daysLeft) / (growth?.trialDays ?? TRIAL_BASE_DAYS) * 100}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {extended
                ? `${TRIAL_EXTENDED_DAYS}-day trial unlocked — you earned the extension.`
                : `${TRIAL_BASE_DAYS}-day trial · share or refer a friend to unlock ${TRIAL_EXTENDED_DAYS} days.`}
            </p>

            {!extended && !expired && (
              <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Timer className="size-4 text-primary" /> Get 4 more days
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share Autopilot once or refer one friend — your trial extends automatically.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {shareButtons.map((s: any) => (
                    <Button key={s.label} size="sm" variant="outline" className="gap-1.5" onClick={() => share(s.label, s.url)}>
                      <s.icon className="size-3.5" /> {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {extended && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" /> Extension unlocked — keep referring to grow your reach.
              </div>
            )}
            {expired && (
              <Button className="mt-5 w-full" variant="gradient" onClick={() => PAYMENTS_LIVE ? demo?.upgradePlan() : toast({ title: "Payments open soon", description: "Online checkout isn't live yet. Nothing was charged." })}>
                Upgrade to Pro — $19/mo
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Referral link + invite */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Share2 className="size-4 text-primary" /> Your referral link</CardTitle>
            <CardDescription>
              {growth?.referrals.length ?? 0} invited · {signedUp} signed up · every signup through this link is tracked.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={referralLink} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => copy(referralLink, "Referral link")}><Copy className="size-4" /></Button>
            </div>

            <div className="flex gap-2">
              <Input placeholder="Friend's name or email" value={refName} onChange={(e) => setRefName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()} />
              <Button onClick={invite} disabled={!refName.trim()}><Users className="size-4" /> Invite</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Inviting a friend also extends your trial — same reward, more personal.
            </p>

            {growth && growth.referrals.length > 0 ? (
              <DataTable columns={referralCols} data={growth.referrals} />
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No referrals yet — share your link or invite someone directly.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {growth && growth.shares.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Shares:</span>
          {growth.shares.map((s: any) => (
            <Badge key={s.id} variant="secondary">{s.channel} · {formatRelative(s.at)}</Badge>
          ))}
        </div>
      )}
    </>
  );
}
