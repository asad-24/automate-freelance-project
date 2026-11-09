"use client";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoAvatar, ChangePhotoButton } from "@/components/shared/photo-picker";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function ClientProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your account and company details."
        actions={
          <Button variant="gradient" onClick={() => toast({ title: "Profile updated", variant: "success" })}>
            <Save className="size-4" /> Save
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <PhotoAvatar name={user?.name ?? "Client"} size={80} />
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge>{user?.company ?? "Client"}</Badge>
            <ChangePhotoButton />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Update your contact and company information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input defaultValue={user?.name.split(" ")[0]} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input defaultValue={user?.name.split(" ")[1] ?? ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" defaultValue={user?.email} />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input defaultValue={user?.company} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+1 (555) 000-0000" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
