"use client";
import * as React from "react";
import {
  Rocket, Copy, Mail, Send, Plus, Trash2, Sparkles, Upload,
  ExternalLink, CheckCircle2, Pencil, Building2, MessageSquare,
  Loader2, PlugZap, CircleAlert, Reply,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useDemoStore } from "@/lib/demo-store";
import { useAuth } from "@/lib/auth";
import { apiCall, apiGet } from "@/lib/api";
import { formatRelative, cn } from "@/lib/utils";

const PLATFORMS = ["Fiverr", "Upwork", "LinkedIn", "Reddit", "Facebook", "Contra", "X / Twitter"];
const AGENCY_STAGES = ["Target", "Contacted", "Replied", "Converted"];
const OUTREACH_STAGES = ["Draft", "Ready", "Copied", "Sent", "Replied"];

export default function GrowthPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const demo = useDemoStore();
  const growth = demo?.state.growth;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${label} copied`, variant: "success" }); }
    catch { toast({ title: "Copy blocked by browser" }); }
  };

  // ---------- Provider status ----------
  const [provider, setProvider] = React.useState<{ enabled: boolean; provider: string | null } | null>(null);
  React.useEffect(() => {
    void apiGet<{ enabled: boolean; provider: string | null }>("/api/growth/provider-status").then(setProvider);
  }, []);

  // ---------- Agency outreach ----------
  const [agencyOpen, setAgencyOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [leadOpen, setLeadOpen] = React.useState(false);
  const [leadNiche, setLeadNiche] = React.useState("");
  const [leadRegion, setLeadRegion] = React.useState("");
  const [leadResults, setLeadResults] = React.useState<any[]>([]);
  const [leadSelected, setLeadSelected] = React.useState<Set<number>>(new Set());
  const [leadLoading, setLeadLoading] = React.useState(false);
  const [bulkText, setBulkText] = React.useState("");
  const [agency, setAgency] = React.useState({ name: "", email: "", focus: "", size: "", notes: "" });
  const [campaignName, setCampaignName] = React.useState("Agency intro — Q1");
  const [offer, setOffer] = React.useState<"trial" | "enterprise">("trial");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [drafting, setDrafting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [agencyFilter, setAgencyFilter] = React.useState("All");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [tplName, setTplName] = React.useState("");
  const [openCampaign, setOpenCampaign] = React.useState<any | null>(null);

  // Per-agency personalized draft dialog
  const [draftFor, setDraftFor] = React.useState<any | null>(null);
  const [agencyDraft, setAgencyDraft] = React.useState({ subject: "", body: "" });
  const [agencyDrafting, setAgencyDrafting] = React.useState(false);

  const addAgency = () => {
    if (!agency.name.trim() || !agency.email.includes("@")) return;
    demo?.addAgency(agency);
    toast({ title: `${agency.name} added`, variant: "success" });
    setAgency({ name: "", email: "", focus: "", size: "", notes: "" });
    setAgencyOpen(false);
  };

  /** Bulk import — accepts "Name,email", "Name <email>" or bare emails, one per line. */
  const bulkImport = () => {
    const lines = bulkText.split("\n").map((l: any) => l.trim()).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const angle = line.match(/^(.*?)\s*<([^>]+@[^>]+)>/);
      const csv = line.match(/^(.*?)[,;\t]\s*(\S+@\S+)$/);
      const bare = line.match(/^(\S+@\S+)$/);
      let name = "", email = "";
      if (angle) { name = angle[1].trim(); email = angle[2]; }
      else if (csv) { name = csv[1].trim(); email = csv[2]; }
      else if (bare) { name = bare[1].split("@")[0]; email = bare[1]; }
      if (!email.includes("@")) continue;
      demo?.addAgency({ name: name || email.split("@")[0], email });
      added++;
    }
    toast({ title: `${added} agencies imported`, variant: added ? "success" : "default" });
    setBulkText("");
    setBulkOpen(false);
  };

  /** AI Lead Finder — describe the niche, get prospects, pick who joins the list. */
  const findLeads = async () => {
    setLeadLoading(true);
    const res = await apiCall<{ leads: any[]; aiGenerated: boolean }>("/api/growth/leads/find", {
      niche: leadNiche.trim() || "digital agencies",
      region: leadRegion.trim(),
      count: 8,
    });
    setLeadLoading(false);
    if (!res || res.status >= 400) {
      toast({ title: "Couldn't find leads", description: (res?.data as any)?.detail ?? "Can't reach the server — try again." });
      return;
    }
    const leads = res.data.leads ?? [];
    setLeadResults(leads);
    setLeadSelected(new Set(leads.map((_, i) => i)));
    if (!res.data.aiGenerated) toast({ title: "Example leads", description: "AI offline — showing template examples." });
  };

  const addSelectedLeads = () => {
    let n = 0;
    for (const i of Array.from(leadSelected)) {
      const l = leadResults[i];
      if (!l) continue;
      demo?.addAgency({ name: l.name, email: l.email || `${l.name.toLowerCase().replace(/\W+/g, "")}@example.com`, focus: l.focus || l.why || "", size: l.size || "", notes: l.why || "" });
      n++;
    }
    toast({ title: `${n} leads added to targets`, variant: "success" });
    setLeadOpen(false);
    setLeadResults([]);
  };

  const toggleLead = (i: number) =>
    setLeadSelected((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const draftEmail = async (forAgency?: any) => {
    const first = forAgency ?? growth?.agencies[0];
    if (forAgency) setAgencyDrafting(true); else setDrafting(true);
    const res = await apiCall<{ subject: string; body: string; aiGenerated: boolean }>("/api/growth/email/draft", {
      agencyName: first?.name ?? "your agency",
      focus: first?.focus ?? "",
      offer,
      senderName: user?.name ?? "",
    });
    let s = "", b = "";
    if (res?.data) {
      s = res.data.subject; b = res.data.body;
      if (!res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a solid template. Edit freely." });
    } else {
      s = `${first?.name ?? "Your agency"} + Autopilot — more client work, less overhead`;
      b = `Hi {name},\n\nWe built Autopilot — AI that finds freelance work and drafts proposals your team reviews and sends. Agencies use it to win more deals without hiring.\n\nI'd love to set {agency} up with ${offer === "enterprise" ? "an enterprise trial for your whole team" : "a 3-day trial (extends to 7 when you share it)"}. No card required.\n\nWorth a look?\n\n${user?.name ?? "The Autopilot team"}`;
      toast({ title: "Draft ready", description: "Backend offline — used a local template." });
    }
    if (forAgency) { setAgencyDraft({ subject: s, body: b.replace("{agency}", forAgency.name).replace("{name}", forAgency.name) }); setAgencyDrafting(false); }
    else { setSubject(s); setBody(b); setDrafting(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectedTargets = (growth?.agencies ?? []).filter((a: any) => a.email?.includes("@") && (selected.size === 0 || selected.has(a.id)));

  const sendCampaign = async () => {
    const targets = selectedTargets;
    if (!subject.trim() || !body.trim() || targets.length === 0) return;
    setSending(true);
    const res = await apiCall<{ ok: boolean; sent: number; failed: number; results?: any[] }>("/api/growth/campaigns/send", {
      name: campaignName || "Campaign",
      offer, subject, body,
      recipients: targets.map((a: any) => ({ name: a.name, email: a.email })),
      senderName: user?.name ?? "",
    });
    setSending(false);
    if (res?.status === 200 && res.data) {
      demo?.saveCampaign({ name: campaignName || "Campaign", offer, subject, body, sent: res.data.sent, failed: res.data.failed, status: "Sent", results: res.data.results });
      for (const a of targets) demo?.patchAgency(a.id, { status: "Contacted" });
      toast({ title: "Campaign sent", description: `${res.data.sent} delivered, ${res.data.failed} failed.`, variant: res.data.failed ? "default" : "success" });
    } else {
      demo?.saveCampaign({ name: campaignName || "Campaign", offer, subject, body, sent: 0, failed: 0, status: "Draft" });
      toast({
        title: "Saved as draft",
        description: res?.status === 503
          ? "No email provider configured — set RESEND_API_KEY or SMTP on the backend, or use 'Open in mail app'."
          : res?.status === 403
            ? "Sending uses the company's email account, so only the platform owner can send — use 'Open in mail app' instead."
            : res
              ? (res.data as any)?.detail ?? "The server refused the send — saved as a draft."
              : "Can't reach the server — campaign saved as a draft.",
      });
    }
  };

  const openMailApp = () => {
    const targets = selectedTargets.map((a: any) => a.email).filter(Boolean).join(",");
    if (!targets) return;
    window.open(`mailto:?bcc=${encodeURIComponent(targets)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_self");
    demo?.saveCampaign({ name: campaignName || "Campaign", offer, subject, body, sent: targets.split(",").length, failed: 0, status: "Sent via mail app" });
    for (const a of selectedTargets) demo?.patchAgency(a.id, { status: "Contacted" });
  };

  // ---------- Platform outreach ----------
  const [targetOpen, setTargetOpen] = React.useState(false);
  const [target, setTarget] = React.useState({ platform: "Fiverr", target: "", profileUrl: "", note: "" });
  const [editRow, setEditRow] = React.useState<any | null>(null);
  const [editMsg, setEditMsg] = React.useState("");
  const [genFor, setGenFor] = React.useState<string | null>(null);
  const [outreachFilter, setOutreachFilter] = React.useState("All");

  const addTarget = () => {
    if (!target.target.trim()) return;
    demo?.addOutreachTarget(target);
    toast({ title: `${target.target} added to targets`, variant: "success" });
    setTarget({ platform: "Fiverr", target: "", profileUrl: "", note: "" });
    setTargetOpen(false);
  };

  const generateMessage = async (row: any, followUp = false) => {
    setGenFor(row.id);
    const res = await apiCall<{ message: string; aiGenerated: boolean }>("/api/growth/outreach/draft", {
      platform: row.platform,
      target: row.target,
      context: followUp ? `follow-up on your earlier message${row.note ? ` (${row.note})` : ""}` : row.note,
      senderName: user?.name ?? "",
    });
    const msg = res?.data?.message ??
      `${followUp ? `Hi ${row.target} — just bumping my earlier note. ` : `Hi ${row.target} — saw your profile${row.note ? ` re: ${row.note}` : ""} and thought this might help: `}I use Autopilot, an AI workspace that finds gigs and drafts proposals I review myself. Happy to send my referral link if you want to try it.\n\n— ${user?.name ?? "a fellow freelancer"}`;
    demo?.patchOutreach(row.id, { message: msg, status: "Ready" });
    setEditRow({ ...row, message: msg, status: "Ready" });
    setEditMsg(msg);
    setGenFor(null);
    if (res && !res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a template." });
  };

  const copyOutreach = (r: any) => {
    copy(r.message, "Message");
    if (r.status === "Ready") demo?.patchOutreach(r.id, { status: "Copied" });
  };

  // ---------- Derived stats ----------
  const agencies = growth?.agencies ?? [];
  const outreach = growth?.outreach ?? [];
  const agencyStats = AGENCY_STAGES.map((s: any) => ({ stage: s, n: agencies.filter((a: any) => a.status === s).length }));
  const outreachStats = OUTREACH_STAGES.map((s: any) => ({ stage: s, n: outreach.filter((o: any) => o.status === s).length }));
  const filteredAgencies = agencyFilter === "All" ? agencies : agencies.filter((a: any) => a.status === agencyFilter);
  const filteredOutreach = outreachFilter === "All" ? outreach : outreach.filter((o: any) => o.status === outreachFilter);

  const agencyCols: Column<any>[] = [
    { key: "sel", header: "", render: (r) => (
      <input type="checkbox" className="size-4 accent-primary" checked={selected.has(r.id)}
        onChange={() => toggleSelect(r.id)} title="Include in campaign" />
    ) },
    { key: "name", header: "Agency", render: (r) => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.email}</p>
      </div>
    ) },
    { key: "focus", header: "Focus", render: (r) => <span className="text-muted-foreground">{r.focus || "—"}</span> },
    { key: "status", header: "Stage", render: (r) => (
      <Select
        value={r.status}
        onChange={(e) => demo?.patchAgency(r.id, { status: e.target.value })}
        className="h-8 w-32 text-xs"
      >
        {AGENCY_STAGES.map((s: any) => <option key={s} value={s}>{s}</option>)}
      </Select>
    ) },
    { key: "x", header: "", render: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" disabled={agencyDrafting && draftFor?.id === r.id}
          onClick={() => { setDraftFor(r); setAgencyDraft({ subject: "", body: "" }); draftEmail(r); }}>
          {agencyDrafting && draftFor?.id === r.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => demo?.removeAgency(r.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
      </div>
    ) },
  ];

  const outreachCols: Column<any>[] = [
    { key: "platform", header: "Platform", render: (r) => <Badge variant="outline">{r.platform}</Badge> },
    { key: "target", header: "Target", render: (r) => (
      <div>
        <p className="font-medium">{r.target}</p>
        {r.note && <p className="max-w-56 truncate text-xs text-muted-foreground">{r.note}</p>}
      </div>
    ) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "at", header: "Added", render: (r) => <span className="text-muted-foreground">{formatRelative(r.at)}</span> },
    { key: "actions", header: "", render: (r) => (
      <div className="flex flex-wrap justify-end gap-1">
        {r.status === "Draft" ? (
          <Button size="sm" variant="default" disabled={genFor === r.id} onClick={() => generateMessage(r)}>
            {genFor === r.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => { setEditRow(r); setEditMsg(r.message); }}>
              <Pencil className="size-4" /> Review
            </Button>
            <Button size="sm" variant="outline" onClick={() => copyOutreach(r)}><Copy className="size-4" /></Button>
            {r.profileUrl && (
              <Button size="sm" variant="outline" onClick={() => window.open(r.profileUrl, "_blank", "noopener")}>
                <ExternalLink className="size-4" />
              </Button>
            )}
          </>
        )}
        {r.status === "Sent" && (
          <Button size="sm" variant="ghost" disabled={genFor === r.id} title="Draft a follow-up"
            onClick={() => generateMessage(r, true)}>
            <Reply className="size-4" />
          </Button>
        )}
        {r.status !== "Replied" && r.status !== "Draft" && (
          <Button size="sm" variant="ghost" className="text-success"
            title={r.status === "Sent" ? "Mark replied" : "Mark sent"}
            onClick={() => {
              const next = r.status === "Sent" ? "Replied" : "Sent";
              demo?.patchOutreach(r.id, { status: next });
              toast({ title: `Marked ${next.toLowerCase()}`, variant: "success" });
            }}>
            <CheckCircle2 className="size-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => demo?.removeOutreach(r.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
      </div>
    ) },
  ];

  const campaignCols: Column<any>[] = [
    { key: "name", header: "Campaign", render: (r) => (
      <button className="font-medium text-primary hover:underline" onClick={() => setOpenCampaign(r)}>{r.name}</button>
    ) },
    { key: "offer", header: "Offer", render: (r) => <Badge variant="outline">{r.offer === "enterprise" ? "Enterprise trial" : "3-day trial"}</Badge> },
    { key: "sent", header: "Sent", render: (r) => <span className="font-semibold text-success">{r.sent}</span> },
    { key: "failed", header: "Failed", render: (r) => r.failed ? <span className="font-semibold text-destructive">{r.failed}</span> : <span className="text-muted-foreground">0</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "When", render: (r) => <span className="text-muted-foreground">{formatRelative(r.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Outreach"
        description="Run agency email campaigns and reach out where freelancers already are — AI drafts, you review and send."
      />

      <Tabs defaultValue="agencies">
        <TabsList>
          <TabsTrigger value="agencies"><Building2 className="mr-1.5 size-4" />Agency Outreach</TabsTrigger>
          <TabsTrigger value="outreach"><MessageSquare className="mr-1.5 size-4" />Platform Messages</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1: Agency Outreach ============ */}
        <TabsContent value="agencies" className="space-y-4">
          {/* Pipeline stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {agencyStats.map((s: any) => (
              <button key={s.stage} onClick={() => setAgencyFilter(agencyFilter === s.stage ? "All" : s.stage)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50",
                  agencyFilter === s.stage && "border-primary ring-1 ring-primary/30"
                )}>
                <p className="text-2xl font-bold">{s.n}</p>
                <p className="text-xs text-muted-foreground">{s.stage}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Target list */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Target agencies</CardTitle>
                  <CardDescription>{agencies.length} on the list{agencyFilter !== "All" && ` · filtered: ${agencyFilter}`}</CardDescription>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="gradient" onClick={() => setLeadOpen(true)}><Sparkles className="size-4" /> Find leads</Button>
                  <Button size="sm" variant="ghost" title="Bulk import" onClick={() => setBulkOpen(true)}><Upload className="size-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setAgencyOpen(true)}><Plus className="size-4" /> Add</Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAgencies.length > 0 ? (
                  <DataTable columns={agencyCols} data={filteredAgencies} />
                ) : agencies.length > 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No agencies at the "{agencyFilter}" stage yet.</p>
                ) : (
                  <EmptyState
                    icon={<Building2 className="size-6" />}
                    title="No target agencies"
                    description="Build a list of agencies to pitch — then send them a campaign in one click."
                    action={
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setAgencyOpen(true)}><Plus className="size-4" /> Add agency</Button>
                        <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><Upload className="size-4" /> Bulk import</Button>
                      </div>
                    }
                  />
                )}
              </CardContent>
            </Card>

            {/* Composer */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><Mail className="size-4 text-primary" /> Campaign composer</CardTitle>
                    <CardDescription>Write it yourself or let AI draft it — you review before anything sends.</CardDescription>
                  </div>
                  {provider && (
                    <Badge variant={provider.enabled ? "success" : "warning"} className="gap-1">
                      {provider.enabled ? <PlugZap className="size-3" /> : <CircleAlert className="size-3" />}
                      {provider.enabled ? `Delivery: ${provider.provider}` : "Delivery not configured"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Campaign name</Label>
                    <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Offer</Label>
                    <Select value={offer} onChange={(e) => setOffer(e.target.value as "trial" | "enterprise")}>
                      <option value="trial">3-day trial (extends to 7 on share)</option>
                      <option value="enterprise">Enterprise trial — whole team, 1 week</option>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Subject</Label>
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-primary" disabled={drafting} onClick={() => draftEmail()}>
                      {drafting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} AI Draft
                    </Button>
                  </div>
                  <Input placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Body — {"{name}"} and {"{agency}"} personalize per recipient</Label>
                  <Textarea rows={8} placeholder="Write or AI-draft your pitch…" value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {selected.size === 0 ? `Sends to all ${selectedTargets.length} agencies` : `Sends to ${selectedTargets.length} selected agencies`}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openMailApp} disabled={!subject.trim() || !body.trim() || !selectedTargets.length}>
                      <Mail className="size-4" /> Open in mail app
                    </Button>
                    <Button variant="gradient" size="sm" disabled={sending || !subject.trim() || !body.trim() || !selectedTargets.length} onClick={sendCampaign}>
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send campaign
                    </Button>
                  </div>
                </div>

                {/* Template library */}
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  {(growth?.templates?.length ?? 0) > 0 && (
                    <Select
                      className="h-8 w-48 text-xs"
                      value=""
                      onChange={(e) => {
                        const t = growth?.templates.find((x: any) => x.id === e.target.value);
                        if (t) { setSubject(t.subject); setBody(t.body); toast({ title: `Template "${t.name}" loaded` }); }
                      }}
                    >
                      <option value="">Load template…</option>
                      {growth!.templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  )}
                  <Input className="h-8 w-40 text-xs" placeholder="Template name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
                  <Button size="sm" variant="ghost" className="h-8" disabled={!subject.trim() || !body.trim() || !tplName.trim()}
                    onClick={() => { demo?.saveTemplate({ name: tplName.trim(), subject, body }); setTplName(""); toast({ title: "Template saved", variant: "success" }); }}>
                    Save as template
                  </Button>
                  {(growth?.templates ?? []).map((t: any) => (
                    <Badge key={t.id} variant="secondary" className="gap-1">
                      {t.name}
                      <button onClick={() => demo?.removeTemplate(t.id)} className="text-muted-foreground hover:text-foreground">×</button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaign history */}
          {growth && growth.campaigns.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Campaign history</CardTitle></CardHeader>
              <CardContent><DataTable columns={campaignCols} data={growth.campaigns} /></CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ TAB 2: Platform Messages ============ */}
        <TabsContent value="outreach" className="space-y-4">
          {/* Pipeline stats */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {outreachStats.map((s: any) => (
              <button key={s.stage} onClick={() => setOutreachFilter(outreachFilter === s.stage ? "All" : s.stage)}
                className={cn(
                  "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50",
                  outreachFilter === s.stage && "border-primary ring-1 ring-primary/30"
                )}>
                <p className="text-2xl font-bold">{s.n}</p>
                <p className="text-xs text-muted-foreground">{s.stage}</p>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Rocket className="size-4 text-primary" /> Outreach targets</CardTitle>
                <CardDescription>
                  Human-in-the-loop: AI drafts each message, you review it, then send it yourself on the platform.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setTargetOpen(true)}><Plus className="size-4" /> Add target</Button>
            </CardHeader>
            <CardContent>
              {filteredOutreach.length > 0 ? (
                <DataTable columns={outreachCols} data={filteredOutreach} />
              ) : outreach.length > 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing at the "{outreachFilter}" stage yet.</p>
              ) : (
                <EmptyState
                  icon={<MessageSquare className="size-6" />}
                  title="No outreach targets"
                  description="Add freelancers and contacts on Fiverr, LinkedIn, Reddit — anywhere. AI writes a personal note for each; you review and send it yourself."
                  action={<Button size="sm" onClick={() => setTargetOpen(true)}><Plus className="size-4" /> Add first target</Button>}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign detail dialog */}
      <Dialog open={!!openCampaign} onOpenChange={(v) => !v && setOpenCampaign(null)}>
        {openCampaign && (
          <>
            <DialogHeader>
              <DialogTitle>{openCampaign.name}</DialogTitle>
              <DialogDescription>
                {openCampaign.offer === "enterprise" ? "Enterprise trial" : "3-day trial"} · {formatRelative(openCampaign.createdAt)} · {openCampaign.status}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {(openCampaign.results ?? []).length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">No per-recipient results recorded{openCampaign.status === "Draft" ? " — this campaign is still a draft" : ""}.</p>
              )}
              {(openCampaign.results ?? []).map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{r.name || r.email}</span>
                  <Badge variant={r.ok ? "success" : "destructive"}>{r.ok ? "Delivered" : "Failed"}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-sm">
              <span className="text-success font-semibold">{openCampaign.sent} sent</span>
              <span className="text-muted-foreground">{openCampaign.failed} failed</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCampaign(null)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* Add agency dialog */}
      <Dialog open={agencyOpen} onOpenChange={setAgencyOpen}>
        <DialogHeader>
          <DialogTitle>Add target agency</DialogTitle>
          <DialogDescription>Agencies you want to offer a trial to.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Agency name</Label><Input value={agency.name} onChange={(e) => setAgency({ ...agency, name: e.target.value })} placeholder="Acme Studio" /></div>
          <div className="space-y-1.5"><Label>Contact email</Label><Input type="email" value={agency.email} onChange={(e) => setAgency({ ...agency, email: e.target.value })} placeholder="hello@acme.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Focus</Label><Input value={agency.focus} onChange={(e) => setAgency({ ...agency, focus: e.target.value })} placeholder="Web design" /></div>
            <div className="space-y-1.5"><Label>Size</Label><Input value={agency.size} onChange={(e) => setAgency({ ...agency, size: e.target.value })} placeholder="5-20" /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={agency.notes ?? ""} onChange={(e) => setAgency({ ...agency, notes: e.target.value })} placeholder="e.g. met at conference, prefers short emails" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAgencyOpen(false)}>Cancel</Button>
          <Button onClick={addAgency} disabled={!agency.name.trim() || !agency.email.includes("@")}>Add agency</Button>
        </DialogFooter>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogHeader>
          <DialogTitle>Bulk import agencies</DialogTitle>
          <DialogDescription>One per line: <code>Name, email</code>, <code>Name &lt;email&gt;</code>, or a bare email address.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={8}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Acme Studio, hello@acme.com\nNorthwind <team@northwind.io>\nhello@pineandoak.agency"}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
          <Button onClick={bulkImport} disabled={!bulkText.trim()}>Import</Button>
        </DialogFooter>
      </Dialog>

      {/* Per-agency draft dialog */}
      <Dialog open={!!draftFor} onOpenChange={(v) => !v && setDraftFor(null)}>
        {draftFor && (
          <>
            <DialogHeader>
              <DialogTitle>Email to {draftFor.name}</DialogTitle>
              <DialogDescription>{draftFor.email} · Personalized for this agency — review before sending.</DialogDescription>
            </DialogHeader>
            {agencyDrafting ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Drafting…</div>
            ) : (
              <div className="space-y-3">
                <Input value={agencyDraft.subject} onChange={(e) => setAgencyDraft({ ...agencyDraft, subject: e.target.value })} placeholder="Subject" />
                <Textarea rows={9} value={agencyDraft.body} onChange={(e) => setAgencyDraft({ ...agencyDraft, body: e.target.value })} placeholder="Body" />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraftFor(null)}>Close</Button>
              <Button variant="outline" onClick={() => copy(`${agencyDraft.subject}\n\n${agencyDraft.body}`, "Email")}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button variant="outline" disabled={!agencyDraft.subject}
                onClick={() => window.open(`mailto:${draftFor.email}?subject=${encodeURIComponent(agencyDraft.subject)}&body=${encodeURIComponent(agencyDraft.body)}`, "_self")}>
                <Mail className="size-4" /> Open in mail app
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* AI Lead Finder dialog */}
      <Dialog open={leadOpen} onOpenChange={(v) => { setLeadOpen(v); if (!v) setLeadResults([]); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> AI Lead Finder</DialogTitle>
          <DialogDescription>Describe who you want to reach and AI suggests example prospects to research. They&apos;re generated, not looked up — check each one is a real company with a real address before adding or contacting it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Who are you targeting?</Label>
              <Input placeholder="e.g. web design agencies, SaaS startups, real estate firms" value={leadNiche} onChange={(e) => setLeadNiche(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findLeads()} />
            </div>
            <div className="space-y-1.5">
              <Label>Region (optional)</Label>
              <Input placeholder="e.g. US, UK, Dubai" value={leadRegion} onChange={(e) => setLeadRegion(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Try:</span>
            {["design agencies", "funded startups", "real estate", "ecommerce brands", "law firms"].map((s: any) => (
              <button key={s} onClick={() => setLeadNiche(s)} className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">{s}</button>
            ))}
          </div>
          <Button variant="gradient" className="w-full" onClick={findLeads} disabled={leadLoading}>
            {leadLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {leadLoading ? "Finding prospects…" : "Find leads"}
          </Button>

          {leadResults.length > 0 && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              AI-generated examples — names and emails may not be real. Verify before contacting.
            </p>
          )}
          {leadResults.length > 0 && (
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {leadResults.map((l, i) => (
                <button key={i} onClick={() => toggleLead(i)}
                  className={cn("flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                    leadSelected.has(i) ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40")}>
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    leadSelected.has(i) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                    {leadSelected.has(i) && <CheckCircle2 className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{l.name}</span>
                      {l.size && <Badge variant="secondary" className="text-[10px]">{l.size}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{l.email} · {l.focus}</span>
                    {l.why && <span className="mt-0.5 block text-[11px] text-primary/80">{l.why}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLeadOpen(false)}>Close</Button>
          {leadResults.length > 0 && (
            <Button variant="gradient" onClick={addSelectedLeads} disabled={leadSelected.size === 0}>
              <Plus className="size-4" /> Add {leadSelected.size} to targets
            </Button>
          )}
        </DialogFooter>
      </Dialog>

      {/* Add outreach target dialog */}
      <Dialog open={targetOpen} onOpenChange={setTargetOpen}>
        <DialogHeader>
          <DialogTitle>Add outreach target</DialogTitle>
          <DialogDescription>A person to reach out to — you'll review every message before it goes anywhere.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={target.platform} onChange={(e) => setTarget({ ...target, platform: e.target.value })}>
              {PLATFORMS.map((p: any) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Name / handle</Label><Input value={target.target} onChange={(e) => setTarget({ ...target, target: e.target.value })} placeholder="@janedoe or Jane Doe" /></div>
          <div className="space-y-1.5"><Label>Profile / thread URL (optional)</Label><Input value={target.profileUrl} onChange={(e) => setTarget({ ...target, profileUrl: e.target.value })} placeholder="https://…" /></div>
          <div className="space-y-1.5"><Label>Context note (optional)</Label><Input value={target.note} onChange={(e) => setTarget({ ...target, note: e.target.value })} placeholder="e.g. posted looking for dashboard help" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setTargetOpen(false)}>Cancel</Button>
          <Button onClick={addTarget} disabled={!target.target.trim()}>Add target</Button>
        </DialogFooter>
      </Dialog>

      {/* Review / edit message dialog */}
      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        {editRow && (
          <>
            <DialogHeader>
              <DialogTitle>Message to {editRow.target}</DialogTitle>
              <DialogDescription>
                {editRow.platform} · Review and edit, then copy it into the platform yourself.
              </DialogDescription>
            </DialogHeader>
            <Textarea rows={9} value={editMsg} onChange={(e) => setEditMsg(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRow(null)}>Close</Button>
              <Button variant="outline" onClick={() => copyOutreach({ ...editRow, message: editMsg })}><Copy className="size-4" /> Copy</Button>
              <Button onClick={() => { demo?.patchOutreach(editRow.id, { message: editMsg }); setEditRow(null); toast({ title: "Message saved", variant: "success" }); }}>
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </>
  );
}
