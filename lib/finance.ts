import { API_URL, apiFetch } from "@/lib/api";

export type FinanceEvent = {
  id: string;
  actor_id: string;
  action: string;
  note: string;
  at: string;
};
export type FinanceQuote = {
  rules_version: string;
  currency: string;
  advance_cap_minor: number;
  amount_minor: number;
  fee_minor: number;
  net_minor: number;
  settlement_minor: number;
  protection_fee_minor: number;
  coverage_minor: number;
};
export type FinanceRecord = {
  id: string;
  kind:
    | "verification"
    | "project"
    | "funding"
    | "protection"
    | "claim"
    | "offering";
  status: string;
  version: number;
  title: string;
  created_at: string;
  updated_at: string;
  entity_type?: "agency" | "freelancer" | "platform";
  platform?: string;
  reference?: string;
  evidence_url?: string;
  profile_url?: string;
  notes?: string;
  reason?: string;
  summary?: string;
  amount_minor?: number;
  target_minor?: number;
  minimum_minor?: number;
  committed_minor?: number;
  term_months?: number;
  due_date?: string;
  project_id?: string;
  protection_id?: string;
  quote?: FinanceQuote;
  events: FinanceEvent[];
  applicant_id?: string;
};
export type Offering = Pick<
  FinanceRecord,
  | "id"
  | "title"
  | "entity_type"
  | "summary"
  | "profile_url"
  | "status"
  | "version"
  | "created_at"
> & {
  target_minor: number;
  minimum_minor: number;
  committed_minor: number;
  remaining_minor: number;
  term_months: number;
  is_mine: boolean;
};
export type Commitment = {
  id: string;
  offering_id: string;
  title: string;
  entity_type: string;
  amount_minor: number;
  status: string;
  created_at: string;
};
export type FinanceOverview = {
  mode: "sandbox";
  money_movement_enabled: false;
  storage: "mongodb" | "memory";
  reviewer: boolean;
  records: FinanceRecord[];
  commitments: Commitment[];
  rules: {
    version: string;
    advance_cap_bps: number;
    advance_fee_bps: number;
    protection_fee_bps: number;
    coverage_cap_bps: number;
  };
  infrastructure: {
    chain: null;
    token_contract: null;
    custody_provider: null;
    capital_provider: null;
    token_issued: false;
  };
};

export const money = (minor: number = 0) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );

/** Parse decimal input exactly; never derive authoritative amounts using float rounding. */
export function minorUnits(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter a positive USD amount with up to two decimal places.",
    );
  const [whole, fraction = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100_000_000)
    throw new Error("Amount must be between $0.01 and $1,000,000.");
  return result;
}

export async function financeRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  if (!API_URL)
    throw new Error(
      "Connect the FastAPI backend to use funding and investment workflows.",
    );
  const response = await apiFetch(
    `/api/finance/${path}`,
    body === undefined
      ? undefined
      : { method: "POST", body: JSON.stringify(body) },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail
          .map(
            (item: { loc?: string[]; msg?: string }) =>
              `${item.loc?.slice(1).join(" ")}: ${item.msg}`,
          )
          .join(". ")
      : data.detail;
    throw new Error(
      detail || `Request failed (${response.status}). Please try again.`,
    );
  }
  return data as T;
}

export const reviewActions = (
  record: FinanceRecord,
): { value: string; label: string }[] => {
  if (record.status === "submitted")
    return [
      {
        value: "approve",
        label:
          record.kind === "offering"
            ? "Approve & open in sandbox"
            : "Approve in sandbox",
      },
      { value: "reject", label: "Reject with a reason" },
    ];
  if (record.kind === "funding" && record.status === "approved")
    return [{ value: "simulate_advance", label: "Record simulated advance" }];
  if (record.kind === "funding" && record.status === "simulated")
    return [{ value: "settle", label: "Record simulated settlement" }];
  if (record.kind === "protection" && record.status === "approved")
    return [{ value: "activate", label: "Activate sandbox protection" }];
  if (record.kind === "claim" && record.status === "approved")
    return [{ value: "simulate_payout", label: "Record simulated payout" }];
  if (record.kind === "offering" && record.status === "open")
    return [{ value: "close", label: "Close this sandbox listing" }];
  return [];
};
