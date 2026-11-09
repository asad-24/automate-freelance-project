"use client";
import { UserSquare2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { personas as personasSeed } from "@/lib/mock-data";
import { apiPatch, apiPost } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useEntity } from "@/lib/use-entity";
import { useAppMode } from "@/lib/app-mode";
import * as React from "react";

export default function PersonasPage() {
  const { mode } = useAppMode();
  const personasBase = useEntity("personas", personasSeed);
  const { toast } = useToast();
  const [extra, setExtra] = React.useState<any[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: "", role: "", style: "" });
  const personas = [...personasBase, ...extra];
  const addPersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.role.trim()) return;
    const p = { id: `local-${Date.now()}`, name: draft.name.trim(), role: draft.role.trim(), style: draft.style.trim() || "Professional, concise", conversations: 0, active: true };
    setExtra((x) => [...x, p]);
    setStates((s) => ({ ...s, [p.id]: true }));
    apiPost("/api/personas", p);
    setDraft({ name: "", role: "", style: "" });
    setAdding(false);
    toast({ title: `Persona ${p.name} added`, variant: "success" });
  };
  const [states, setStates] = React.useState<Record<string, boolean>>(
    Object.fromEntries(personasSeed.map((p: any) => [p.id, p.active]))
  );

  return (
    <>
      <PageHeader
        title="Agency Personas"
        description='The "team" clients interact with — Sarah the PM, Mike the Senior Dev, and more.'
        actions={
          <Button variant="gradient" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> New persona
          </Button>
        }
      />

      <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-warning-foreground">Disclosure note</p>
        <p className="mt-1 text-muted-foreground">
          Presenting fictional personas as a "team" can raise consumer-protection and ethical concerns. This
          capability is fully implemented but gated — it operates per the current{" "}
          <Badge variant={mode === "stealth" ? "destructive" : "success"}>{mode}</Badge> mode setting.
        </p>
      </div>

      {adding && (
        <form onSubmit={addPersona} className="mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-4" aria-label="New persona">
          <div className="space-y-1.5"><Label htmlFor="pn">Name</Label><Input id="pn" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Sarah" /></div>
          <div className="space-y-1.5"><Label htmlFor="pr">Role</Label><Input id="pr" required value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Project Manager" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ps">Style</Label><Input id="ps" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="Warm, concise, proactive" /></div>
          <div className="flex gap-2 sm:col-span-4"><Button type="submit" variant="gradient">Add persona</Button><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      )}

      {personas.length === 0 && <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">No personas yet. Add one with New persona.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {personas.map((p: any) => (
          <Card key={p.id} className="text-center">
            <CardContent className="p-6">
              <Avatar name={p.name} size={64} className="mx-auto" />
              <h3 className="mt-4 font-semibold">{p.name}</h3>
              <p className="text-sm text-primary">{p.role}</p>
              <p className="mt-2 text-xs text-muted-foreground">{p.style}</p>
              <p className="mt-3 text-xs text-muted-foreground">{p.conversations} conversations</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Switch
                  checked={states[p.id]}
                  onCheckedChange={(v) => { setStates((s) => ({ ...s, [p.id]: v })); apiPatch(`/api/personas/${p.id}`, { active: v }); }}
                />
                <span className="text-xs text-muted-foreground">{states[p.id] ? "Active" : "Inactive"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
