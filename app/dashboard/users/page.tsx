"use client";
import * as React from "react";
import { UserPlus, ShieldCheck, Link2, Copy, Mail, Clock, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { dashboardUsers as dashboardUsersSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { useToast } from "@/components/ui/toast";

type Invite = { id: string; email: string; role: string; status: "Pending" | "Accepted"; sentAt: string };

export default function TeamPage() {
  const { toast } = useToast();
  const dashboardUsers = useEntity("users", dashboardUsersSeed);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("Operator");
  const [invites, setInvites] = React.useState<Invite[]>([
    { id: "iv1", email: "sam@agency.ai", role: "Viewer", status: "Pending", sentAt: "2d ago" },
  ]);

  const inviteLinks = [
    { label: "Freelancer signup", href: "/signup/freelancer", desc: "Invite talent to your delivery pool" },
    { label: "Client signup", href: "/signup/client", desc: "Bring clients onto the portal" },
    { label: "Admin / team", href: "/signup/admin", desc: "Add operators & admins" },
  ];

  function sendInvite() {
    if (!inviteEmail.includes("@")) {
      toast({ title: "Enter a valid email" });
      return;
    }
    setInvites((v) => [{ id: `iv${Date.now()}`, email: inviteEmail, role: inviteRole, status: "Pending", sentAt: "just now" }, ...v]);
    setInviteEmail("");
    setInviteOpen(false);
    toast({ title: `Invite sent to ${inviteEmail}`, variant: "success" });
  }

  function copyLink(path: string) {
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast({ title: "Invite link copied", description: url, variant: "success" });
  }

  const memberCols: Column<typeof dashboardUsersSeed[number]>[] = [
    { key: "name", header: "User", render: (r) => (
      <div className="flex items-center gap-3">
        <Avatar name={r.name} size={34} />
        <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div>
      </div>
    )},
    { key: "role", header: "Role", render: (r) => <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" /> {r.role}</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "lastActive", header: "Last Active", render: (r) => <span className="text-muted-foreground">{r.lastActive}</span> },
    { key: "actions", header: "", render: (r) => r.role !== "Admin" ? <Button size="sm" variant="ghost" onClick={() => toast({ title: `${r.name} removed`, variant: "success" })}><Trash2 className="size-4" /></Button> : null },
  ];

  const inviteCols: Column<Invite>[] = [
    { key: "email", header: "Email", render: (r) => <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /><span className="font-medium">{r.email}</span></div> },
    { key: "role", header: "Role", render: (r) => <Badge variant="outline">{r.role}</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "sentAt", header: "Sent", render: (r) => <span className="flex items-center gap-1 text-muted-foreground"><Clock className="size-3" /> {r.sentAt}</span> },
    { key: "actions", header: "", render: (r) => <Button size="sm" variant="ghost" onClick={() => { setInvites((v) => v.filter((i: any) => i.id !== r.id)); toast({ title: "Invite revoked" }); }}>Revoke</Button> },
  ];

  const permissions = [
    { role: "Admin", desc: "Full control — billing, agents, team, security", scope: "Everything" },
    { role: "Operator", desc: "Run agents, manage clients & delivery", scope: "Workspace" },
    { role: "Viewer", desc: "Read-only dashboards & reports", scope: "View only" },
    { role: "Freelancer", desc: "Own bids, contracts & earnings", scope: "Freelancer portal" },
    { role: "Client", desc: "Projects, milestones, files & invoices", scope: "Client portal" },
  ];

  return (
    <>
      <PageHeader
        title="Team & Invites"
        description="Invite teammates, freelancers and clients — with the right level of access."
        actions={
          <Button variant="gradient" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" /> Invite member
          </Button>
        }
      />

      {/* Invite links */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {inviteLinks.map((l: any) => (
          <Card key={l.href}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium"><Link2 className="size-4 text-primary" /> {l.label}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.desc}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copyLink(l.href)}><Copy className="size-3.5" /> Copy</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members"><Users className="mr-1.5 size-3.5" /> Members</TabsTrigger>
          <TabsTrigger value="invites"><Mail className="mr-1.5 size-3.5" /> Pending Invites <Badge variant="secondary" className="ml-1.5 h-4 px-1">{invites.length}</Badge></TabsTrigger>
          <TabsTrigger value="permissions"><ShieldCheck className="mr-1.5 size-3.5" /> Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <DataTable columns={memberCols} data={dashboardUsers} searchKeys={["name", "email"]} searchPlaceholder="Search members..." />
        </TabsContent>

        <TabsContent value="invites">
          <DataTable columns={inviteCols} data={invites} searchKeys={["email"]} searchPlaceholder="Search invites..." />
        </TabsContent>

        <TabsContent value="permissions">
          <div className="space-y-3">
            {permissions.map((p: any) => (
              <Card key={p.role}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-primary" /> {p.role}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                  <Badge variant="secondary">{p.scope}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <div>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>They'll get an email with a link to join your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="Admin">Admin — full control</option>
                <option value="Operator">Operator — run the workspace</option>
                <option value="Viewer">Viewer — read-only</option>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button variant="gradient" onClick={sendInvite}><Mail className="size-4" /> Send invite</Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
