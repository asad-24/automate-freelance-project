"use client";
import * as React from "react";
import { useDemoStore } from "@/lib/demo-store";

/**
 * Money ledger: income, expenses and invoices the freelancer records.
 *
 * Stored inside the workspace (DemoState.ledger) by the demo store, so a
 * signed-in user's ledger is saved to their account on the server and the
 * frontend-only demo keeps it in this browser — same as every other workspace
 * collection. Nothing here moves money; it is a record the user keeps.
 */

export type Txn = { id: string; date: string; type: "income" | "expense"; amount: number; category: string; party: string; note: string; invoiceId?: string };
export type Invoice = { id: string; number: string; client: string; email: string; amount: number; issued: string; due: string; description: string; status: "Draft" | "Sent" | "Paid"; paidOn?: string };
export type LedgerState = { txns: Txn[]; invoices: Invoice[]; goal: number; seq: number };

// A ledger saved by the earlier browser-only build; moved into the workspace once.
const LEGACY_KEY = "autopilot-ledger-v1";
const EMPTY: LedgerState = { txns: [], invoices: [], goal: 0, seq: 1 };

export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const monthKey = (date: string) => date.slice(0, 7);
export const effectiveStatus = (i: Invoice): "Draft" | "Sent" | "Paid" | "Overdue" =>
  i.status === "Paid" ? "Paid" : i.status === "Sent" && i.due < todayStr() ? "Overdue" : i.status;

export const INCOME_CATEGORIES = ["Client work", "Platform payout", "Retainer", "Bonus", "Other income"];
export const EXPENSE_CATEGORIES = ["Software", "Platform fees", "Marketing", "Contractors", "Equipment", "Taxes", "Other expense"];

const normalize = (p: any): LedgerState => (p && typeof p === "object"
  ? { txns: Array.isArray(p.txns) ? p.txns : [], invoices: Array.isArray(p.invoices) ? p.invoices : [], goal: Number(p.goal) || 0, seq: Number(p.seq) || 1 }
  : EMPTY);

const uid = () => Math.random().toString(36).slice(2, 10);

export function useLedger() {
  const demo = useDemoStore();
  const state = normalize(demo?.state.ledger);
  const ready = !!demo?.hydrated;
  const update = demo?.updateLedger;

  // One-time move of a browser-only ledger into the workspace.
  React.useEffect(() => {
    if (!ready || !update || demo?.state.ledger) return;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      update(() => normalize(JSON.parse(raw)));
      localStorage.removeItem(LEGACY_KEY);
    } catch { /* storage blocked or corrupt — start empty */ }
  }, [ready, update, demo?.state.ledger]);

  const commit = React.useCallback((fn: (s: LedgerState) => LedgerState) => {
    update?.((current) => fn(normalize(current)));
  }, [update]);

  const addTxn = (t: Omit<Txn, "id">) => commit((s) => ({ ...s, txns: [{ ...t, id: uid() }, ...s.txns] }));
  const deleteTxn = (id: string) => commit((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== id) }));
  const setGoal = (goal: number) => commit((s) => ({ ...s, goal }));

  const addInvoice = (i: Omit<Invoice, "id" | "number" | "status"> & { status?: Invoice["status"] }) =>
    commit((s) => ({ ...s, seq: s.seq + 1, invoices: [{ ...i, status: i.status ?? "Sent", id: uid(), number: `INV-${String(s.seq).padStart(4, "0")}` }, ...s.invoices] }));
  const updateInvoice = (id: string, patch: Partial<Invoice>) => commit((s) => ({ ...s, invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const markPaid = (id: string, date = todayStr()) => commit((s) => {
    const inv = s.invoices.find((i) => i.id === id);
    if (!inv || inv.status === "Paid") return s;
    const txn: Txn = { id: uid(), date, type: "income", amount: inv.amount, category: "Client work", party: inv.client, note: `${inv.number} paid`, invoiceId: id };
    return { ...s, txns: [txn, ...s.txns], invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: "Paid", paidOn: date } : i)) };
  });
  const markUnpaid = (id: string) => commit((s) => ({ ...s, txns: s.txns.filter((t) => t.invoiceId !== id), invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: "Sent", paidOn: undefined } : i)) }));
  const deleteInvoice = (id: string) => commit((s) => ({ ...s, txns: s.txns.filter((t) => t.invoiceId !== id), invoices: s.invoices.filter((i) => i.id !== id) }));

  return { ...state, ready, addTxn, deleteTxn, setGoal, addInvoice, updateInvoice, markPaid, markUnpaid, deleteInvoice };
}

/** Last n months (oldest first) of income/expense totals. */
export function monthlySeries(txns: Txn[], n = 6) {
  const out: { key: string; label: string; income: number; expense: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: d.toLocaleString("en", { month: "short" }), income: 0, expense: 0 });
  }
  for (const t of txns) { const row = out.find((r) => r.key === monthKey(t.date)); if (row) row[t.type] += t.amount; }
  return out;
}

export function toCsv(txns: Txn[]) {
  // Quote every cell; prefix text that a spreadsheet would run as a formula.
  const esc = (v: string | number) => `"${(typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : String(v)).replace(/"/g, '""')}"`;
  return ["Date,Type,Amount,Category,Party,Note", ...txns.map((t) => [t.date, t.type, t.amount, t.category, t.party, t.note].map(esc).join(","))].join("\n");
}
