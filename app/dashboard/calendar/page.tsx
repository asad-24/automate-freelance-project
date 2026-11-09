"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Download, Clock, CalendarDays, AlertCircle, Pencil, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useEntity } from "@/lib/use-entity";
import { useLedger, effectiveStatus } from "@/lib/ledger";
import { useDemoStore } from "@/lib/demo-store";
import { DEMO_MODE } from "@/lib/auth";
import { milestones as milestonesSeed, contracts as contractsSeed } from "@/lib/mock-data";
import { cn, formatCurrency } from "@/lib/utils";

type Kind = "meeting" | "deadline" | "interview" | "task" | "personal" | "invoice" | "milestone";
type CalEvent = { id: string; title: string; date: string; start: string; end: string; allDay: boolean; kind: Kind; notes: string; readonly?: boolean; amount?: number };

const KINDS: Record<Kind, { label: string; dot: string; chip: string }> = {
  meeting: { label: "Meetings", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/60 dark:border-sky-400/40" },
  deadline: { label: "Deadlines", dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/60 dark:border-rose-400/40" },
  interview: { label: "Interviews", dot: "bg-violet-400", chip: "bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/60 dark:border-violet-400/40" },
  task: { label: "Tasks", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/60 dark:border-amber-400/40" },
  personal: { label: "Personal", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/60 dark:border-emerald-400/40" },
  invoice: { label: "Invoices due", dot: "bg-orange-400", chip: "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/60 dark:border-orange-400/40" },
  milestone: { label: "Milestones", dot: "bg-fuchsia-400", chip: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-500/60 dark:border-fuchsia-400/40" },
};
const CUSTOM_KINDS: Kind[] = ["meeting", "deadline", "interview", "task", "personal"];
// Events live in the workspace (saved to the account when signed in). These
// browser keys held events from earlier builds and are migrated once.
const LEGACY_STORE = "autopilot-cal-v2";
const LEGACY_V1 = "autopilot-cal";
// Which layers are hidden is a per-viewer preference, so it stays in the browser.
const LAYERS = "autopilot-cal-layers";
const H0 = 6, H1 = 22, HPX = 48;
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n: number) => String(n).padStart(2, "0");
const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h < 12 ? "AM" : "PM"}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const longDate = (s: string) => parse(s).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });

const blank = (date: string): CalEvent => ({ id: "", title: "", date, start: "09:00", end: "10:00", allDay: false, kind: "meeting", notes: "" });

export default function CalendarPage() {
  const { toast } = useToast();
  const L = useLedger();
  const milestones = useEntity("milestones", milestonesSeed);
  const contracts = useEntity("contracts", contractsSeed);

  const demo = useDemoStore();
  const custom = (demo?.state.calendarEvents ?? []) as CalEvent[];
  const ready = !!demo?.hydrated;
  const updateEvents = demo?.updateCalendarEvents;
  const [hidden, setHidden] = React.useState<Kind[]>([]);
  const [view, setView] = React.useState<"month" | "week" | "day" | "agenda">("month");
  const [cursor, setCursor] = React.useState<Date>(() => new Date());
  const [selected, setSelected] = React.useState<string>(() => ds(new Date()));
  const [now, setNow] = React.useState<Date | null>(null);

  const [form, setForm] = React.useState<CalEvent | null>(null);
  const [isEdit, setIsEdit] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [info, setInfo] = React.useState<CalEvent | null>(null);

  React.useEffect(() => {
    try { const h = localStorage.getItem(LAYERS); if (h) setHidden(JSON.parse(h)); } catch { /* ignore corrupted storage */ }
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // One-time move of events saved in this browser by earlier builds.
  const hasEvents = (demo?.state.calendarEvents?.length ?? 0) > 0;
  React.useEffect(() => {
    if (!ready || !updateEvents || hasEvents) return;
    try {
      const v2 = JSON.parse(localStorage.getItem(LEGACY_STORE) ?? "[]");
      const v1 = JSON.parse(localStorage.getItem(LEGACY_V1) ?? "[]");
      const moved: CalEvent[] = Array.isArray(v2) && v2.length ? v2
        : Array.isArray(v1) ? v1.filter((o: any) => o?.date && o?.label).map((o: any) => ({ id: uid(), title: o.label, date: o.date, start: "09:00", end: "10:00", allDay: true, kind: "task" as Kind, notes: "" }))
        : [];
      if (moved.length) updateEvents(() => moved);
      localStorage.removeItem(LEGACY_STORE);
      localStorage.removeItem(LEGACY_V1);
    } catch { /* storage blocked or corrupt — nothing to move */ }
  }, [ready, updateEvents, hasEvents]);

  const persist = (next: CalEvent[]) => updateEvents?.(() => next);
  const toggleLayer = (k: Kind) => { const next = hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]; setHidden(next); try { localStorage.setItem(LAYERS, JSON.stringify(next)); } catch {} };

  // ---- all events (custom + automatic, read-only)
  const auto: CalEvent[] = [
    ...L.invoices.filter((i) => i.status !== "Paid" && i.due).map((i) => ({ id: `inv-${i.id}`, title: `${i.client} invoice due`, date: i.due, start: "09:00", end: "10:00", allDay: true, kind: "invoice" as Kind, notes: `${i.number}${effectiveStatus(i) === "Overdue" ? " · overdue" : ""}`, readonly: true, amount: i.amount })),
    ...milestones.map((m: any) => ({ id: `ms-${m.id}`, title: `${m.title}${m.contract ? ` · ${m.contract}` : ""}`, date: String(m.due ?? "").slice(0, 10), start: "09:00", end: "10:00", allDay: true, kind: "milestone" as Kind, notes: "", readonly: true, amount: m.amount })),
    ...contracts.map((c: any) => ({ id: `ct-${c.id}`, title: `Contract: ${c.title}`, date: String(c.due ?? c.endDate ?? "").slice(0, 10), start: "09:00", end: "10:00", allDay: true, kind: "milestone" as Kind, notes: "", readonly: true })),
  ].filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  const all = [...custom, ...auto].filter((e) => !hidden.includes(e.kind));
  const forDay = (d: string) => all.filter((e) => e.date === d).sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
  const today = ds(now ?? new Date());

  // ---- navigation
  const shift = (dir: -1 | 1) => {
    const c = new Date(cursor);
    if (view === "month" || view === "agenda") c.setMonth(c.getMonth() + dir, 1);
    else if (view === "week") c.setDate(c.getDate() + 7 * dir);
    else c.setDate(c.getDate() + dir);
    setCursor(c);
    if (view === "day") setSelected(ds(c));
  };
  const goToday = () => { const t = new Date(); setCursor(t); setSelected(ds(t)); };
  const weekStart = mondayOf(cursor);
  const title = view === "month" || view === "agenda"
    ? cursor.toLocaleDateString("en", { month: "long", year: "numeric" })
    : view === "week"
      ? `${weekStart.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`
      : cursor.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // ---- editing
  const openNew = (date: string, start?: string) => {
    const e = blank(date);
    if (start) { e.start = start; e.end = `${pad(Math.min(23, mins(start) / 60 + 1 | 0))}:${start.slice(3)}`; }
    setForm(e); setIsEdit(false); setErrors({}); setConfirmDel(false);
  };
  const openEvent = (e: CalEvent) => { if (e.readonly) { setInfo(e); return; } setForm({ ...e }); setIsEdit(true); setErrors({}); setConfirmDel(false); };
  const save = () => {
    if (!form) return;
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Give the event a title.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) e.date = "Pick a date.";
    if (!form.allDay) {
      if (!form.start) e.start = "Set a start time.";
      if (!form.end) e.end = "Set an end time.";
      else if (form.start && mins(form.end) <= mins(form.start)) e.end = "End must be after the start.";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const clean = { ...form, title: form.title.trim(), notes: form.notes.trim() };
    if (isEdit) persist(custom.map((x) => (x.id === clean.id ? clean : x)));
    else persist([...custom, { ...clean, id: uid() }]);
    toast({ title: isEdit ? "Event updated" : "Event added", variant: "success" });
    setSelected(clean.date);
    setForm(null);
  };
  const remove = () => { if (!form) return; persist(custom.filter((x) => x.id !== form.id)); setForm(null); toast({ title: "Event deleted" }); };

  const exportIcs = () => {
    const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Autopilot//Calendar//EN"];
    custom.forEach((e) => {
      const d = e.date.replace(/-/g, "");
      lines.push("BEGIN:VEVENT", `UID:${e.id}@autopilot`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `SUMMARY:${esc(e.title)}`);
      if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${ds(addDays(parse(e.date), 1)).replace(/-/g, "")}`);
      else lines.push(`DTSTART:${d}T${e.start.replace(":", "")}00`, `DTEND:${d}T${e.end.replace(":", "")}00`);
      if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" })); a.download = "autopilot-calendar.ics"; a.click(); URL.revokeObjectURL(a.href);
  };

  // ---- derived stats
  const monthKey = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
  const inMonth = all.filter((e) => e.date.startsWith(monthKey)).length;
  const upcoming = all.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.allDay ? "00:00" : a.start)).localeCompare(b.date + (b.allDay ? "00:00" : b.start))).slice(0, 8);
  const overdueInv = L.invoices.filter((i) => effectiveStatus(i) === "Overdue").length;

  // ---- renderers
  const Chip = ({ e, compact }: { e: CalEvent; compact?: boolean }) => (
    <button onClick={(ev) => { ev.stopPropagation(); openEvent(e); }} title={e.title}
      className={cn("flex w-full min-w-0 items-center gap-1 rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80", KINDS[e.kind].chip)}>
      {!compact && !e.allDay && <span className="shrink-0 opacity-70">{fmtTime(e.start).replace(":00", "").replace(" ", "").toLowerCase()}</span>}
      <span className="truncate">{e.title}</span>
    </button>
  );

  const monthCells = (() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    const count = Math.ceil(((first.getDay() + 6) % 7 + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  })();

  const MonthView = (
    <div>
      <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{DOW.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7" data-testid="month-grid">
        {monthCells.map((d) => {
          const k = ds(d); const evs = forDay(k); const out = d.getMonth() !== cursor.getMonth();
          return (
            <div key={k} role="button" tabIndex={0} aria-label={`${longDate(k)}, ${evs.length} events`} data-date={k}
              onClick={() => setSelected(k)} onDoubleClick={() => openNew(k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(k); } }}
              className={cn("min-h-[5.5rem] cursor-pointer border-b border-r p-1.5 transition-colors hover:bg-muted/40 max-md:min-h-14", out && "bg-muted/20 text-muted-foreground", selected === k && "bg-primary/[0.07] ring-1 ring-inset ring-primary/50")}>
              <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", k === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
              <div className="mt-1 hidden space-y-0.5 md:block">
                {evs.slice(0, 3).map((e) => <Chip key={e.id} e={e} />)}
                {evs.length > 3 && <button onClick={(ev) => { ev.stopPropagation(); setCursor(d); setSelected(k); setView("day"); }} className="px-1 text-[11px] text-muted-foreground hover:text-foreground">+{evs.length - 3} more</button>}
              </div>
              <div className="mt-1 flex flex-wrap gap-0.5 md:hidden">{evs.slice(0, 4).map((e) => <i key={e.id} className={cn("size-1.5 rounded-full", KINDS[e.kind].dot)} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // time grid (week = 7 columns, day = 1)
  const timeGrid = (days: Date[]) => {
    const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
    const nowMin = now ? now.getHours() * 60 + now.getMinutes() : -1;
    return (
      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length > 1 ? 720 : 0 }}>
          <div className="grid border-b" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => { const k = ds(d); const allday = forDay(k).filter((e) => e.allDay); return (
              <div key={k} className={cn("border-l p-1.5", k === today && "bg-primary/[0.06]")}>
                <button className="flex items-baseline gap-1.5" onClick={() => { setCursor(d); setSelected(k); setView("day"); }}>
                  <span className="text-[11px] uppercase text-muted-foreground">{DOW[(d.getDay() + 6) % 7]}</span>
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold", k === today && "bg-primary text-primary-foreground")}>{d.getDate()}</span>
                </button>
                <div className="mt-1 space-y-0.5">{allday.map((e) => <Chip key={e.id} e={e} compact />)}</div>
              </div>); })}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0,1fr))` }} data-testid="time-grid">
            <div>{hours.map((h) => <div key={h} style={{ height: HPX }} className="pr-2 text-right text-[10px] text-muted-foreground"><span className="relative -top-1.5">{fmtTime(`${pad(h)}:00`)}</span></div>)}</div>
            {days.map((d) => {
              const k = ds(d);
              const evs = forDay(k).filter((e) => !e.allDay);
              // lay out overlapping events side by side
              const cols: CalEvent[][] = [];
              const placed = evs.map((e) => { let c = cols.findIndex((col) => mins(col[col.length - 1].end) <= mins(e.start)); if (c < 0) { cols.push([]); c = cols.length - 1; } cols[c].push(e); return { e, c }; });
              return (
                <div key={k} className={cn("relative border-l", k === today && "bg-primary/[0.04]")} style={{ height: (H1 - H0) * HPX }}
                  onClick={(ev) => { const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); const m = Math.floor(((ev.clientY - r.top) / HPX + H0) * 2) * 30; openNew(k, `${pad(Math.min(22, Math.floor(m / 60)))}:${pad(m % 60)}`); }}>
                  {hours.map((h) => <div key={h} style={{ height: HPX }} className="border-b border-border/60" />)}
                  {placed.map(({ e, c }) => {
                    const top = Math.max(0, (mins(e.start) - H0 * 60) / 60) * HPX; const h = Math.max(22, ((mins(e.end) - mins(e.start)) / 60) * HPX - 2);
                    return (<div key={e.id} className="absolute px-0.5" style={{ top, height: h, left: `${(c / cols.length) * 100}%`, width: `${100 / cols.length}%` }}>
                      <button onClick={(ev) => { ev.stopPropagation(); openEvent(e); }} className={cn("h-full w-full overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] font-medium leading-tight hover:opacity-80", KINDS[e.kind].chip)}>
                        <span className="block truncate">{e.title}</span>{h > 34 && <span className="block truncate opacity-70">{fmtTime(e.start)} – {fmtTime(e.end)}</span>}
                      </button></div>);
                  })}
                  {k === today && nowMin >= H0 * 60 && nowMin <= H1 * 60 && <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - H0 * 60) / 60) * HPX }}><i className="-ml-1 size-2 rounded-full bg-destructive" /><div className="h-px flex-1 bg-destructive" /></div>}
                </div>);
            })}
          </div>
        </div>
      </div>
    );
  };

  const agendaDays = (() => {
    const m = all.filter((e) => e.date.startsWith(monthKey)).sort((a, b) => (a.date + (a.allDay ? "00:00" : a.start)).localeCompare(b.date + (b.allDay ? "00:00" : b.start)));
    return Array.from(new Set(m.map((e) => e.date))).map((d) => ({ d, evs: m.filter((e) => e.date === d) }));
  })();
  const EventRow = ({ e }: { e: CalEvent }) => (
    <button onClick={() => openEvent(e)} className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40">
      <i className={cn("h-9 w-1 shrink-0 rounded-full", KINDS[e.kind].dot)} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{e.allDay ? "All day" : `${fmtTime(e.start)} – ${fmtTime(e.end)}`} · {KINDS[e.kind].label.replace(/s$/, "")}{e.amount ? ` · ${formatCurrency(e.amount)}` : ""}</p></div>
      {e.readonly ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">auto</span> : <Pencil className="size-3.5 text-muted-foreground" />}
    </button>
  );
  const dayEvents = forDay(selected);

  return (
    <>
      <PageHeader title="Calendar" description="Your meetings, deadlines and interviews, plus invoice and milestone due dates pulled in automatically."
        actions={<>
          <Button variant="outline" disabled={custom.length === 0} onClick={exportIcs}><Download className="size-4" /> Export .ics</Button>
          <Button variant="gradient" onClick={() => openNew(selected)}><Plus className="size-4" /> New event</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">This month</p><p className="mt-1 text-2xl font-bold">{inMonth}</p><p className="text-[11px] text-muted-foreground">events in {cursor.toLocaleDateString("en", { month: "long" })}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Next up</p><p className="mt-1 truncate text-sm font-semibold">{upcoming[0] ? upcoming[0].title : "Nothing scheduled"}</p><p className="text-[11px] text-muted-foreground">{upcoming[0] ? `${parse(upcoming[0].date).toLocaleDateString("en", { month: "short", day: "numeric" })}${upcoming[0].allDay ? "" : ` · ${fmtTime(upcoming[0].start)}`}` : "Add an event to get started"}</p></div>
        <div className="col-span-2 rounded-xl border bg-card p-4 lg:col-span-1"><p className="text-xs text-muted-foreground">Overdue invoices</p><p className={cn("mt-1 text-2xl font-bold", overdueInv > 0 && "text-destructive")}>{overdueInv}</p><p className="text-[11px] text-muted-foreground">{overdueInv ? "follow up in Money" : "all caught up"}</p></div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3"><CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" className="size-8" aria-label="Previous" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
              <Button size="icon" variant="outline" className="size-8" aria-label="Next" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={goToday}>Today</Button>
              <h2 className="ml-2 text-base font-semibold" aria-live="polite" data-testid="cal-title">{title}</h2>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="View">
              {(["month", "week", "day", "agenda"] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => { setView(v); if (v === "day") setCursor(parse(selected)); }} className={cn("rounded-md px-3 py-1 text-xs font-medium capitalize", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>{v}</button>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b px-3 py-2" role="group" aria-label="Layers">
            {(Object.keys(KINDS) as Kind[]).map((k) => <button key={k} aria-pressed={!hidden.includes(k)} onClick={() => toggleLayer(k)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-opacity", hidden.includes(k) ? "opacity-40" : "")}><i className={cn("size-2 rounded-full", KINDS[k].dot)} />{KINDS[k].label}</button>)}
          </div>
          {!ready ? <div className="h-96" /> : view === "month" ? MonthView : view === "week" ? timeGrid(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))) : view === "day" ? timeGrid([cursor]) : (
            <div className="space-y-5 p-4" data-testid="agenda">
              {agendaDays.length === 0 ? <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground"><CalendarDays className="size-8 opacity-40" /><p>Nothing scheduled in {cursor.toLocaleDateString("en", { month: "long" })}.</p><Button size="sm" variant="outline" onClick={() => openNew(selected)}><Plus className="size-4" /> Add an event</Button></div>
                : agendaDays.map(({ d, evs }) => <div key={d}><p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", d === today ? "text-primary" : "text-muted-foreground")}>{longDate(d)}{d === today && " · Today"}</p><div className="space-y-2">{evs.map((e) => <EventRow key={e.id} e={e} />)}</div></div>)}
            </div>
          )}
        </CardContent></Card>

        <div className="space-y-4">
          <Card><CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{selected === today ? "Today" : longDate(selected)}</p><Button size="sm" variant="ghost" onClick={() => openNew(selected)}><Plus className="size-3.5" /> Add</Button></div>
            {dayEvents.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nothing on this day.</p> : <div className="space-y-2" data-testid="day-list">{dayEvents.map((e) => <EventRow key={e.id} e={e} />)}</div>}
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Upcoming</p>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming events.</p> : <ul className="space-y-2.5">{upcoming.map((e) => <li key={e.id}><button onClick={() => { setSelected(e.date); setCursor(parse(e.date)); }} className="flex w-full items-center gap-2.5 text-left"><i className={cn("size-2 shrink-0 rounded-full", KINDS[e.kind].dot)} /><span className="min-w-0 flex-1 truncate text-sm">{e.title}</span><span className="shrink-0 text-xs text-muted-foreground">{e.date === today ? "Today" : parse(e.date).toLocaleDateString("en", { month: "short", day: "numeric" })}</span></button></li>)}</ul>}
          </CardContent></Card>
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogHeader><DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle><DialogDescription>{DEMO_MODE ? "Saved in this browser." : "Saved to your account."}</DialogDescription></DialogHeader>
        {form && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="space-y-1.5"><Label htmlFor="ev-title">Title</Label><Input id="ev-title" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-invalid={!!errors.title} />{errors.title && <p role="alert" className="text-xs text-destructive">{errors.title}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="ev-date">Date</Label><Input id="ev-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-invalid={!!errors.date} />{errors.date && <p role="alert" className="text-xs text-destructive">{errors.date}</p>}</div>
              <div className="space-y-1.5"><Label htmlFor="ev-kind">Type</Label><Select id="ev-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>{CUSTOM_KINDS.map((k) => <option key={k} value={k}>{KINDS[k].label.replace(/s$/, "")}</option>)}</Select></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="size-4 rounded border" /> All day</label>
            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="ev-start">Start</Label><Input id="ev-start" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-invalid={!!errors.start} />{errors.start && <p role="alert" className="text-xs text-destructive">{errors.start}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="ev-end">End</Label><Input id="ev-end" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-invalid={!!errors.end} />{errors.end && <p role="alert" className="text-xs text-destructive">{errors.end}</p>}</div>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="ev-notes">Notes (optional)</Label><Textarea id="ev-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter className="items-center">
              {isEdit && (confirmDel ? <Button type="button" variant="destructive" className="mr-auto" onClick={remove}>Confirm delete</Button> : <Button type="button" variant="ghost" className="mr-auto text-muted-foreground" onClick={() => setConfirmDel(true)}><Trash2 className="size-4" /> Delete</Button>)}
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" variant="gradient">{isEdit ? "Save changes" : "Add event"}</Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      <Dialog open={!!info} onOpenChange={(o) => !o && setInfo(null)}>
        {info && (<>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><i className={cn("size-2.5 rounded-full", KINDS[info.kind].dot)} />{info.title}</DialogTitle><DialogDescription>{longDate(info.date)} · added automatically</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm">{info.amount ? <p className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{formatCurrency(info.amount)}</p> : null}{info.notes && <p className="flex items-center gap-2 text-muted-foreground"><StickyNote className="size-4" />{info.notes}</p>}<p className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="size-4" />This entry comes from {info.kind === "invoice" ? "Money → Invoices" : "your contracts"}. Change it there.</p></div>
          <DialogFooter><Button onClick={() => setInfo(null)}>Close</Button></DialogFooter>
        </>)}
      </Dialog>
    </>
  );
}
