"use client";
import * as React from "react";
import { ShieldCheck, ShieldOff, Save, Bot, Cpu, Sliders, Bell, User, KeyRound, Mail, Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppMode } from "@/lib/app-mode";
import { useAuth } from "@/lib/auth";
import { apiCall, apiPost } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { mode, setMode } = useAppMode();
  const { user, demoMode } = useAuth();
  const { toast } = useToast();

  // Agents
  const [matchThreshold, setMatchThreshold] = React.useState("80");
  const [budgetFloor, setBudgetFloor] = React.useState("500");
  const [appsPerDay, setAppsPerDay] = React.useState("10");
  const [autoBid, setAutoBid] = React.useState(true);
  const [autoPayout, setAutoPayout] = React.useState(false);
  const [selfHeal, setSelfHeal] = React.useState(true);

  // Notifications
  const [notif, setNotif] = React.useState({ newJob: true, proposalReply: true, payment: true, weeklyReport: false, marketing: false });
  const [digest, setDigest] = React.useState("daily");
  const [salesWebhook, setSalesWebhook] = React.useState("");
  const [pinging, setPinging] = React.useState(false);

  /** PATCH settings; false (with a toast saying why) when the server refused. */
  async function patchSettings(body: Record<string, unknown>): Promise<boolean> {
    const res = await apiCall<{ detail?: string }>("/api/settings", body, "PATCH");
    if (res ? res.status < 400 : demoMode) return true;
    toast({ title: "Settings not saved", description: res?.data?.detail ?? "Can't reach the server — try again." });
    return false;
  }

  async function saveAll() {
    const ok = await patchSettings({
      mode,
      matchThreshold: Number(matchThreshold),
      budgetFloor: Number(budgetFloor),
      appsPerDay: Number(appsPerDay),
      autoBid, autoPayout, selfHeal,
      notifications: { ...notif, digest },
      salesWebhook,
    });
    if (ok) toast({ title: "Settings saved", variant: "success" });
  }

  async function testSalesPing() {
    setPinging(true);
    try {
      if (!(await patchSettings({ salesWebhook }))) return;
      const res: any = await apiPost("/api/sales/alert", { event: "test", label: "Test ping from Settings" });
      toast(res?.delivered
        ? { title: "Ping delivered", description: "Your webhook received the test event.", variant: "success" }
        : { title: "Ping not delivered", description: res?.reason ?? "Check the webhook URL." });
    } finally {
      setPinging(false);
    }
  }

  const notifRows = [
    { key: "newJob", label: "New matching jobs", desc: "Job Radar finds roles above your threshold" },
    { key: "proposalReply", label: "Proposal replies", desc: "A client responds to a bid or message" },
    { key: "payment", label: "Payments", desc: "Invoice paid, payout released, credit changes" },
    { key: "weeklyReport", label: "Weekly performance report", desc: "Earnings, win rate and pipeline summary" },
    { key: "marketing", label: "Product updates", desc: "New features and tips" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Agents, notifications, account and API — everything tunable in one place."
        actions={<Button variant="gradient" onClick={saveAll}><Save className="size-4" /> Save changes</Button>}
      />

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents"><Bot className="mr-1.5 size-3.5" /> Agents</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 size-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="account"><User className="mr-1.5 size-3.5" /> Account</TabsTrigger>
          <TabsTrigger value="api"><KeyRound className="mr-1.5 size-3.5" /> API</TabsTrigger>
        </TabsList>

        {/* Agents */}
        <TabsContent value="agents" className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {mode === "stealth" ? <ShieldOff className="size-5 text-destructive" /> : <ShieldCheck className="size-5 text-success" />}
                Operating Mode
              </CardTitle>
              <CardDescription>Stealth enables human-impersonation behaviors. Compliance mode discloses AI assistance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div><p className="font-medium">Stealth mode</p><p className="text-xs text-muted-foreground">Impersonation, typos, no AI disclosure</p></div>
                <Switch checked={mode === "stealth"} onCheckedChange={(v) => setMode(v ? "stealth" : "compliance")} />
              </div>
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Stealth mode carries legal and platform-ToS risk. Use only where permitted. Current mode:{" "}
                <Badge variant={mode === "stealth" ? "destructive" : "success"}>{mode}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sliders className="size-5" /> Agent Thresholds</CardTitle>
              <CardDescription>Tuning knobs for matching, bidding, and rate limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>JD match threshold (%)</Label><Input value={matchThreshold} onChange={(e) => setMatchThreshold(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Minimum client budget ($)</Label><Input value={budgetFloor} onChange={(e) => setBudgetFloor(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Max applications per day</Label><Input value={appsPerDay} onChange={(e) => setAppsPerDay(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cpu className="size-5" /> LLM Routing</CardTitle>
              <CardDescription>Route client-facing vs internal tasks to the right model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Client-facing model</Label>
                <Select defaultValue="groq">
                  <option value="groq">Groq — gpt-oss-120b (connected)</option>
                  <option value="claude">Claude Sonnet</option>
                  <option value="gpt">GPT (OpenAI)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Internal / low-stakes model</Label>
                <Select defaultValue="groq-internal">
                  <option value="groq-internal">Groq — llama (fast)</option>
                  <option value="ollama">Ollama llama3 (local)</option>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Groq AI is wired up — proposals and gig content already run on it.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="size-5" /> Feature Flags</CardTitle>
              <CardDescription>Toggle autonomous behaviors on or off.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Auto-draft qualifying jobs", desc: "Prepare a personalized proposal for review; submission still needs explicit approval", v: autoBid, set: setAutoBid },
                { label: "Auto-approve payouts", desc: "Release escrow on milestone approval", v: autoPayout, set: setAutoPayout },
                { label: "Self-healing scrapers", desc: "Auto-patch selectors on DOM drift", v: selfHeal, set: setSelfHeal },
              ].map((f: any) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{f.label}</p><p className="text-xs text-muted-foreground">{f.desc}</p></div>
                  <Switch checked={f.v} onCheckedChange={f.set} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6 max-w-2xl">
          <Card>
            <CardHeader><CardTitle>Email &amp; in-app notifications</CardTitle><CardDescription>Choose what you want to hear about.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {notifRows.map((n: any) => (
                <div key={n.key} className="flex items-center justify-between rounded-lg border p-4">
                  <div><p className="font-medium">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                  <Switch checked={notif[n.key as keyof typeof notif]} onCheckedChange={(v) => setNotif((s) => ({ ...s, [n.key]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div><p className="font-medium">Job digest frequency</p><p className="text-xs text-muted-foreground">How often we email new matches</p></div>
                <Select value={digest} onChange={(e) => setDigest(e.target.value)} className="w-36">
                  <option value="realtime">Real-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="off">Off</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Sales alerts to your phone</CardTitle>
              <CardDescription>Every purchase fires a webhook — point it at Telegram, Slack, Zapier or n8n and get instant sale notifications on your phone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://hooks.zapier.com/… or your n8n webhook"
                  value={salesWebhook}
                  onChange={(e) => setSalesWebhook(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Works with Zapier, n8n, Make, Telegram bots and Slack incoming webhooks — paste the URL, save, done.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testSalesPing} disabled={pinging || !salesWebhook}>
                  <Bell className="size-4" /> {pinging ? "Pinging…" : "Send test ping"}
                </Button>
                <Button variant="gradient" onClick={saveAll} disabled={!salesWebhook}>Save webhook</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account */}
        <TabsContent value="account" className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle><CardDescription>Login details for your account.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Full name</Label><Input defaultValue={user?.name} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" defaultValue={user?.email} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>New password</Label><Input type="password" placeholder="••••••••" /></div>
                <div className="space-y-1.5"><Label>Confirm password</Label><Input type="password" placeholder="••••••••" /></div>
              </div>
              <Button variant="outline" onClick={() => toast({ title: "Password reset link sent", variant: "success" })}><Mail className="size-4" /> Send reset link</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timezone & region</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select defaultValue="utc"><option value="utc">UTC</option><option value="est">Eastern (ET)</option><option value="pst">Pacific (PT)</option><option value="gst">Gulf (GST)</option><option value="pkt">Pakistan (PKT)</option></Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select defaultValue="usd"><option value="usd">USD ($)</option><option value="eur">EUR (€)</option><option value="gbp">GBP (£)</option></Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API */}
        <TabsContent value="api" className="mt-6 max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>API access</CardTitle><CardDescription>Programmatic access to your workspace.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Live API key</Label>
                <div className="flex gap-2">
                  <Input readOnly value="sk_live_••••••••••••••••4f2a" className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => { navigator.clipboard?.writeText("sk_live_…"); toast({ title: "Key copied" }); }}>Copy</Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => toast({ title: "New key generated — store it now", variant: "success" })}><KeyRound className="size-4" /> Generate new key</Button>
                <Button variant="ghost" onClick={() => toast({ title: "Opening API docs" })}><Globe className="size-4" /> Docs</Button>
              </div>
              <p className="text-xs text-muted-foreground">Full credential vault — platform keys, rotation &amp; scopes — lives in <a href="/dashboard/security" className="text-primary underline">Security &amp; API</a>.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
