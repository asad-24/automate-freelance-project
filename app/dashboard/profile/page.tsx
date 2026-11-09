"use client";
import * as React from "react";
import { Save, Plus, X, Star, MapPin, Globe, Briefcase, Link2, BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoAvatar, ChangePhotoButton } from "@/components/shared/photo-picker";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { apiCall } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const PLATFORMS = ["Upwork", "Fiverr", "LinkedIn", "GitHub", "Portfolio site"];

export default function ProfilePage() {
  const { user, demoMode } = useAuth();
  const { toast } = useToast();

  const [available, setAvailable] = React.useState(true);
  const [rate, setRate] = React.useState("65");
  const [title, setTitle] = React.useState("Full-Stack Developer · Next.js & AI");
  const [location, setLocation] = React.useState("Remote");
  const [bio, setBio] = React.useState("I help startups ship production web apps fast — Next.js, AI integrations, dashboards and automation.");
  const [skills, setSkills] = React.useState<string[]>(["Next.js", "React", "TypeScript", "Python", "AI Integrations", "Dashboards"]);
  const [newSkill, setNewSkill] = React.useState("");
  const [links, setLinks] = React.useState<Record<string, string>>({ Upwork: "", Fiverr: "", LinkedIn: "", GitHub: "", "Portfolio site": "" });
  const [portfolio] = React.useState([
    { id: "p1", title: "SaaS Analytics Dashboard", tag: "Next.js · Recharts", value: "$4,800" },
    { id: "p2", title: "AI Support Chatbot", tag: "Python · GPT", value: "$3,200" },
  ]);

  const stats = [
    { label: "Jobs completed", value: "—" },
    { label: "Avg rating", value: "—" },
    { label: "Total earned", value: "—" },
    { label: "Response", value: "—" },
  ];

  function addSkill() {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) setSkills((v) => [...v, s]);
    setNewSkill("");
  }

  async function save() {
    const res = await apiCall<{ detail?: string }>("/api/settings", { profile: { title, rate, location, bio, skills, links, available } }, "PATCH");
    if (res ? res.status < 400 : demoMode) {
      toast({ title: "Profile saved", variant: "success" });
    } else {
      toast({ title: "Profile not saved", description: res?.data?.detail ?? "Can't reach the server — try again." });
    }
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="How clients and the matching engine see you."
        actions={<Button variant="gradient" onClick={save}><Save className="size-4" /> Save profile</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Identity card */}
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="relative">
                <PhotoAvatar name={user?.name ?? "User"} size={88} />
                <span className={`absolute bottom-1 right-1 size-4 rounded-full border-2 border-card ${available ? "bg-success" : "bg-muted-foreground"}`} />
              </div>
              <div>
                <p className="flex items-center justify-center gap-1.5 font-semibold">{user?.name} <BadgeCheck className="size-4 text-primary" /></p>
                <p className="text-sm text-muted-foreground">{title || "Freelancer"}</p>
                <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {location}</p>
              </div>
              <Badge>{user?.role}</Badge>
              <div className="flex w-full items-center justify-between rounded-lg border p-3 text-left">
                <div><p className="text-sm font-medium">Available for work</p><p className="text-xs text-muted-foreground">Show up in client searches</p></div>
                <Switch checked={available} onCheckedChange={setAvailable} />
              </div>
              <ChangePhotoButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Stats</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {stats.map((s: any) => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle><CardDescription>Your professional headline and rate.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5"><Label>Headline</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Hourly rate ($)</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" defaultValue={user?.email} /></div>
              <div className="space-y-1.5"><Label>Bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader><CardTitle>Skills</CardTitle><CardDescription>Used by Job Radar to match you to work.</CardDescription></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {skills.map((s: any) => (
                  <Badge key={s} variant="secondary" className="gap-1 pl-2.5">
                    {s}
                    <button onClick={() => setSkills((v) => v.filter((x: any) => x !== s))}><X className="size-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input placeholder="Add a skill..." value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSkill()} />
                <Button variant="outline" onClick={addSkill}><Plus className="size-4" /> Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Platform links */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-4" /> Platform Profiles</CardTitle><CardDescription>Where clients can find &amp; verify you.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {PLATFORMS.map((p: any) => (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm font-medium">{p}</span>
                  <Input placeholder={`https://${p.toLowerCase().replace(" ", "")}.com/you`} value={links[p]} onChange={(e) => setLinks((v) => ({ ...v, [p]: e.target.value }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Portfolio */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Briefcase className="size-4" /> Portfolio</CardTitle><CardDescription>Your best work.</CardDescription></div>
              <Button size="sm" variant="outline" onClick={() => toast({ title: "Portfolio item added" })}><Plus className="size-4" /> Add</Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {portfolio.map((p: any) => (
                <div key={p.id} className="rounded-lg border p-4 transition-colors hover:border-primary/50">
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.tag}</p>
                  <p className="mt-2 text-sm font-semibold text-primary">{p.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
