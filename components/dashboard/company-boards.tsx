"use client";
import * as React from "react";
import { Building2, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiCall, apiGet } from "@/lib/api";

type Board = { provider: string; slug: string };
type Provider = { id: string; name: string; hint: string; terms: string; enabled: boolean };
type BoardsResponse = { boards: Board[]; providers: Provider[]; max: number };

/**
 * Companies whose public careers board (Greenhouse, Lever, Ashby,
 * SmartRecruiters…) Job Radar reads on every scan. These ATS vendors publish
 * job-board APIs for exactly this; listings link back to the company's page.
 */
export function CompanyBoards({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const [data, setData] = React.useState<BoardsResponse | null>(null);
  const [provider, setProvider] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    apiGet<BoardsResponse>("/api/radar/boards").then((res) => {
      if (!alive || !res) return;
      setData(res);
      setProvider((current) => current || res.providers.find((p) => p.enabled)?.id || "");
    });
    return () => { alive = false; };
  }, []);

  const save = async (boards: Board[], success: string) => {
    setSaving(true);
    const res = await apiCall<BoardsResponse>("/api/radar/boards", { boards }, "PUT");
    setSaving(false);
    if (!res || res.status >= 400) {
      toast({ title: "Watchlist not saved", description: (res?.data as any)?.detail ?? "Check your connection and try again." });
      return false;
    }
    setData(res.data);
    toast({ title: success, description: "Run a scan to include its openings.", variant: "success" });
    onChange?.();
    return true;
  };

  if (!data) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Company boards are available once the backend is connected.</CardContent></Card>;
  }

  const providerName = (id: string) => data.providers.find((p) => p.id === id)?.name ?? id;
  const enabledProviders = data.providers.filter((p) => p.enabled);
  const current = enabledProviders.find((p) => p.id === provider);
  const add = async () => {
    const name = slug.trim().replace(/^https?:\/\/[^/]+\//, "").split(/[/?#]/)[0];
    if (!name) return;
    if (await save([...data.boards, { provider, slug: name }], `Watching ${name} on ${providerName(provider)}`)) setSlug("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4 text-primary" /> Company career boards</CardTitle>
        <CardDescription>
          Add companies you want to work with. Job Radar reads their public careers board on every scan and links each opening back to the company’s page. Up to {data.max} companies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabledProviders.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Company boards are built but switched off here: the {data.providers.map((p) => p.name).join(", ")} job-board APIs are public but grant no licence for showing listings in another product, so each one waits for a reuse review before it can be turned on.
          </p>
        ) : <>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="board-provider">Careers site runs on</Label>
            <Select id="board-provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {enabledProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="board-slug">Company board name</Label>
            <Input id="board-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. gitlab"
              onKeyDown={(e) => e.key === "Enter" && add()} />
          </div>
          <Button onClick={add} disabled={saving || !slug.trim() || data.boards.length >= data.max}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Watch
          </Button>
        </div>
        {current && <p className="text-xs text-muted-foreground">{current.hint}</p>}
        </>}
        {data.boards.length === 0
          ? <p className="py-4 text-center text-sm text-muted-foreground">No companies watched yet.</p>
          : <div className="flex flex-wrap gap-2">
              {data.boards.map((b) => (
                <div key={`${b.provider}/${b.slug}`} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                  <span className="font-medium">{b.slug}</span>
                  <Badge variant="secondary" className="text-[10px]">{providerName(b.provider)}</Badge>
                  <button type="button" aria-label={`Stop watching ${b.slug}`} disabled={saving}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => save(data.boards.filter((x) => x !== b), `Stopped watching ${b.slug}`)}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>}
      </CardContent>
    </Card>
  );
}
