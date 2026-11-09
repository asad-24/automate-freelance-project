"use client";
import { Save, Star, Clock, Globe } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";

export default function FreelancerProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your freelancer profile and pool settings."
        actions={
          <Button variant="gradient" onClick={() => toast({ title: "Profile updated", variant: "success" })}>
            <Save className="size-4" /> Save
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Avatar name={user?.name ?? "Freelancer"} size={80} />
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex gap-1.5">
              <Badge variant="success" className="gap-1"><Star className="size-3" /> 96/100</Badge>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="mt-2 w-full space-y-2 text-left text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>India</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg delivery</span><span>4.2 days</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>$28/h</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile & Skills</CardTitle>
            <CardDescription>These determine which specs get broadcast to you.</CardDescription>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hourly rate (USD)</Label>
                <Input type="number" defaultValue="28" />
              </div>
              <div className="space-y-1.5">
                <Label>Availability</Label>
                <Select defaultValue="full">
                  <option value="full">Full-time</option>
                  <option value="part">Part-time</option>
                  <option value="occasional">Occasional</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Skills</Label>
              <Input defaultValue="React, Next.js, Node.js, TypeScript" />
            </div>
            <div className="space-y-1.5">
              <Label>Portfolio / GitHub</Label>
              <Input type="url" defaultValue="https://github.com/priyasharma" />
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea rows={3} defaultValue="Full-stack developer specializing in React/Next.js with 6 years of experience shipping production SaaS." />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
