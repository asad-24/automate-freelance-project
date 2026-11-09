"use client";
import * as React from "react";
import { Copy, Heart, Tag, Globe, Mail, MessageCircle, Mic, Briefcase, Sparkles, Loader2, ExternalLink, Save, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { conversations as conversationsSeed, chatMessages as chatMessagesSeed } from "@/lib/mock-data";
import { API_URL, apiCall, apiGet } from "@/lib/api";
import { useEntity } from "@/lib/use-entity";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelative } from "@/lib/utils";

const channelIcon: Record<string, any> = { Web: Globe, Email: Mail, WhatsApp: MessageCircle, Discord: Mic, Fiverr: Globe, Upwork: Briefcase, LinkedIn: Globe };

export default function ConversationsPage() {
  const { toast } = useToast();
  const conversations = useEntity("conversations", conversationsSeed, 5000);
  const chatMessages = useEntity("chat-messages", chatMessagesSeed);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = React.useState("All");
  const [drafting, setDrafting] = React.useState(false);
  const [inboundAddress, setInboundAddress] = React.useState<{ configured: boolean; address?: string | null } | null>(null);
  const [outlookSync, setOutlookSync] = React.useState<{ configured: boolean; canConnect: boolean; connected: boolean; ready: boolean; lastSyncAt?: string; reason: string } | null>(null);
  const [syncingOutlook, setSyncingOutlook] = React.useState(false);
  React.useEffect(() => { apiGet<{ configured: boolean; address?: string | null }>("/api/inbox/address").then((v) => v && setInboundAddress(v)); }, []);
  React.useEffect(() => { apiGet<typeof outlookSync>("/api/inbox/sync/status").then((v) => v && setOutlookSync(v)); }, []);
  const platforms = React.useMemo(() => ["All", ...Array.from(new Set(conversations.map((c: any) => c.channel)))], [conversations]);
  const visible = platformFilter === "All" ? conversations : conversations.filter((c: any) => c.channel === platformFilter);
  const active = conversations.find((c: any) => c.id === selected) ?? visible[0] ?? conversations[0] ?? null;

  // Each demo conversation carries its own generated thread; older/back-end
  // conversations fall back to the shared transcript.
  const baseThread = ((active as any)?.thread as typeof chatMessages | undefined) ?? chatMessages;
  const allMessages = baseThread;
  const latestMessage = (active as any)?.thread?.[(active as any)?.thread?.length - 1];

  React.useEffect(() => {
    setDraft(latestMessage?.replyDraft ?? "");
  }, [active?.id]);

  const select = (id: string) => {
    setSelected(id);
    setReadIds((p) => new Set(p).add(id));
    const conv = conversations.find((c: any) => c.id === id) as any;
    for (const message of conv?.thread ?? []) {
      if (message.unread) void apiCall(`/api/inbox/messages/${message.id}/read`, {});
    }
  };

  const copyDraft = async () => {
    const text = draft.trim();
    if (!text || !active) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Reply copied", description: "Open the original thread and paste it there." });
    } catch {
      toast({ title: "Copy blocked by browser", description: "Select and copy the draft manually." });
    }
  };

  const saveDraft = async () => {
    if (!latestMessage?.id) return;
    const res = await apiCall<{ reply: string }>(
      `/api/inbox/messages/${encodeURIComponent(latestMessage.id)}/reply-draft`,
      { reply: draft },
      "PUT",
    );
    if (res && res.status < 400) toast({ title: "Draft saved", description: "It will be here when you reopen this conversation." });
    else toast({ title: "Couldn't save draft", description: (res?.data as any)?.detail ?? "Check the backend connection and try again." });
  };

  const syncOutlook = async () => {
    if (syncingOutlook || !outlookSync?.ready) return;
    setSyncingOutlook(true);
    const res = await apiCall<{ added: number; duplicates: number; ignored: number; syncedAt: string }>("/api/inbox/sync/outlook", {});
    setSyncingOutlook(false);
    if (res && res.status < 400) {
      setOutlookSync((current) => current ? { ...current, lastSyncAt: res.data.syncedAt } : current);
      toast({ title: `Outlook sync complete`, description: `${res.data.added} new marketplace messages; ${res.data.duplicates} duplicates skipped.` });
    } else toast({ title: "Outlook sync failed", description: (res?.data as any)?.detail ?? "Check the connection and try again." });
  };

  // Draft-only reply flow. The user sends the response manually on-platform.
  const draftReply = async () => {
    if (!active || drafting) return;
    setDrafting(true);
    const res = await apiCall<{ reply: string; aiGenerated: boolean; detail?: string }>(
      "/api/inbox/reply-draft",
      { messageId: latestMessage?.id, tone: "professional" }
    );
    setDrafting(false);
    if (res?.data?.reply) {
      setDraft(res.data.reply);
      if (!res.data.aiGenerated) toast({ title: "Draft ready", description: "AI offline — used a template. Edit freely." });
    } else {
      toast({ title: "Couldn't draft a reply", description: res?.data?.detail ?? "The inbox message or backend is unavailable." });
    }
  };

  return (
    <>
      <PageHeader
        title="Unified Inbox"
        description="Forwarded Fiverr, Upwork, and Freelancer.com notifications in one inbox. Replies are drafted here and sent manually on the platform."
        actions={
          <Badge variant="secondary">Manual send</Badge>
        }
      />

      {inboundAddress && <Card><CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Forward marketplace notifications here</p>
          <p className="break-all text-xs text-muted-foreground">{inboundAddress.address ?? "Inbound email is not configured on the server yet."}</p>
        </div>
        {inboundAddress.address && <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(inboundAddress.address!).then(() => toast({ title: "Address copied" })).catch(() => toast({ title: "Copy blocked by browser" }))}><Copy className="size-3.5" /> Copy</Button>}
      </CardContent></Card>}

      {outlookSync && <Card><CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Microsoft Outlook mailbox</p>
          <p className="text-xs text-muted-foreground">{outlookSync.reason}{outlookSync.lastSyncAt ? ` Last synced ${formatRelative(outlookSync.lastSyncAt)}.` : ""}</p>
        </div>
        {!outlookSync.connected && outlookSync.canConnect && <Button size="sm" variant="outline" asChild><Link href="/dashboard/accounts">Connect Outlook</Link></Button>}
        {outlookSync.ready && <Button size="sm" variant="outline" onClick={() => void syncOutlook()} disabled={syncingOutlook}>
          {syncingOutlook ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync now
        </Button>}
      </CardContent></Card>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversation list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Inbox</CardTitle>
            <div className="flex flex-wrap gap-1 pt-2">
              {platforms.map((p: any) => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    platformFilter === p ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/50")}>
                  {p}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {visible.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No forwarded platform messages yet. Configure an inbound mailbox to start receiving notifications.
              </p>
            )}
            {visible.map((c: any) => {
              const Icon = channelIcon[c.channel] ?? MessageCircle;
              const unread = readIds.has(c.id) ? 0 : c.unread;
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={cn(
                    "w-full rounded-lg p-3 text-left transition-colors",
                    selected === c.id ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={c.contact} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{c.contact}</p>
                        {unread > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{c.persona}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">{formatRelative(c.time)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{c.last}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Chat panel */}
        <Card className="flex flex-col lg:col-span-2">
          {!active ? (
            <CardContent className="flex flex-1 items-center justify-center py-24 text-center text-sm text-muted-foreground">
              Select a conversation to see exactly what your agent sent — outreach, replies, and closes.
            </CardContent>
          ) : (
          <>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={active.contact} size={36} />
                <div>
                  <CardTitle className="text-base">{active.contact}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    via {active.channel} · persona: {active.persona}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(active as any).deepLink && <Button size="sm" variant="outline" asChild><a href={(active as any).deepLink} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /> Open thread</a></Button>}
                {active.sentiment && <Badge variant={active.sentiment === "positive" ? "success" : active.sentiment === "at-risk" ? "destructive" : "secondary"} className="gap-1"><Heart className="size-3" /> {active.sentiment}</Badge>}
                <StatusBadge status={active.channel} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {allMessages.map((m: any) => (
                <div key={m.id} className={cn("flex", m.from === "ai" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                      m.from === "ai" ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <p>{m.text}</p>
                    <div className={cn("mt-1 flex items-center gap-2 text-[10px]", m.from === "ai" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span>{m.author} · {m.time}</span>
                      {m.delay && <span className="opacity-70">· {m.delay}s delay</span>}
                      {m.upsell && (
                        <Badge variant="secondary" className="gap-1 border-primary-foreground/30 bg-white/20 text-[10px] text-inherit">
                          <Tag className="size-2.5" /> Upsell
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-4">
              <div className="mb-3"><Badge variant="outline" className="text-xs">Review before pasting · no message is sent here</Badge></div>
              <div className="flex gap-2">
                <Input
                  placeholder="Draft a reply to copy into the platform..."
                  className="flex-1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <Button variant="outline" onClick={draftReply} disabled={drafting} title="Draft a reply with AI — you edit and send">
                  {drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                </Button>
                {API_URL && latestMessage?.id && <Button variant="outline" onClick={saveDraft} title="Save this reply draft"><Save className="size-4" /> Save</Button>}
                <Button variant="gradient" onClick={copyDraft}>
                  <Copy className="size-4" /> Copy reply
                </Button>
              </div>
            </div>
          </CardContent>
          </>
          )}
        </Card>
      </div>
    </>
  );
}
