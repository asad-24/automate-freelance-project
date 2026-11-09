"use client";
import * as React from "react";
import Link from "next/link";
import Nango from "@nangohq/frontend";
import {
  Plug, Plus, Trash2, Pause, Play, Link2, Unlink, Briefcase, Gavel,
  Megaphone, Globe, Zap, CheckCircle2, Store, Sparkles, Copy, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PaywallDialog } from "@/components/dashboard/paywall";
import { useDemoStore } from "@/lib/demo-store";
import { useEntity } from "@/lib/use-entity";
import { API_URL, apiCall, apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PLATFORMS_CONNECTABLE } from "@/lib/demo-engine";
import { CATEGORY_LABELS, GIG_DRAFT_TARGETS, SETUP_PLATFORMS, gigEditorUrl, type PlatformCategory } from "@/lib/platforms";
import {
  proposals as proposalsSeed, appliedJobs as jobsSeed,
  salesLeads as salesSeed, freelanceLeads as leadsSeed,
} from "@/lib/mock-data";
import { cn, formatCurrency, formatRelative } from "@/lib/utils";

const CATEGORIES = ["Web Development", "AI & Automation", "Design", "Marketing", "Data", "Mobile Apps", "Other"];

type GeneratedGig = {
  titles: string[];
  description: string;
  packages: { name: string; price: number; deliveryDays: number; details: string }[];
  tags: string[];
  faq: { q: string; a: string }[];
};
type GigForm = {
  platform: string;
  platforms: string[];
  title: string;
  price: string;
  category: string;
  description: string;
  deliveryDays: string;
  titles: string[];
  packages: GeneratedGig["packages"];
  tags: string[];
  faq: GeneratedGig["faq"];
};

const SETUP_PREVIEW = 8;

const emptyGigForm = (): GigForm => ({
  platform: "", platforms: [], title: "", price: "", category: CATEGORIES[0],
  description: "", deliveryDays: "7", titles: [], packages: [], tags: [], faq: [],
});

