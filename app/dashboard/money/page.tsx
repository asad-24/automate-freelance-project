"use client";
import * as React from "react";
import {
  Plus, Download, Trash2, CheckCircle2, Copy, Target, TrendingUp, TrendingDown, Wallet, Receipt, Search,
  ArrowDownLeft, ArrowUpRight, Crown, CreditCard, Undo2, FileText,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PaywallDialog } from "@/components/dashboard/paywall";
import { useToast } from "@/components/ui/toast";
import { useEntity } from "@/lib/use-entity";
import { useLedger, monthlySeries, toCsv, todayStr, monthKey, effectiveStatus, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/ledger";
import { cn, formatCurrency } from "@/lib/utils";
import { PAYMENTS_LIVE } from "@/lib/flags";
import { DEMO_MODE } from "@/lib/auth";

const fmtDate = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—");
const STATUS_TONE: Record<string, string> = {
  Paid: "bg-success/15 text-success", Sent: "bg-primary/15 text-primary", Overdue: "bg-destructive/15 text-destructive", Draft: "bg-muted text-muted-foreground",
};

export default function MoneyPage() {
  const { toast } = useToast();
  const L = useLedger();
  const monetization = useEntity("user-monetization", { plan: "free", bidCredits: 10, profileCredits: 2 } as any, 4000);
  const isPro = monetization.plan === "pro";

  const [tab, setTab] = React.useState("overview");
  const [paywall, setPaywall] = React.useState<"bids" | "profiles" | null>(null);

  // ---- derived numbers
  const thisMonth = monthKey(todayStr());
  const income = L.txns.filter((t) => t.type === "income" && monthKey(t.date) === thisMonth).reduce((n, t) => n + t.amount, 0);
  const expenses = L.txns.filter((t) => t.type === "expense" && monthKey(t.date) === thisMonth).reduce((n, t) => n + t.amount, 0);
  const outstanding = L.invoices.filter((i) => i.status !== "Paid" && i.status !== "Draft").reduce((n, i) => n + i.amount, 0);
  const overdue = L.invoices.filter((i) => effectiveStatus(i) === "Overdue");
  const series = monthlySeries(L.txns, 6);
  const maxBar = Math.max(1, ...series.map((s) => Math.max(s.income, s.expense)));
  const bySource = Object.entries(L.txns.filter((t) => t.type === "income" && monthKey(t.date) === thisMonth).reduce<Record<string, number>>((m, t) => { m[t.party || t.category] = (m[t.party || t.category] ?? 0) + t.amount; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---- goal
  const [goalOpen, setGoalOpen] = React.useState(false);
  const [goalVal, setGoalVal] = React.useState("");

  // ---- transactions
  const [txnOpen, setTxnOpen] = React.useState(false);
  const [txn, setTxn] = React.useState({ type: "income", amount: "", date: todayStr(), category: INCOME_CATEGORIES[0], party: "", note: "" });
  const [txnErr, setTxnErr] = React.useState<Record<string, string>>({});
  const [tq, setTq] = React.useState("");
  const [tType, setTType] = React.useState("all");
  const [delTxn, setDelTxn] = React.useState<string | null>(null);
  const openTxn = (type: "income" | "expense") => { setTxn({ type, amount: "", date: todayStr(), category: (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0], party: "", note: "" }); setTxnErr({}); setTxnOpen(true); };
  const saveTxn = () => {
    const e: Record<string, string> = {};
    const amt = Number(txn.amount);
    if (!txn.amount || !Number.isFinite(amt) || amt <= 0) e.amount = "Enter an amount above 0.";
    else if (amt > 10_000_000) e.amount = "That amount looks too large.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) e.date = "Pick a date.";
    setTxnErr(e);
    if (Object.keys(e).length) return;
    L.addTxn({ type: txn.type as "income" | "expense", amount: Math.round(amt * 100) / 100, date: txn.date, category: txn.category, party: txn.party.trim(), note: txn.note.trim() });
    setTxnOpen(false);
    toast({ title: txn.type === "income" ? "Income recorded" : "Expense recorded", variant: "success" });
  };
  const txns = L.txns.filter((t) => tType === "all" || t.type === tType).filter((t) => !tq.trim() || `${t.party} ${t.category} ${t.note}`.toLowerCase().includes(tq.trim().toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  const exportCsv = () => {
    const blob = new Blob([toCsv(L.txns)], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `transactions-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  // ---- invoices
  const [invOpen, setInvOpen] = React.useState(false);
  const [inv, setInv] = React.useState({ client: "", email: "", amount: "", issued: todayStr(), due: "", description: "", status: "Sent" });
  const [invErr, setInvErr] = React.useState<Record<string, string>>({});
  const [invFilter, setInvFilter] = React.useState("All");
  const [delInv, setDelInv] = React.useState<string | null>(null);
  const openInv = () => { const d = new Date(); d.setDate(d.getDate() + 14); setInv({ client: "", email: "", amount: "", issued: todayStr(), due: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, description: "", status: "Sent" }); setInvErr({}); setInvOpen(true); };
  const saveInv = () => {
    const e: Record<string, string> = {};
    const amt = Number(inv.amount);
    if (!inv.client.trim()) e.client = "Who is this invoice for?";
    if (!inv.amount || !Number.isFinite(amt) || amt <= 0) e.amount = "Enter an amount above 0.";
    if (inv.email.trim() && !/^\S+@\S+\.\S+$/.test(inv.email.trim())) e.email = "That email doesn't look right.";
    if (!inv.due) e.due = "Pick a due date.";
    else if (inv.due < inv.issued) e.due = "Due date can't be before the issue date.";
    setInvErr(e);
    if (Object.keys(e).length) return;
    L.addInvoice({ client: inv.client.trim(), email: inv.email.trim(), amount: Math.round(amt * 100) / 100, issued: inv.issued, due: inv.due, description: inv.description.trim(), status: inv.status as "Draft" | "Sent" });
    setInvOpen(false);
    toast({ title: "Invoice created", variant: "success" });
  };
  const invoiceText = (i: (typeof L.invoices)[number]) => `Invoice ${i.number}\nTo: ${i.client}\nAmount: ${formatCurrency(i.amount)}\nIssued: ${fmtDate(i.issued)}\nDue: ${fmtDate(i.due)}\n${i.description ? `\n${i.description}\n` : ""}`;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast({ title: "Copied to clipboard", variant: "success" }); } catch { toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access." }); } };
  const invoices = L.invoices.filter((i) => invFilter === "All" || effectiveStatus(i) === invFilter);

  const bidLeft = Math.max(0, Number(monetization.bidCredits) || 0);
  const profLeft = Math.max(0, Number(monetization.profileCredits) || 0);

  const stat = (label: string, value: string, note: string, Icon: any, tone = "text-primary") => (
    <div className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className={cn("size-4", tone)} /></div><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="text-[11px] text-muted-foreground">{note}</p></div>
  );

  return (
    <>
      <PageHeader title="Money" description={`Track what you invoice, earn and spend. Everything here is your own record: nothing is charged or paid out from this page. ${DEMO_MODE ? "Saved in this browser." : "Saved to your account."}`}
        actions={<>
          <Button variant="outline" onClick={() => openTxn("expense")}><ArrowUpRight className="size-4" /> Add expense</Button>
          <Button variant="outline" onClick={() => openTxn("income")}><ArrowDownLeft className="size-4" /> Add income</Button>
          <Button variant="gradient" onClick={openInv}><Plus className="size-4" /> New invoice</Button>
        </>} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices{L.invoices.length > 0 && ` (${L.invoices.length})`}</TabsTrigger>
          <TabsTrigger value="transactions">Transactions{L.txns.length > 0 && ` (${L.txns.length})`}</TabsTrigger>
          <TabsTrigger value="plan">Plan &amp; credits</TabsTrigger>
        </TabsList>

        {/* ---------- OVERVIEW ---------- */}
        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stat("Income this month", formatCurrency(income), "recorded payments", TrendingUp, "text-success")}
            {stat("Expenses this month", formatCurrency(expenses), "recorded costs", TrendingDown, "text-destructive")}
            {stat("Net this month", formatCurrency(income - expenses), income - expenses >= 0 ? "profit" : "loss", Wallet)}
            {stat("Waiting to be paid", formatCurrency(outstanding), overdue.length ? `${overdue.length} overdue` : "nothing overdue", Receipt, overdue.length ? "text-destructive" : "text-primary")}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between"><p className="font-semibold">Last 6 months</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-primary" />Income</span><span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-muted-foreground/40" />Expenses</span></div></div>
              {L.txns.length === 0 ? (
                <div className="flex h-52 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Wallet className="size-8 opacity-40" /><p>No transactions yet. Record your first payment to see your trend.</p><Button size="sm" variant="outline" onClick={() => openTxn("income")}><Plus className="size-4" /> Add income</Button></div>
              ) : (
                <div className="flex h-52 items-end gap-3 border-b" role="img" aria-label="Monthly income and expenses">
                  {series.map((s) => (
                    <div key={s.key} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                      <div className="flex flex-1 items-end justify-center gap-1">
                        <div className="w-full max-w-5 rounded-t bg-primary" style={{ height: `${(s.income / maxBar) * 100}%` }} title={`Income ${formatCurrency(s.income)}`} />
                        <div className="w-full max-w-5 rounded-t bg-muted-foreground/40" style={{ height: `${(s.expense / maxBar) * 100}%` }} title={`Expenses ${formatCurrency(s.expense)}`} />
                      </div>
                      <p className="text-center text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <div className="space-y-5">
              <Card><CardContent className="p-5">
                <div className="flex items-center justify-between"><p className="font-semibold">Monthly goal</p><Button size="sm" variant="ghost" onClick={() => { setGoalVal(L.goal ? String(L.goal) : ""); setGoalOpen(true); }}><Target className="size-4" />{L.goal ? "Change" : "Set goal"}</Button></div>
                {L.goal > 0 ? (<><p className="mt-2 text-2xl font-bold">{formatCurrency(income)} <span className="text-sm font-normal text-muted-foreground">of {formatCurrency(L.goal)}</span></p><Progress value={(income / L.goal) * 100} className="mt-3" /><p className="mt-1.5 text-xs text-muted-foreground">{income >= L.goal ? "Goal reached." : `${formatCurrency(L.goal - income)} to go`}</p></>) : <p className="mt-2 text-sm text-muted-foreground">Set an income target to track your progress each month.</p>}
              </CardContent></Card>
              <Card><CardContent className="p-5">
                <p className="mb-3 font-semibold">Where income comes from</p>
                {bySource.length === 0 ? <p className="text-sm text-muted-foreground">Nothing recorded this month.</p> : (
                  <div className="space-y-3">{bySource.map(([name, amt]) => (<div key={name}><div className="flex justify-between text-sm"><span className="truncate font-medium">{name}</span><span className="font-semibold">{formatCurrency(amt)}</span></div><Progress value={(amt / Math.max(income, 1)) * 100} className="mt-1.5 h-1.5" /></div>))}</div>)}
              </CardContent></Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------- INVOICES ---------- */}
        <TabsContent value="invoices" className="space-y-4">
          {L.invoices.length > 0 && (
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit" role="group" aria-label="Invoice status">
              {["All", "Draft", "Sent", "Overdue", "Paid"].map((s) => <button key={s} aria-pressed={invFilter === s} onClick={() => setInvFilter(s)} className={cn("rounded-md px-3 py-1 text-xs font-medium", invFilter === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{s}</button>)}
            </div>
          )}
          {L.invoices.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10"><FileText className="size-6 text-primary" /></div><p className="font-medium">No invoices yet</p><p className="max-w-sm text-sm text-muted-foreground">Create an invoice, send it to your client yourself, and mark it paid here when the money arrives. Paid invoices become income automatically.</p><Button variant="gradient" onClick={openInv}><Plus className="size-4" /> Create invoice</Button></CardContent></Card>
          ) : invoices.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No {invFilter.toLowerCase()} invoices.</CardContent></Card>
          ) : (
            <div className="space-y-2.5" data-testid="invoice-list">
              {invoices.map((i) => { const st = effectiveStatus(i); return (
                <Card key={i.id} data-testid="invoice-row"><CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
                  <div className="min-w-0 flex-1 basis-48"><p className="font-semibold">{i.client}</p><p className="text-xs text-muted-foreground">{i.number} · issued {fmtDate(i.issued)}{i.description ? ` · ${i.description.slice(0, 40)}` : ""}</p></div>
                  <div className="text-right"><p className="text-lg font-bold">{formatCurrency(i.amount)}</p><p className="text-xs text-muted-foreground">{st === "Paid" ? `paid ${fmtDate(i.paidOn ?? "")}` : `due ${fmtDate(i.due)}`}</p></div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_TONE[st])}>{st}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {st === "Paid" ? <Button size="sm" variant="ghost" onClick={() => { L.markUnpaid(i.id); toast({ title: "Marked unpaid", description: "The income entry was removed." }); }}><Undo2 className="size-3.5" /> Undo</Button>
                      : <Button size="sm" variant="outline" onClick={() => { L.markPaid(i.id); toast({ title: "Marked as paid", description: "Added to your income.", variant: "success" }); }}><CheckCircle2 className="size-3.5" /> Mark paid</Button>}
                    {i.status === "Draft" && <Button size="sm" variant="ghost" onClick={() => { L.updateInvoice(i.id, { status: "Sent" }); toast({ title: "Marked as sent" }); }}>Mark sent</Button>}
                    <Button size="sm" variant="ghost" onClick={() => copy(invoiceText(i))}><Copy className="size-3.5" /> Copy</Button>
                    {delInv === i.id ? (<><Button size="sm" variant="destructive" onClick={() => { L.deleteInvoice(i.id); setDelInv(null); toast({ title: "Invoice deleted" }); }}>Confirm</Button><Button size="sm" variant="ghost" onClick={() => setDelInv(null)}>Cancel</Button></>) : <Button size="icon" variant="ghost" className="size-8" aria-label={`Delete ${i.number}`} onClick={() => setDelInv(i.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>}
                  </div>
                </CardContent></Card>); })}
            </div>
          )}
        </TabsContent>

        {/* ---------- TRANSACTIONS ---------- */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search transactions" className="h-9 pl-9" placeholder="Search by client, category or note" value={tq} onChange={(e) => setTq(e.target.value)} /></div>
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Type">{[["all", "All"], ["income", "Income"], ["expense", "Expenses"]].map(([v, l]) => <button key={v} aria-pressed={tType === v} onClick={() => setTType(v)} className={cn("rounded-md px-3 py-1 text-xs font-medium", tType === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}</div>
            <Button variant="outline" size="sm" disabled={L.txns.length === 0} onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          </div>
          {L.txns.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Wallet className="size-8 text-muted-foreground/50" /><p className="font-medium">No transactions yet</p><p className="max-w-sm text-sm text-muted-foreground">Record income when you get paid and expenses when you spend, so you always know your real profit.</p><div className="flex gap-2"><Button variant="gradient" onClick={() => openTxn("income")}><ArrowDownLeft className="size-4" /> Add income</Button><Button variant="outline" onClick={() => openTxn("expense")}><ArrowUpRight className="size-4" /> Add expense</Button></div></CardContent></Card>
          ) : txns.length === 0 ? (<Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No transactions match.</CardContent></Card>) : (
            <Card><CardContent className="divide-y p-0" data-testid="txn-list">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3" data-testid="txn-row">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.type === "income" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{t.type === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.party || t.category}</p><p className="truncate text-xs text-muted-foreground">{t.category} · {fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</p></div>
                  <p className={cn("text-sm font-semibold", t.type === "income" ? "text-success" : "")}>{t.type === "income" ? "+" : "−"}{formatCurrency(t.amount)}</p>
                  {delTxn === t.id ? (<div className="flex gap-1"><Button size="sm" variant="destructive" onClick={() => { L.deleteTxn(t.id); setDelTxn(null); toast({ title: "Transaction deleted" }); }}>Confirm</Button><Button size="sm" variant="ghost" onClick={() => setDelTxn(null)}>Cancel</Button></div>) : <Button size="icon" variant="ghost" className="size-8" aria-label="Delete transaction" onClick={() => setDelTxn(t.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>}
                </div>))}
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ---------- PLAN ---------- */}
        <TabsContent value="plan" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cn("rounded-xl border bg-card p-5", isPro && "border-primary")}><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Current plan</p><Crown className={cn("size-4", isPro ? "text-primary" : "text-muted-foreground/50")} /></div><p className="mt-1 text-2xl font-bold">{isPro ? "Pro" : "Basic"}</p><p className="text-xs text-muted-foreground">{isPro ? "Unlimited bids and profiles" : "Free"}</p></div>
            <div className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">Bid credits</p><p className="mt-1 text-2xl font-bold">{isPro ? "Unlimited" : bidLeft}</p><Progress value={isPro ? 100 : Math.min(100, (bidLeft / 10) * 100)} className="mt-3" /></div>
            <div className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">Profile slots</p><p className="mt-1 text-2xl font-bold">{isPro ? "Unlimited" : profLeft}</p><Progress value={isPro ? 100 : Math.min(100, (profLeft / 2) * 100)} className="mt-3" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className={cn(!isPro && "border-primary")}><CardContent className="p-5"><p className="font-semibold">Basic <span className="text-sm font-normal text-muted-foreground">· $0</span></p><ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">{["10 job bids included", "2 platform profiles", "All agents and sources"].map((f) => <li key={f} className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" />{f}</li>)}</ul></CardContent></Card>
            <Card className={cn(isPro && "border-primary")}><CardContent className="p-5"><p className="font-semibold">Pro <span className="text-sm font-normal text-muted-foreground">· $19/mo</span></p><ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">{["Unlimited bids and profiles", "Priority automation queue", "Every marketplace"].map((f) => <li key={f} className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" />{f}</li>)}</ul>{!isPro && <Button size="sm" variant="gradient" className="mt-4 w-full" onClick={() => setPaywall("bids")}><CreditCard className="size-4" /> See upgrade options</Button>}</CardContent></Card>
          </div>
          {!PAYMENTS_LIVE && <p className="text-xs text-muted-foreground">Online checkout isn&apos;t live yet, so upgrades are not available and nothing is charged.</p>}
        </TabsContent>
      </Tabs>

      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogHeader><DialogTitle>{txn.type === "income" ? "Add income" : "Add expense"}</DialogTitle><DialogDescription>Record it so your totals stay accurate.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveTxn(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="t-amt">Amount ($)</Label><Input id="t-amt" type="number" step="0.01" min="0" autoFocus value={txn.amount} onChange={(e) => setTxn({ ...txn, amount: e.target.value })} aria-invalid={!!txnErr.amount} />{txnErr.amount && <p role="alert" className="text-xs text-destructive">{txnErr.amount}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="t-date">Date</Label><Input id="t-date" type="date" value={txn.date} onChange={(e) => setTxn({ ...txn, date: e.target.value })} aria-invalid={!!txnErr.date} />{txnErr.date && <p role="alert" className="text-xs text-destructive">{txnErr.date}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="t-cat">Category</Label><Select id="t-cat" value={txn.category} onChange={(e) => setTxn({ ...txn, category: e.target.value })}>{(txn.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div className="space-y-1.5"><Label htmlFor="t-party">{txn.type === "income" ? "From (client)" : "Paid to"}</Label><Input id="t-party" value={txn.party} onChange={(e) => setTxn({ ...txn, party: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="t-note">Note (optional)</Label><Input id="t-note" value={txn.note} onChange={(e) => setTxn({ ...txn, note: e.target.value })} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setTxnOpen(false)}>Cancel</Button><Button type="submit" variant="gradient">Save</Button></DialogFooter>
        </form>
      </Dialog>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogHeader><DialogTitle>New invoice</DialogTitle><DialogDescription>You send it to your client yourself. Mark it paid here when you get the money.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveInv(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label htmlFor="i-client">Client</Label><Input id="i-client" autoFocus value={inv.client} onChange={(e) => setInv({ ...inv, client: e.target.value })} aria-invalid={!!invErr.client} />{invErr.client && <p role="alert" className="text-xs text-destructive">{invErr.client}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="i-amt">Amount ($)</Label><Input id="i-amt" type="number" step="0.01" min="0" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} aria-invalid={!!invErr.amount} />{invErr.amount && <p role="alert" className="text-xs text-destructive">{invErr.amount}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="i-email">Client email (optional)</Label><Input id="i-email" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} aria-invalid={!!invErr.email} />{invErr.email && <p role="alert" className="text-xs text-destructive">{invErr.email}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="i-issued">Issued</Label><Input id="i-issued" type="date" value={inv.issued} onChange={(e) => setInv({ ...inv, issued: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="i-due">Due</Label><Input id="i-due" type="date" value={inv.due} onChange={(e) => setInv({ ...inv, due: e.target.value })} aria-invalid={!!invErr.due} />{invErr.due && <p role="alert" className="text-xs text-destructive">{invErr.due}</p>}</div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="i-desc">Description</Label><Textarea id="i-desc" rows={3} value={inv.description} onChange={(e) => setInv({ ...inv, description: e.target.value })} placeholder="Landing page design, milestone 1" /></div>
          <div className="space-y-1.5"><Label htmlFor="i-status">Status</Label><Select id="i-status" value={inv.status} onChange={(e) => setInv({ ...inv, status: e.target.value })}><option>Sent</option><option>Draft</option></Select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setInvOpen(false)}>Cancel</Button><Button type="submit" variant="gradient">Create invoice</Button></DialogFooter>
        </form>
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogHeader><DialogTitle>Monthly income goal</DialogTitle><DialogDescription>How much do you want to earn each month?</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); const v = Number(goalVal); if (!Number.isFinite(v) || v < 0) return; L.setGoal(v); setGoalOpen(false); toast({ title: v ? "Goal saved" : "Goal cleared", variant: "success" }); }}>
          <Label htmlFor="goal">Goal ($ per month)</Label><Input id="goal" type="number" min="0" autoFocus className="mt-1.5" value={goalVal} onChange={(e) => setGoalVal(e.target.value)} />
          <DialogFooter className="mt-4"><Button type="button" variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button><Button type="submit" variant="gradient">Save</Button></DialogFooter>
        </form>
      </Dialog>

      <PaywallDialog open={!!paywall} onOpenChange={(v) => !v && setPaywall(null)} kind={paywall ?? "bids"} />
    </>
  );
}
