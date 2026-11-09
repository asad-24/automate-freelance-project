"use client";
import * as React from "react";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const meMessages = [
  { id: "m1", from: "pm", author: "Sarah (PM)", text: "Hi Priya! New spec broadcast just dropped — SaaS analytics module. Want to bid?", time: "09:12" },
  { id: "m2", from: "me", author: "You", text: "Yes, reviewing it now. Looks like ~60h at $28/h.", time: "09:14" },
  { id: "m3", from: "pm", author: "Sarah (PM)", text: "Great — submit by EOD. Reminder: QA gate requires tests + Sonar ≥80.", time: "09:15" },
];

export default function FreelancerMessagesPage() {
  const [messages, setMessages] = React.useState(meMessages);
  const [text, setText] = React.useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setMessages((m) => [...m, { id: `m${m.length + 1}`, from: "me", author: "You", text, time: "now" }]);
    apiPost("/api/conversations/cv4/messages", { text, persona: "Dispatcher Bot" });
    setText("");
  };

  return (
    <>
      <PageHeader title="Messages" description="Direct line to your project managers and the dispatcher." />
      <Card className="flex h-[600px] flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <Avatar name="Sarah PM" size={36} />
            <div>
              <CardTitle className="text-base">Sarah (Project Manager)</CardTitle>
              <p className="text-xs text-muted-foreground">via Discord · dispatcher thread</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m: any) => (
              <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    m.from === "me" ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  <p>{m.text}</p>
                  <p className={cn("mt-1 text-[10px]", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {m.author} · {m.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="border-t p-4">
            <div className="flex gap-2">
              <Input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1" />
              <Button type="submit" variant="gradient" aria-label="Send message">
                <Send className="size-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