export default function AccountsPage() {
  const { toast } = useToast();
  const demo = useDemoStore();
  const { user, demoMode } = useAuth();
  const accounts = useEntity("accounts", [] as any[]);
  const gigs = useEntity("gigs", [] as any[]);
  const proposals = useEntity("proposals", proposalsSeed);
  const jobs = useEntity("jobs", jobsSeed);
  const salesLeads = useEntity("sales-leads", salesSeed);
  const monetization = useEntity("user-monetization", { plan: "free", bidCredits: 10, profileCredits: 2, purchases: [] } as any);

  const [connectOpen, setConnectOpen] = React.useState<string | null>(null); // platform id
  const [handle, setHandle] = React.useState("");
  const [gigOpen, setGigOpen] = React.useState(false);
  const [paywall, setPaywall] = React.useState<"bids" | "profiles" | null>(null);
  const [gig, setGig] = React.useState<GigForm>(emptyGigForm);
  const [editingGigId, setEditingGigId] = React.useState<string | null>(null);

  // AI Gig Builder state
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [builderService, setBuilderService] = React.useState("");
  const [builderPlatform, setBuilderPlatform] = React.useState("Fiverr");
  const [generated, setGenerated] = React.useState<GeneratedGig | null>(null);
  const [genLoading, setGenLoading] = React.useState(false);
  const [serverSetupProgress, setServerSetupProgress] = React.useState<Record<string, string[]>>({});
  const [nangoIntegrations, setNangoIntegrations] = React.useState<string[]>([]);
  const [nangoConnections, setNangoConnections] = React.useState<Record<string, { connectionId: string; connectedAt?: string }>>({});
  const [nangoLoading, setNangoLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    apiGet<any>("/api/settings").then((res) => {
      if (active && res) setServerSetupProgress(res.accountSetup ?? {});
    });
    apiGet<{ integrations?: string[]; connections?: Record<string, { connectionId: string; connectedAt?: string }> }>("/api/integrations/nango").then((res) => {
      if (active && res) {
        setNangoIntegrations(res.integrations ?? []);
        setNangoConnections(res.connections ?? {});
      }
    });
    return () => { active = false; };
  }, []);

  const [setupCategory, setSetupCategory] = React.useState<PlatformCategory | "all">("all");
  const [setupExpanded, setSetupExpanded] = React.useState(false);
  const setupCategories = (Object.keys(CATEGORY_LABELS) as PlatformCategory[])
    .filter((c) => SETUP_PLATFORMS.some((p) => p.category === c));
  const setupMatches = SETUP_PLATFORMS.filter((p) => setupCategory === "all" || p.category === setupCategory);
  const setupPlatforms = setupExpanded ? setupMatches : setupMatches.slice(0, SETUP_PREVIEW);
  const setupProgress = API_URL ? serverSetupProgress : demo?.state.accountSetup ?? {};
  const toggleSetup = async (platform: string, item: string) => {
    const current = setupProgress[platform] ?? [];
    const nextPlatform = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    const next = { ...setupProgress, [platform]: nextPlatform };
    if (!API_URL) {
      demo?.saveAccountSetup(next);
      return;
    }
    setServerSetupProgress(next);
    const res = await apiCall("/api/settings", { accountSetup: next }, "PATCH");
    if (!res || res.status >= 400) {
      setServerSetupProgress({ ...setupProgress });
      toast({ title: "Setup progress not saved", description: "The server did not confirm this checklist change." });
    }
  };

  // Allow other pages (e.g. Command hub) to deep-link an action: ?action=builder|gig
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "builder") { setBuilderOpen(true); setGenerated(null); }
    else if (action === "gig") setGigOpen(true);
  }, []);

  const connected = (platformName: string) => accounts.find((a: any) => a.platform === platformName);
  const applications = proposals.length + jobs.length;
  const isPro = monetization.plan === "pro";

  const startNangoConnect = async (integrationId: string) => {
    setNangoLoading(integrationId);
    const res = await apiCall<{ sessionToken: string }>("/api/integrations/nango/session", { integration_id: integrationId });
    if (!res || res.status >= 400) {
      setNangoLoading(null);
      toast({ title: "Connection unavailable", description: (res?.data as any)?.detail ?? "Check Nango configuration and provider approval." });
      return;
    }
    if (!res.data.sessionToken) {
      setNangoLoading(null);
      toast({ title: "Nango setup incomplete", description: "The server did not return a Connect session token." });
      return;
    }
    try {
      const nango = new Nango({ connectSessionToken: res.data.sessionToken });
      nango.openConnectUI({
        sessionToken: res.data.sessionToken,
        detectClosedAuthWindow: true,
        onEvent: async (event) => {
          if (event.type === "close") setNangoLoading(null);
          if (event.type === "error") {
            setNangoLoading(null);
            toast({ title: "Connection failed", description: event.payload.errorMessage });
          }
          if (event.type === "connect") {
            const { providerConfigKey, connectionId } = event.payload;
            const saved = await apiCall("/api/integrations/nango/connection", {
              providerConfigKey,
              connectionId,
            });
            setNangoLoading(null);
            if (!saved || saved.status >= 400) {
              toast({ title: "Connection could not be linked", description: (saved?.data as any)?.detail ?? "Nango connected the account, but the backend could not verify its owner." });
              return;
            }
            setNangoConnections((current) => ({
              ...current,
              [providerConfigKey]: { connectionId, connectedAt: new Date().toISOString() },
            }));
            toast({ title: `${providerConfigKey} connected`, description: "OAuth credentials remain stored in Nango.", variant: "success" });
          }
        },
      }).open();
    } catch {
      setNangoLoading(null);
      toast({ title: "Could not open Nango Connect", description: "Check the Nango integration configuration and try again." });
    }
  };

  const connect = async () => {
    if (!connectOpen || !handle.trim()) return;
    const platform = PLATFORMS_CONNECTABLE.find((p: any) => p.id === connectOpen)!;
    const res = await demo?.connectAccount(platform.name, handle.trim());
    if (!res) return;
    if (!res.ok) {
      if (res.reason === "no-credits") {
        setPaywall("profiles");
      } else {
        toast({ title: "Couldn't connect", description: res.reason });
      }
      return;
    }
    toast({ title: "Demo profile saved", description: `${res.account.handle} is sample data. No marketplace account was connected or changed.` });
    setConnectOpen(null);
    setHandle("");
  };

  const generateGig = async () => {
    if (!builderService.trim()) return;
    setGenLoading(true);
    const res = await apiCall<GeneratedGig & { aiGenerated: boolean }>("/api/studio/gig", {
      service: builderService.trim(),
      platform: builderPlatform,
      userName: user?.name ?? "",
      skills: builderService,
      experience: "",
    });
    if (res?.data) {
      setGenerated(res.data);
      if (!res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a solid template. Edit freely." });
    } else {
      toast({ title: "Couldn't generate", description: "Backend/AI unavailable — check the API is running." });
    }
    setGenLoading(false);
  };

  const copyText = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copied`, variant: "success" }); }
    catch { toast({ title: "Copy blocked by browser" }); }
  };

  const useGenerated = () => {
    if (!generated) return;
    setGig({
      platform: "",
      platforms: [builderPlatform],
      title: generated.titles[0],
      price: String(generated.packages[1]?.price ?? generated.packages[0]?.price ?? ""),
      category: CATEGORIES[0],
      description: generated.description,
      deliveryDays: String(generated.packages[1]?.deliveryDays ?? generated.packages[0]?.deliveryDays ?? 7),
      titles: generated.titles,
      packages: generated.packages,
      tags: generated.tags,
      faq: generated.faq,
    });
    setBuilderOpen(false);
    setGigOpen(true);
  };

  const saveGigDraft = () => {
    if (!gig.platforms.length || !gig.title || !gig.price) return;
    if (editingGigId) demo?.removeGig(editingGigId);
    const saved: string[] = [];
    for (const p of gig.platforms) {
      const res = demo?.createGig({
        platform: p, title: gig.title, price: Number(gig.price), category: gig.category,
        description: gig.description, deliveryDays: gig.deliveryDays,
        titles: [gig.title, ...gig.titles.filter((title) => title !== gig.title)].slice(0, 3),
        packages: gig.packages, tags: gig.tags, faq: gig.faq,
      });
      if (res?.ok) saved.push(p);
    }
    if (saved.length) {
      toast({ title: editingGigId ? "Gig drafts updated" : "Gig draft saved", description: `Ready to copy into ${saved.join(", ")}; nothing was published.` });
      setEditingGigId(null);
      // Keep the dialog open so you can post the next gig right away.
      setGig((g) => ({ ...g, title: "", price: "", description: "", titles: [], packages: [], tags: [], faq: [] }));
    }
  };

  const editGigDraft = (saved: any) => {
    setEditingGigId(saved.id);
    setGig({
      platform: saved.platform ?? "",
      platforms: saved.platform ? [saved.platform] : [],
      title: saved.title ?? "",
      price: String(saved.price ?? ""),
      category: saved.category ?? CATEGORIES[0],
      description: saved.description ?? "",
      deliveryDays: String(saved.deliveryDays ?? 7),
      titles: saved.titles ?? [saved.title ?? ""],
      packages: saved.packages ?? [],
      tags: saved.tags ?? [],
      faq: saved.faq ?? [],
    });
    setGigOpen(true);
  };

  const copyGigDraft = (saved: any) => {
    const packages = (saved.packages ?? []).map((item: any) => `${item.name} — $${item.price} · ${item.deliveryDays} days\n${item.details}`).join("\n\n");
    const faq = (saved.faq ?? []).map((item: any) => `Q: ${item.q}\nA: ${item.a}`).join("\n\n");
    const content = [
      `Title: ${saved.title}`,
      `Platform: ${saved.platform}`,
      `Price: $${saved.price}`,
      `Delivery: ${saved.deliveryDays ?? 7} days`,
      `Category: ${saved.category}`,
      "",
      saved.description ?? "",
      packages && `Packages\n${packages}`,
      saved.tags?.length ? `Tags: ${saved.tags.join(", ")}` : "",
      faq && `FAQ\n${faq}`,
    ].filter(Boolean).join("\n\n");
    void copyText(content, "Gig draft");
  };

  const platformEditor = gigEditorUrl;

  // Unified applications tracker — everything sent on your behalf.
  const applicationsRows = [
    ...proposals.map((p: any) => ({ id: p.id, type: "Bid sent", target: p.leadTitle, platform: p.platform, status: p.status, when: p.submitted })),
    ...jobs.map((j: any) => ({ id: j.id, type: "Job applied", target: `${j.title} — ${j.company}`, platform: j.source, status: j.status, when: j.date })),
    ...salesLeads.map((s: any) => ({ id: s.id, type: "B2B outreach", target: s.company, platform: s.source, status: s.stage, when: "" })),
  ];
  const appCols: Column<(typeof applicationsRows)[number]>[] = [
    { key: "type", header: "Type", render: (r) => <Badge variant="secondary">{r.type}</Badge> },
    { key: "target", header: "Sent to", render: (r) => <span className="font-medium">{r.target}</span> },
    { key: "platform", header: "Platform", render: (r) => <Badge variant="outline">{r.platform}</Badge> },
    { key: "status", header: "Status", render: (r) => r.status ? <StatusBadge status={r.status} /> : "—" },
    { key: "when", header: "When", render: (r) => <span className="text-muted-foreground">{r.when ? formatRelative(r.when) : "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Accounts & Platforms"
        description="Manage account setup and gig drafts. Secure OAuth connect options appear only for integrations enabled by the server."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setBuilderOpen(true); setGenerated(null); }}>
              <Sparkles className="size-4" /> AI Gig Builder
            </Button>
            <Button variant="gradient" onClick={() => setGigOpen(true)}>
              <Plus className="size-4" /> New gig draft
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Profile entries" value={String(accounts.length)} icon={<Link2 className="size-4" />} hint="Details only; not OAuth connections" />
        <MiniStat label="Gig drafts" value={String(gigs.filter((g: any) => g.status === "Draft").length)} icon={<Store className="size-4" />} />
        <MiniStat label="Applications sent" value={String(applications)} icon={<Zap className="size-4" />} href="/dashboard/bidding" />
        <MiniStat label="Bid credits" value={isPro ? "Unlimited" : String(monetization.bidCredits)} icon={<Gavel className="size-4" />} href="/dashboard/money" />
      </div>

      {nangoIntegrations.length > 0 && <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Secure account connections</CardTitle>
          <CardDescription>Nango manages OAuth credentials and refresh. Only integrations explicitly enabled by the service are shown; marketplace approval is still required.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {nangoIntegrations.map((integrationId) => <div key={integrationId} className="flex items-center gap-2 rounded-md border px-2 py-1">
            <span className="text-sm">{integrationId}</span>
            {nangoConnections[integrationId] && <Badge variant="success">Connected</Badge>}
            <Button size="sm" variant="outline" disabled={!!nangoLoading} onClick={() => void startNangoConnect(integrationId)}>
              {nangoLoading === integrationId ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {nangoConnections[integrationId] ? "Reconnect" : "Connect"}
            </Button>
          </div>)}
        </CardContent>
      </Card>}

      {/* Platform connectors */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS_CONNECTABLE.map((p: any) => {
          const acc = connected(p.name);
          return (
            <Card key={p.id} className={acc ? "border-primary/40 bg-primary/[0.03]" : ""}>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <div className={`flex size-9 items-center justify-center rounded-lg ${acc ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
                    {acc ? <CheckCircle2 className="size-4" /> : <Globe className="size-4" />}
                  </div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </div>
                <StatusBadge status={acc ? "Profile details only" : "Not connected"} />
              </CardHeader>
              <CardContent>
                    <CardDescription className="mb-3">{demoMode ? p.desc : "Account authorization is not connected yet. Use guided setup to open the official site."}</CardDescription>
                {acc ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm">
                      <span className="font-medium">{acc.handle}</span>
                      <span className="text-xs text-muted-foreground">Profile details · added {formatRelative(acc.connectedAt)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setGig({ ...gig, platforms: [p.name] }); setGigOpen(true); }}>
                        <Plus className="size-4" /> New gig
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { demo?.disconnectAccount(acc.id); toast({ title: `${p.name} profile details removed` }); }}>
                        <Unlink className="size-4" /> Remove details
                      </Button>
                    </div>
                  </div>
                ) : (
                  demoMode ? <Button
                    size="sm"
                    variant="default"
                    className="w-full"
                    onClick={() => { setConnectOpen(p.id); setHandle(""); }}
                  >
                    <Plug className="size-4" /> Add demo profile
                  </Button> : <Button size="sm" variant="outline" className="w-full" disabled>
                    <Plug className="size-4" /> OAuth connection unavailable
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Guided account setup</CardTitle>
          <CardDescription>Open each platform’s signup page yourself. We track your checklist, but never create accounts, request marketplace passwords, or automate signup pages.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {(["all", ...setupCategories] as const).map((c) => (
              <button key={c} type="button" onClick={() => setSetupCategory(c)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", setupCategory === c ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {c === "all" ? `All · ${SETUP_PLATFORMS.length}` : `${CATEGORY_LABELS[c].label} · ${SETUP_PLATFORMS.filter((p) => p.category === c).length}`}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {setupPlatforms.map(({ name, signupUrl: href }) => {
            const done = setupProgress[name] ?? [];
            const tasks = ["Marketplace account created", "Profile completed", "Platform-required verification completed"];
            const completed = tasks.filter((task) => done.includes(task)).length;
            return <div key={name} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <a href={href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Create {name} account ↗</a>
                <Badge variant={completed === tasks.length ? "success" : "secondary"}>{completed}/{tasks.length}</Badge>
              </div>
              {tasks.map((item) => <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={done.includes(item)} onCheckedChange={() => toggleSetup(name, item)} />{item}</div>)}
            </div>;
          })}
          {setupMatches.length > SETUP_PREVIEW && (
            <Button variant="ghost" size="sm" className="sm:col-span-2 lg:col-span-4" onClick={() => setSetupExpanded((v) => !v)}>
              {setupExpanded ? "Show fewer" : `Show all ${setupMatches.length} platforms`}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Gigs */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Your Gig Drafts</CardTitle>
            <CardDescription>Drafts saved for review and manual publication on each platform.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setGigOpen(true)}>
            <Plus className="size-4" /> New draft
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {gigs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No drafts yet — create a marketplace-ready listing to copy and publish manually.
            </p>
          )}
          {gigs.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">
              {g.platform} · {g.category} · {formatCurrency(g.price)} · Draft — publish manually
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="Draft" />
                <Button size="sm" variant="outline" onClick={() => editGigDraft(g)}>Edit / reuse</Button>
                <Button size="sm" variant="outline" onClick={() => copyGigDraft(g)}><Copy className="size-4" /> Copy</Button>
                {platformEditor(g.platform) && <Button size="sm" variant="outline" asChild><a href={platformEditor(g.platform)!} target="_blank" rel="noreferrer">Open editor</a></Button>}
                <Button size="sm" variant="ghost" onClick={() => { demo?.removeGig(g.id); toast({ title: "Gig removed" }); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Unified applications tracker */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="size-4 text-primary" /> Applications & Outreach Tracker
        </h2>
        <DataTable columns={appCols} data={applicationsRows} searchKeys={["target", "platform", "type"]} searchPlaceholder="Search bids, applications, outreach..." />
      </div>

      {/* AI Gig Builder dialog */}
      <Dialog open={builderOpen} onOpenChange={(v) => !v && setBuilderOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> AI Gig Builder</DialogTitle>
          <DialogDescription>
            Describe what you sell — AI writes the full listing (titles, description, 3-tier pricing, tags, FAQ).
            You review and paste it into {builderPlatform}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* What you get */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:grid-cols-4">
            {[["3 titles", "Ranked for search"], ["Description", "Buyer-focused copy"], ["3 packages", "Basic→Premium tiers"], ["Tags + FAQ", "SEO keywords & answers"]].map(([t, s]) => (
              <div key={t} className="text-center">
                <p className="text-xs font-semibold">{t}</p>
                <p className="text-[10px] text-muted-foreground">{s}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bservice">Service you offer</Label>
              <Input id="bservice" placeholder="e.g. custom Next.js SaaS dashboards" value={builderService} onChange={(e) => setBuilderService(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bplatform">Platform</Label>
              <Select id="bplatform" value={builderPlatform} onChange={(e) => setBuilderPlatform(e.target.value)}>
                {GIG_DRAFT_TARGETS.map((name) => <option key={name}>{name}</option>)}
              </Select>
            </div>
          </div>
          {/* Quick-start services */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Try:</span>
            {["landing page design", "Next.js bug fixes", "Shopify store setup", "logo + brand kit", "AI chatbot integration", "SEO audit + fixes"].map((s: any) => (
              <button key={s} onClick={() => setBuilderService(s)}
                className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary">
                {s}
              </button>
            ))}
          </div>
          <Button variant="gradient" className="w-full" size="lg" onClick={generateGig} disabled={genLoading || !builderService.trim()}>
            {genLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {genLoading ? `Writing your ${builderPlatform} gig…` : generated ? "Regenerate gig" : "Generate gig"}
          </Button>

          {generated && (
            <div className="max-h-[45vh] space-y-4 overflow-y-auto rounded-lg border p-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Title options</p>
                {generated.titles.map((t, i) => (
                  <div key={i} className="mb-1 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">{t}</span>
                    <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => copyText(t, "Title")}><Copy className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Description</p>
                  <Button size="sm" variant="ghost" onClick={() => copyText(generated.description, "Description")}><Copy className="size-3.5 mr-1" /> Copy</Button>
                </div>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{generated.description}</p>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted-foreground">Packages</p><Button size="sm" variant="ghost" onClick={() => copyText(generated.packages.map((p) => `${p.name} — $${p.price}, ${p.deliveryDays} days\n${p.details}`).join("\n\n"), "Packages")}><Copy className="mr-1 size-3.5" /> Copy</Button></div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {generated.packages.map((p: any) => (
                    <div key={p.name} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(p.price)}</p>
                      <p className="text-xs text-muted-foreground">{p.deliveryDays}-day delivery</p>
                      <p className="mt-1 text-xs">{p.details}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {generated.tags.map((t: any) => <button key={t} onClick={() => copyText(t, "Tag")}><Badge variant="secondary" className="cursor-pointer">{t} · copy</Badge></button>)}
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted-foreground">Buyer FAQ</p><Button size="sm" variant="ghost" onClick={() => copyText(generated.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"), "FAQ")}><Copy className="mr-1 size-3.5" /> Copy</Button></div>
                {generated.faq.map((f, i) => (
                  <div key={i} className="mb-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <p className="font-medium">{f.q}</p>
                    <p className="text-xs text-muted-foreground">{f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBuilderOpen(false)}>Close</Button>
          <Button variant="gradient" onClick={useGenerated} disabled={!generated}>
            <Megaphone className="size-4" /> Use this gig
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Connect account dialog */}
      <Dialog open={!!connectOpen} onOpenChange={(v) => !v && setConnectOpen(null)}>
        {connectOpen && (
          <>
            <DialogHeader>
              <DialogTitle>Connect {PLATFORMS_CONNECTABLE.find((p: any) => p.id === connectOpen)?.name}</DialogTitle>
              <DialogDescription>
                Demo profile only — no marketplace OAuth or account connection is created.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="handle">Profile handle / username</Label>
              <Input id="handle" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectOpen(null)}>Cancel</Button>
              <Button variant="gradient" onClick={connect} disabled={!handle.trim()}>
                <CheckCircle2 className="size-4" /> Connect
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* Save gig draft dialog */}
      <Dialog open={gigOpen} onOpenChange={(open) => { setGigOpen(open); if (!open) setEditingGigId(null); }}>
        <DialogHeader>
          <DialogTitle>{editingGigId ? "Edit and reuse gig draft" : "Save a gig draft"}</DialogTitle>
          <DialogDescription>Create copy for a marketplace. Publishing happens manually in your account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Platform picker — multi-select cards */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Target marketplaces</Label>
              {GIG_DRAFT_TARGETS.length > 1 && (
                <button type="button" className="text-xs text-primary hover:underline"
                  onClick={() => setGig({ ...gig, platforms: gig.platforms.length === GIG_DRAFT_TARGETS.length ? [] : GIG_DRAFT_TARGETS })}>
                  {gig.platforms.length === GIG_DRAFT_TARGETS.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
              <div className="flex flex-wrap gap-2">
                {GIG_DRAFT_TARGETS.map((name) => {
                  const on = gig.platforms.includes(name);
                  return (
                    <button key={name} type="button"
                      onClick={() => setGig({ ...gig, platforms: on ? gig.platforms.filter((p: any) => p !== name) : [...gig.platforms, name] })}
                      className={cn("relative rounded-lg border px-3 py-2 text-sm transition-colors",
                        on ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50")}>
                      <span className="font-medium">{name}</span>
                      {on && <CheckCircle2 className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-background text-primary" />}
                    </button>
                  );
                })}
              </div>
          <p className="text-xs text-muted-foreground">
              {gig.platforms.length === 0 ? "Pick the marketplace(s) you plan to publish on manually." : `${gig.platforms.length} marketplace${gig.platforms.length === 1 ? "" : "s"} selected — this saves a draft only.`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gtitle">Gig title</Label>
            <Input id="gtitle" placeholder="e.g. I will build your Facebook Marketplace automation" value={gig.title} onChange={(e) => setGig({ ...gig, title: e.target.value })} />
            <p className="text-xs text-muted-foreground">{gig.title.length}/80 — start with "I will…" and lead with the outcome buyers want.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="gprice">Price (USD)</Label>
              <Input id="gprice" type="number" placeholder="250" value={gig.price} onChange={(e) => setGig({ ...gig, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdel">Delivery</Label>
              <Select id="gdel" value={gig.deliveryDays ?? "7"} onChange={(e) => setGig({ ...gig, deliveryDays: e.target.value })}>
                <option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gcat">Category</Label>
              <Select id="gcat" value={gig.category} onChange={(e) => setGig({ ...gig, category: e.target.value })}>
                {CATEGORIES.map((c: any) => <option key={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gdesc">Description</Label>
            <Textarea id="gdesc" rows={4} placeholder="What buyers get, delivery time, requirements..." value={gig.description} onChange={(e) => setGig({ ...gig, description: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <span>Want the full listing written for you — titles, 3-tier packages, tags, FAQ?</span>
            <Button size="sm" variant="ghost" className="text-primary" onClick={() => { setGigOpen(false); setBuilderOpen(true); }}>
              <Sparkles className="size-3.5" /> Open AI Gig Builder
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setGigOpen(false)}>Cancel</Button>
          <Button variant="gradient" onClick={saveGigDraft} disabled={!gig.platforms.length || !gig.title || !gig.price}>
            <Megaphone className="size-4" /> {editingGigId ? "Update draft" : "Save draft"}
          </Button>
        </DialogFooter>
      </Dialog>

      <PaywallDialog open={paywall === "profiles"} onOpenChange={(v) => !v && setPaywall(null)} kind="profiles" />
      <PaywallDialog open={paywall === "bids"} onOpenChange={(v) => !v && setPaywall(null)} kind="bids" />
    </>
  );
}

function MiniStat({ icon, label, value, hint, href }: { icon: React.ReactNode; label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className={`rounded-xl border bg-card p-4 ${href ? "transition-all hover:border-primary/60 hover:shadow-sm" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">{icon}</div>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
