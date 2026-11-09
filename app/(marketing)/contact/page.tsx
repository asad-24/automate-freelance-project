"use client";
import * as React from "react";
import { Mail, MapPin, Phone, Send, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [sent, setSent] = React.useState(false);

  return (
    <div>
      <section className="border-b bg-muted/30 py-16">
        <div className="container max-w-3xl text-center">
          <Badge className="mb-4">Contact</Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Let's talk</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Tell us about your project or book a discovery call — our team responds within one business day.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            {[
              { icon: Mail, label: "Email", value: "hello@autopilot-agency.ai" },
              { icon: Phone, label: "Phone", value: "+1 (310) 555-0199" },
              { icon: MapPin, label: "HQ", value: "Los Angeles, CA (Remote-first)" },
              { icon: CalendarClock, label: "Hours", value: "24/7 autonomous · Mon–Fri human support" },
            ].map((c: any) => (
              <Card key={c.label}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <c.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-medium">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="overflow-hidden rounded-xl border">
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary/20 to-purple-500/20 text-sm text-muted-foreground">
                <MapPin className="mr-2 size-5" /> Map placeholder
              </div>
            </div>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Send us a message</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                  toast({ title: "Message sent", description: "We'll get back to you shortly.", variant: "success" });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" placeholder="Jane Doe" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="jane@company.com" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" placeholder="Company Inc." />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Budget</Label>
                  <Select id="budget" defaultValue="">
                    <option value="" disabled>Select a range</option>
                    <option>$500 – $2,000</option>
                    <option>$2,000 – $10,000</option>
                    <option>$10,000 – $50,000</option>
                    <option>$50,000+</option>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="What can we help with?" required />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" rows={5} placeholder="Tell us about your project..." required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="gradient" className="w-full sm:w-auto" disabled={sent}>
                    <Send className="size-4" /> {sent ? "Message sent" : "Send message"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
