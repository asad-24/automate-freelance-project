"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  ExternalLink,
  FileCheck2,
  FileText,
  FlaskConical,
  Layers3,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Commitment,
  FinanceOverview,
  FinanceRecord,
  Offering,
  financeRequest,
  minorUnits,
  money,
  reviewActions,
} from "@/lib/finance";

export type FinanceSection =
  | "funding"
  | "protection"
  | "investments"
  | "wallet";
type Action =
  | "verification"
  | "project"
  | "funding"
  | "protection"
  | "claim"
  | "offering"
  | "commit"
  | "review"
  | "detail";
type ModalState = {
  action: Action;
  record?: FinanceRecord;
  offering?: Offering;
  requestId: string;
};
type Form = Record<string, string>;

const NAV = [
  { id: "funding", label: "Project funding", icon: CircleDollarSign },
  { id: "protection", label: "Project protection", icon: ShieldCheck },
  { id: "investments", label: "Investments", icon: Layers3 },
  { id: "wallet", label: "Wallet & token", icon: Wallet },
] as const;
const STATUS: Record<string, string> = {
  submitted: "Awaiting review",
  approved: "Approved · sandbox",
  rejected: "Not approved",
  simulated: "Advance simulated",
  settled: "Settlement simulated",
  active: "Active · sandbox",
  paid_sandbox: "Payout simulated",
  open: "Open · sandbox",
  closed: "Closed",
};
const KINDS: Record<string, string> = {
  verification: "Profile review",
  project: "Project review",
  funding: "Funding",
  protection: "Protection",
  claim: "Claim",
  offering: "Investment listing",
};
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const initials = (value: string) =>
  value
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function Status({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
        value === "rejected"
          ? "bg-destructive/10 text-destructive"
          : ["submitted", "closed"].includes(value)
            ? "bg-muted text-muted-foreground"
            : "bg-success/10 text-success",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS[value] || value}
    </span>
  );
}

function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`finance-${name}`} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Native modal supplies focus trapping, Escape handling and focus restoration. */
function FinanceDialog({
  title,
  description,
  busy,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="finance-dialog-title"
      aria-describedby="finance-dialog-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <FlaskConical className="size-3.5" /> Sandbox workspace
            </p>
            <h2
              id="finance-dialog-title"
              className="text-xl font-semibold tracking-tight"
            >
              {title}
            </h2>
            <p
              id="finance-dialog-description"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Blank({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Wallet;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-5 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function FinanceWorkspace({ section }: { section: FinanceSection }) {
  const { user, restored } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const base = pathname.startsWith("/freelancer")
    ? "/freelancer"
    : pathname.startsWith("/client")
      ? "/client"
      : "/dashboard";
  const [data, setData] = React.useState<FinanceOverview | null>(null);
  const [offerings, setOfferings] = React.useState<Offering[]>([]);
  const [reviews, setReviews] = React.useState<FinanceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reviewMode, setReviewMode] = React.useState(false);
  const [category, setCategory] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState<ModalState | null>(null);
  const [form, setForm] = React.useState<Form>({});
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const requestGeneration = React.useRef(0);
  const userId = user?.id;
  const invalidate = React.useCallback(() => {
    requestGeneration.current++;
  }, []);

  const load = React.useCallback(async () => {
    const generation = ++requestGeneration.current;
    setError("");
    setLoading(true);
    try {
      const overview = await financeRequest<FinanceOverview>("overview");
      const [market, review] = await Promise.all([
        financeRequest<{ offerings: Offering[] }>("marketplace"),
        overview.reviewer
          ? financeRequest<{ records: FinanceRecord[] }>("reviews")
          : Promise.resolve({ records: [] }),
      ]);
      if (generation !== requestGeneration.current) return;
      setData(overview);
      setOfferings(market.offerings);
      setReviews(review.records);
    } catch (e) {
      if (generation === requestGeneration.current)
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't load this workspace. Please try again.",
        );
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setData(null);
    setReviews([]);
    setOfferings([]);
    setReviewMode(false);
    setModal(null);
    if (restored && userId) void load();
    return invalidate;
  }, [restored, userId, load, invalidate]);

  const records = data?.records || [];
  const profiles = records.filter((r) => r.kind === "verification");
  const verified = profiles.some((r) => r.status === "approved");
  const projects = records.filter((r) => r.kind === "project");
  const eligible = projects.filter(
    (r) =>
      r.status === "approved" &&
      (r.due_date || "") >= new Date().toLocaleDateString("en-CA"),
  );
  const fundings = records.filter((r) => r.kind === "funding");
  const protections = records.filter((r) => r.kind === "protection");
  const claims = records.filter((r) => r.kind === "claim");
  const myOfferings = records.filter((r) => r.kind === "offering");
  const commitments = data?.commitments || [];
  const canApply = user?.role === "admin" || user?.role === "freelancer";

  function open(action: Action, record?: FinanceRecord, offering?: Offering) {
    setFormError("");
    setAcknowledged(false);
    const available = eligible.filter((p) =>
      action === "funding"
        ? !fundings.some((f) => f.project_id === p.id)
        : !protections.some((f) => f.project_id === p.id),
    );
    setForm({
      title: "",
      notes: "",
      entity_type:
        profiles.find((p) => p.status === "approved")?.entity_type ||
        "freelancer",
      platform: "Upwork",
      reference: "",
      evidence_url: "",
      profile_url: "",
      amount: "",
      due_date: "",
      project_id: available[0]?.id || "",
      protection_id:
        record?.id ||
        protections.find(
          (p) =>
            p.status === "active" &&
            !claims.some((c) => c.protection_id === p.id),
        )?.id ||
        "",
      reason: "",
      summary: "",
      target: "",
      minimum: "10",
      term_months: "6",
      review_action: record ? reviewActions(record)[0]?.value || "" : "",
      review_note: "",
    });
    setModal({ action, record, offering, requestId: crypto.randomUUID() });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || busy) return;
    setFormError("");
    if (modal.action !== "review" && !acknowledged) {
      setFormError(
        "Confirm that this is a sandbox request with no real funds involved.",
      );
      return;
    }
    setBusy(true);
    try {
      const shared = {
        request_id: modal.requestId,
        acknowledged_sandbox: true,
      };
      let endpoint = "",
        body: object = {};
      switch (modal.action) {
        case "verification":
          endpoint = "verifications";
          body = {
            ...shared,
            title: form.title,
            entity_type: form.entity_type,
            profile_url: form.profile_url,
            notes: form.notes,
          };
          break;
        case "project":
          endpoint = "projects";
          body = {
            ...shared,
            title: form.title,
            platform: form.platform,
            reference: form.reference,
            evidence_url: form.evidence_url,
            amount_minor: minorUnits(form.amount),
            due_date: form.due_date,
            notes: form.notes,
          };
          break;
        case "funding":
          endpoint = "funding";
          body = {
            ...shared,
            project_id: form.project_id,
            amount_minor: minorUnits(form.amount),
          };
          break;
        case "protection":
          endpoint = "protection";
          body = { ...shared, project_id: form.project_id };
          break;
        case "claim":
          endpoint = "claims";
          body = {
            ...shared,
            protection_id: form.protection_id,
            amount_minor: minorUnits(form.amount),
            reason: form.reason,
            evidence_url: form.evidence_url,
          };
          break;
        case "offering":
          endpoint = "offerings";
          body = {
            ...shared,
            title: form.title,
            entity_type: form.entity_type,
            summary: form.summary,
            target_minor: minorUnits(form.target),
            minimum_minor: minorUnits(form.minimum),
            profile_url: form.profile_url,
            term_months: Number(form.term_months),
          };
          break;
        case "commit":
          endpoint = `offerings/${modal.offering?.id}/commitments`;
          body = { ...shared, amount_minor: minorUnits(form.amount) };
          break;
        case "review":
          endpoint = `reviews/${modal.record?.id}`;
          body = {
            version: modal.record?.version,
            action: form.review_action,
            note: form.review_note,
          };
          break;
        default:
          return;
      }
      await financeRequest(endpoint, body);
      setModal(null);
      toast({
        title:
          modal.action === "review"
            ? "Sandbox decision recorded"
            : modal.action === "commit"
              ? "Sandbox commitment recorded"
              : "Request saved for sandbox review",
        description: "No real funds were transferred.",
        variant: "success",
      });
      await load();
    } catch (e) {
      setFormError(
        e instanceof Error
          ? e.message
          : "Request failed. Retry with this form to avoid duplicates.",
      );
    } finally {
      setBusy(false);
    }
  }

  const field = (
    name: string,
    label: string,
    options: {
      type?: string;
      hint?: string;
      minLength?: number;
      maxLength?: number;
      placeholder?: string;
    } = {},
  ) => (
    <Field name={name} label={label} hint={options.hint}>
      <Input
        id={`finance-${name}`}
        value={form[name] || ""}
        onChange={(e) => setForm((s) => ({ ...s, [name]: e.target.value }))}
        type={options.type || "text"}
        required
        minLength={options.minLength}
        maxLength={options.maxLength || 200}
        placeholder={options.placeholder}
        min={options.type === "number" ? "0.01" : undefined}
        step={options.type === "number" ? "0.01" : undefined}
        disabled={busy}
      />
    </Field>
  );
  const area = (name: string, label: string, min: number, hint?: string) => (
    <Field name={name} label={label} hint={hint}>
      <Textarea
        id={`finance-${name}`}
        rows={4}
        minLength={min}
        maxLength={2000}
        required
        value={form[name] || ""}
        onChange={(e) => setForm((s) => ({ ...s, [name]: e.target.value }))}
        disabled={busy}
      />
    </Field>
  );
  const select = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Field name={name} label={label}>
      <Select
        id={`finance-${name}`}
        value={form[name] || ""}
        onChange={(e) => setForm((s) => ({ ...s, [name]: e.target.value }))}
        required
        disabled={busy}
      >
        <option value="" disabled>
          Select an option
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );

  const requests = (
    items: FinanceRecord[],
    empty: string,
    description: string,
  ) =>
    items.length ? (
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((r) => (
          <button
            key={r.id}
            onClick={() => open("detail", r)}
            className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-muted/60 sm:p-5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {r.kind === "protection" || r.kind === "claim" ? (
                <ShieldCheck className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {KINDS[r.kind]} · {dateLabel(r.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-sm font-semibold">
                {r.kind === "protection"
                  ? money(r.quote?.coverage_minor)
                  : r.amount_minor
                    ? money(r.amount_minor)
                    : r.target_minor
                      ? money(r.target_minor)
                      : ""}
              </p>
              <Status value={r.status} />
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    ) : (
      <Blank icon={FileText} title={empty} description={description} />
    );

  const needsProfile = (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <FileCheck2 className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">Start with a profile review</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Share a public work profile and a short description. A separate
            reviewer checks it before projects and listings can enter the
            sandbox.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => open("verification")}
          >
            <Plus />
            Submit profile for review
          </Button>
        </div>
      </div>
      {profiles.length > 0 && (
        <div className="mt-5 space-y-2 border-t pt-4">
          {profiles.map((p) => (
            <button
              className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm"
              key={p.id}
              onClick={() => open("detail", p)}
            >
              <span>{p.title}</span>
              <Status value={p.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const titles: Record<
    FinanceSection,
    { eyebrow: string; title: string; accent: string; description: string }
  > = {
    funding: {
      eyebrow: "CAPITAL FOR YOUR CRAFT",
      title: "Your work. ",
      accent: "A head start.",
      description:
        "Explore upfront project funding, from review to settlement, in one clear workspace.",
    },
    protection: {
      eyebrow: "BUILD WITH A BACKUP PLAN",
      title: "A little more ",
      accent: "peace of mind.",
      description:
        "Explore project protection and follow every application, decision, and claim.",
    },
    investments: {
      eyebrow: "BACK THE BUILDERS",
      title: "Big ideas start ",
      accent: "with people.",
      description:
        "Discover agency, freelancer, and platform opportunities in the sandbox marketplace.",
    },
    wallet: {
      eyebrow: "YOUR CAPITAL, CONNECTED",
      title: "A home for ",
      accent: "what comes next.",
      description:
        "The future wallet and platform token, with a clear view of what still needs to be configured.",
    },
  };
  const copy = titles[section];
  const visibleOfferings = offerings.filter(
    (o) =>
      (category === "all" || o.entity_type === category) &&
      `${o.title} ${o.summary}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedProject = projects.find((p) => p.id === form.project_id);
  const selectedProtection = protections.find(
    (p) => p.id === form.protection_id,
  );
  const pendingReviews = reviews.filter((r) => reviewActions(r).length > 0);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
          <span className="size-2 rounded-full bg-amber-500" />
          Capital sandbox
        </span>
        <div className="flex gap-2">
          {data?.reviewer && (
            <Button
              variant={reviewMode ? "default" : "outline"}
              size="sm"
              onClick={() => setReviewMode((v) => !v)}
            >
              <FileCheck2 />
              {reviewMode
                ? "Back to workspace"
                : `Reviewer console (${pendingReviews.length})`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || !user}
            aria-label="Refresh finance workspace"
          >
            <RefreshCw className={cn(loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-32 size-96 rounded-full bg-primary/[0.07] blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-3 text-[10px] font-bold tracking-[0.22em] text-primary">
              {reviewMode ? "DECISIONS WITH A RECORD" : copy.eyebrow}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {reviewMode ? (
                "Sandbox review console"
              ) : (
                <>
                  {copy.title}
                  <span className="text-primary">{copy.accent}</span>
                </>
              )}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {reviewMode
                ? "Review evidence, record a reason, and move each case forward. Your own submissions require another reviewer."
                : copy.description}
            </p>
          </div>
          <span className="hidden size-20 shrink-0 items-center justify-center rounded-3xl border border-primary/15 bg-primary/5 text-primary sm:flex">
            {section === "investments" ? (
              <Layers3 className="size-9" strokeWidth={1.4} />
            ) : section === "protection" ? (
              <ShieldCheck className="size-9" strokeWidth={1.4} />
            ) : section === "wallet" ? (
              <Wallet className="size-9" strokeWidth={1.4} />
            ) : (
              <CircleDollarSign className="size-9" strokeWidth={1.4} />
            )}
          </span>
        </div>
        <div className="relative mt-6 flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <FlaskConical className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Sandbox only.</strong> No real funds, token purchases,
            premiums, returns, or payouts. Fee previews do not collect payments.
            Sandbox reviews are not identity verification or insurance coverage.
          </p>
        </div>
      </section>

      <nav
        aria-label="Capital workspace"
        className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5"
      >
        {NAV.filter(
          (n) => base !== "/client" || ["investments", "wallet"].includes(n.id),
        ).map((n) => (
          <Link
            key={n.id}
            href={`${base}/${n.id}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
              section === n.id && !reviewMode
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-current={section === n.id && !reviewMode ? "page" : undefined}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        ))}
      </nav>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Workspace could not refresh</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button
              variant="link"
              className="h-auto px-0 py-2"
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        </div>
      )}
      {data?.storage === "memory" && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Clock3 className="size-3.5 shrink-0" />
          This local sandbox uses temporary memory. Records will be lost when
          the API restarts; MongoDB is required to retain them.
        </p>
      )}
      {loading && !data ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <Loader2 className="size-5 animate-spin" />
          Loading your capital workspace…
        </div>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "Reviewed projects",
                  value: projects
                    .filter((r) => r.status === "approved")
                    .length.toString(),
                  note: "sandbox approvals",
                  icon: Briefcase,
                },
                {
                  label: "Funding requested",
                  value: money(
                    fundings.reduce((n, r) => n + (r.amount_minor || 0), 0),
                  ),
                  note: "illustrative USD",
                  icon: CircleDollarSign,
                },
                {
                  label: "Protection active",
                  value: protections
                    .filter((r) => r.status === "active")
                    .length.toString(),
                  note: "sandbox policies",
                  icon: ShieldCheck,
                },
                {
                  label: "Your commitments",
                  value: money(
                    commitments.reduce((n, c) => n + c.amount_minor, 0),
                  ),
                  note: "no money transferred",
                  icon: Layers3,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border bg-card p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground sm:text-xs">
                      {s.label}
                    </p>
                    <s.icon className="size-4 text-primary" />
                  </div>
                  <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                    {s.value}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    {s.note}
                  </p>
                </div>
              ))}
            </div>

            {reviewMode ? (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Review queue</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Only explicitly provisioned owners can decide cases. Open
                    the record to inspect its history.
                  </p>
                </div>
                {reviews.length ? (
                  <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {reviews.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center gap-3 p-4 sm:p-5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{r.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {KINDS[r.kind]} · Applicant {r.applicant_id} · v
                            {r.version}
                          </p>
                        </div>
                        <Status value={r.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open("detail", r)}
                        >
                          Details
                        </Button>
                        {reviewActions(r).length > 0 && (
                          <Button
                            size="sm"
                            disabled={r.applicant_id === user?.id}
                            onClick={() => open("review", r)}
                          >
                            Review
                            <ArrowRight />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Blank
                    icon={FileCheck2}
                    title="The queue is clear"
                    description="New profile, project, funding, protection, claim and listing requests will appear here."
                  />
                )}
              </section>
            ) : (
              <>
                {section === "funding" && (
                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-6">
                      {!verified && canApply && needsProfile}
                      <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold">
                              Your projects
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Add evidence of an awarded project before
                              requesting capital.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!verified}
                            onClick={() => open("project")}
                          >
                            <Plus />
                            Add project
                          </Button>
                        </div>
                        {requests(
                          projects,
                          "Your next project starts here",
                          "Once your profile passes sandbox review, add a project from Fiverr, Upwork, or another platform.",
                        )}
                      </section>
                      <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold">
                              Funding requests
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              A clear record from request through simulated
                              settlement.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={
                              !eligible.some(
                                (p) =>
                                  !fundings.some((f) => f.project_id === p.id),
                              )
                            }
                            onClick={() => open("funding")}
                          >
                            <Plus />
                            Request funding
                          </Button>
                        </div>
                        {requests(
                          fundings,
                          "No funding requests yet",
                          "A reviewed project unlocks a sandbox advance request. You'll see the calculated fee and net advance before submitting.",
                        )}
                      </section>
                    </div>
                    <aside className="space-y-4">
                      <div className="rounded-2xl border bg-card p-5">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="size-4 text-primary" />
                          How the sandbox works
                        </p>
                        <ol className="mt-5 space-y-5">
                          {[
                            {
                              title: "Review your profile",
                              text: "Share your public profile with an independent reviewer.",
                              done: verified,
                            },
                            {
                              title: "Add an awarded project",
                              text: "Provide its reference, value, due date and evidence.",
                              done: eligible.length > 0,
                            },
                            {
                              title: "Request an advance",
                              text: "Review the sandbox terms and follow the decision.",
                              done: fundings.length > 0,
                            },
                          ].map((s, i) => (
                            <li key={s.title} className="flex gap-3">
                              <span
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                                  s.done
                                    ? "bg-success/10 text-success"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {s.done ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <div>
                                <p className="text-sm font-medium">{s.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {s.text}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <Rules data={data} />
                      <div className="rounded-2xl border bg-primary/5 p-5">
                        <ShieldCheck className="mb-3 size-5 text-primary" />
                        <h3 className="text-sm font-semibold">
                          Explore a backup plan
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          See how project protection and evidence-based claims
                          could work alongside funding.
                        </p>
                        <Button
                          asChild
                          size="sm"
                          variant="link"
                          className="mt-3 h-auto px-0"
                        >
                          <Link href={`${base}/protection`}>
                            Explore protection
                            <ArrowRight />
                          </Link>
                        </Button>
                      </div>
                    </aside>
                  </div>
                )}

                {section === "protection" && (
                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="space-y-6">
                      <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold">
                              Your project protection
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Apply after your project passes sandbox review.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            disabled={
                              !eligible.some(
                                (p) =>
                                  !protections.some(
                                    (f) => f.project_id === p.id,
                                  ),
                              )
                            }
                            onClick={() => open("protection")}
                          >
                            <Plus />
                            Apply for protection
                          </Button>
                        </div>
                        {requests(
                          protections,
                          "A backup plan begins with a reviewed project",
                          "Add and review a project in Project funding, then apply for sandbox protection. No premium is charged or coverage promised.",
                        )}
                        {!eligible.length && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`${base}/funding`}>
                              Go to your projects
                              <ArrowRight />
                            </Link>
                          </Button>
                        )}
                      </section>
                      <section className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold">Claims</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Every claim has evidence, a decision, and a
                              history.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              !protections.some(
                                (p) =>
                                  p.status === "active" &&
                                  !claims.some((c) => c.protection_id === p.id),
                              )
                            }
                            onClick={() => open("claim")}
                          >
                            <Plus />
                            Submit a claim
                          </Button>
                        </div>
                        {requests(
                          claims,
                          "No claims submitted",
                          "When sandbox protection is active, you can submit one claim with supporting evidence for review.",
                        )}
                      </section>
                    </div>
                    <aside className="space-y-4">
                      <Rules data={data} />
                      <div className="rounded-2xl border bg-card p-5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <LockKeyhole className="size-4 text-primary" />
                          Before real coverage
                        </h3>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          The founder must approve covered events, exclusions,
                          deductibles, claims rules, and a funded reserve. Token
                          issuance does not create payout capacity.
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          These sandbox steps are a workflow preview, not an
                          insurance policy or a guarantee.
                        </p>
                      </div>
                    </aside>
                  </div>
                )}

                {section === "investments" && (
                  <div className="space-y-7">
                    <section className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">
                            Discover opportunities
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Reviewed sandbox listings. No promised returns or
                            ownership rights.
                          </p>
                        </div>
                        {canApply && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!verified && !data.reviewer}
                            onClick={() => open("offering")}
                          >
                            <Plus />
                            Create listing
                          </Button>
                        )}
                      </div>
                      {!verified && canApply && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-primary/5 p-4">
                          <p className="text-sm text-muted-foreground">
                            Want to list your work? Start with a sandbox profile
                            review.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => open("verification")}
                          >
                            Submit profile
                            <ArrowRight />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          role="group"
                          aria-label="Opportunity category"
                          className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1"
                        >
                          {[
                            { id: "all", label: "All" },
                            { id: "agency", label: "Agencies" },
                            { id: "freelancer", label: "People" },
                            { id: "platform", label: "Platform" },
                          ].map((c) => (
                            <button
                              key={c.id}
                              aria-pressed={category === c.id}
                              onClick={() => setCategory(c.id)}
                              className={cn(
                                "shrink-0 rounded-lg px-3 py-2 text-xs font-medium",
                                category === c.id
                                  ? "bg-card text-foreground shadow-sm"
                                  : "text-muted-foreground",
                              )}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                        <div className="relative min-w-0 flex-1 sm:max-w-xs">
                          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                          <Input
                            aria-label="Search investment opportunities"
                            placeholder="Search opportunities…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9 pl-9"
                          />
                        </div>
                      </div>
                      {visibleOfferings.length ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {visibleOfferings.map((o) => (
                            <article
                              key={o.id}
                              className="flex flex-col rounded-2xl border bg-card p-5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                                  {initials(o.title)}
                                </span>
                                <span className="flex items-center gap-1 text-xs capitalize text-muted-foreground">
                                  {o.entity_type === "agency" ? (
                                    <Building2 className="size-3.5" />
                                  ) : o.entity_type === "platform" ? (
                                    <Coins className="size-3.5" />
                                  ) : (
                                    <Users className="size-3.5" />
                                  )}
                                  {o.entity_type}
                                </span>
                              </div>
                              <h3 className="mt-4 font-semibold">{o.title}</h3>
                              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                                {o.summary}
                              </p>
                              <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4">
                                <div>
                                  <p className="text-[10px] text-muted-foreground">
                                    Sandbox target
                                  </p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {money(o.target_minor)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground">
                                    Minimum commitment
                                  </p>
                                  <p className="mt-1 text-sm font-semibold">
                                    {money(o.minimum_minor)}
                                  </p>
                                </div>
                              </div>
                              <div
                                role="progressbar"
                                aria-label={`${o.title} sandbox commitments`}
                                aria-valuenow={o.committed_minor}
                                aria-valuemin={0}
                                aria-valuemax={o.target_minor}
                                className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
                              >
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.min(100, (100 * o.committed_minor) / o.target_minor)}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {money(o.committed_minor)} committed in sandbox
                                · {o.term_months} months illustrative term
                              </p>
                              <div className="mt-5 flex flex-1 items-end justify-between gap-2">
                                <a
                                  href={o.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary"
                                >
                                  Public profile
                                  <ExternalLink className="size-3" />
                                </a>
                                <Button
                                  size="sm"
                                  disabled={
                                    o.is_mine ||
                                    o.remaining_minor < o.minimum_minor
                                  }
                                  onClick={() => open("commit", undefined, o)}
                                >
                                  {o.is_mine
                                    ? "Your listing"
                                    : o.remaining_minor < o.minimum_minor
                                      ? "Target filled"
                                      : "Explore & commit"}
                                  {!o.is_mine && <ArrowUpRight />}
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <Blank
                          icon={Layers3}
                          title={
                            search || category !== "all"
                              ? "No matching opportunities"
                              : "Room for the next great idea"
                          }
                          description="Approved sandbox agency, freelancer, and platform listings will appear here. No fabricated businesses or performance figures are shown."
                        />
                      )}
                    </section>
                    <section className="space-y-4">
                      <h2 className="text-lg font-semibold">
                        Your sandbox portfolio
                      </h2>
                      {commitments.length ? (
                        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                          {commitments.map((c: Commitment) => (
                            <div
                              key={`${c.offering_id}:${c.id}`}
                              className="flex items-center justify-between gap-3 p-5"
                            >
                              <div>
                                <p className="text-sm font-medium">{c.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {dateLabel(c.created_at)} · No ownership or
                                  return entitlement
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">
                                  {money(c.amount_minor)}
                                </p>
                                <p className="mt-1 text-[11px] text-primary">
                                  Sandbox commitment
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Blank
                          icon={Briefcase}
                          title="Your portfolio is a clean slate"
                          description="Sandbox commitments will appear here. They don't charge a wallet, issue tokens, or earn returns."
                        />
                      )}
                    </section>
                    {myOfferings.length > 0 && (
                      <section className="space-y-4">
                        <h2 className="text-lg font-semibold">Your listings</h2>
                        {requests(myOfferings, "", "")}
                      </section>
                    )}
                  </div>
                )}

                {section === "wallet" && (
                  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-6">
                      <section className="rounded-2xl border bg-card p-6 sm:p-8">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                          <LockKeyhole className="size-3" />
                          Not connected
                        </span>
                        <div className="mt-6 flex items-center gap-4">
                          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Wallet className="size-7" />
                          </span>
                          <div>
                            <h2 className="text-lg font-semibold">
                              A wallet with clear boundaries
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              No address linked. No on-chain balance available.
                            </p>
                          </div>
                        </div>
                        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                          Wallet connection opens once the blockchain, custody
                          model, and provider have been selected. This workspace
                          cannot request signatures, access keys, or send
                          transactions.
                        </p>
                        <Button className="mt-6" disabled>
                          <LockKeyhole />
                          Wallet setup pending
                        </Button>
                      </section>
                      <section className="space-y-4">
                        <h2 className="text-lg font-semibold">
                          On-chain transactions
                        </h2>
                        <Blank
                          icon={ArrowDownLeft}
                          title="No on-chain activity"
                          description="Verified chain transactions will appear here after an integration exists. Sandbox applications and commitments are kept in their own workflows."
                        />
                      </section>
                    </div>
                    <aside className="space-y-4">
                      <div className="rounded-2xl border bg-card p-5">
                        <div className="flex items-center gap-3">
                          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                            <Coins className="size-5" />
                          </span>
                          <h3 className="font-semibold">Platform token</h3>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                          No token has been issued. No contract, price, supply,
                          balance, or investment rights have been configured.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-5 w-full"
                          disabled
                        >
                          Token purchases unavailable
                        </Button>
                      </div>
                      <div className="rounded-2xl border bg-card p-5">
                        <h3 className="text-sm font-semibold">
                          Decisions before activation
                        </h3>
                        <ul className="mt-4 space-y-4">
                          {[
                            "Blockchain and supported assets",
                            "Token contract and holder rights",
                            "Wallet provider and custody",
                            "Advance capital and claims reserves",
                          ].map((item) => (
                            <li
                              key={item}
                              className="flex gap-2.5 text-xs text-muted-foreground"
                            >
                              <span className="mt-0.5 size-3 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </aside>
                  </div>
                )}
              </>
            )}
          </>
        )
      )}

      {modal && (
        <FinanceDialog
          title={
            {
              verification: "Submit your profile",
              project: "Add a project",
              funding: "Request a project advance",
              protection: "Apply for project protection",
              claim: "Submit a sandbox claim",
              offering: "Create an investment listing",
              commit: "Explore a sandbox commitment",
              review: "Record a review decision",
              detail: modal.record?.title || "Request details",
            }[modal.action]
          }
          description={
            modal.action === "detail"
              ? "A timestamped record of this sandbox case and its decisions."
              : modal.action === "review"
                ? "Review the evidence below. Your decision is recorded with your account and cannot overwrite another review."
                : "Amounts are illustrative USD. This action is saved to the backend and never moves real funds."
          }
          busy={busy}
          onClose={() => setModal(null)}
        >
          {modal.action === "detail" ? (
            <RecordDetails record={modal.record!} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {modal.action === "verification" && (
                <>
                  {field("title", "Your professional or agency name", {
                    minLength: 3,
                    maxLength: 120,
                  })}
                  {select("entity_type", "Profile type", [
                    { value: "freelancer", label: "Individual freelancer" },
                    { value: "agency", label: "Agency" },
                  ])}
                  {field("profile_url", "Public work profile (HTTPS)", {
                    type: "url",
                    maxLength: 1000,
                    hint: "A portfolio or marketplace profile you control. Don't include passwords or private identity documents.",
                  })}
                  {area(
                    "notes",
                    "Tell the reviewer about your work",
                    20,
                    "Minimum 20 characters. This is a sandbox professional review, not KYC.",
                  )}
                </>
              )}
              {modal.action === "project" && (
                <>
                  {field("title", "Project name", {
                    minLength: 3,
                    maxLength: 120,
                  })}
                  {select(
                    "platform",
                    "Project platform",
                    [
                      "Upwork",
                      "Fiverr",
                      "Freelancer.com",
                      "Direct",
                      "Other",
                    ].map((x) => ({ value: x, label: x })),
                  )}
                  {field("reference", "Contract or order reference", {
                    minLength: 3,
                    maxLength: 160,
                  })}
                  <div className="grid grid-cols-2 gap-3">
                    {field("amount", "Project value (USD)", { type: "number" })}
                    {field("due_date", "Delivery due date", { type: "date" })}
                  </div>
                  {field("evidence_url", "Project evidence (HTTPS)", {
                    type: "url",
                    maxLength: 1000,
                    hint: "Use a link the reviewer can access. No external marketplace access is implied.",
                  })}
                  {area("notes", "Project scope and award evidence", 20)}
                </>
              )}
              {(modal.action === "funding" ||
                modal.action === "protection") && (
                <>
                  {select(
                    "project_id",
                    "Reviewed project",
                    eligible
                      .filter((p) =>
                        modal.action === "funding"
                          ? !fundings.some((f) => f.project_id === p.id)
                          : !protections.some((f) => f.project_id === p.id),
                      )
                      .map((p) => ({
                        value: p.id,
                        label: `${p.title} · ${money(p.amount_minor)}`,
                      })),
                  )}
                  {modal.action === "funding" &&
                    field("amount", "Requested advance (USD)", {
                      type: "number",
                      hint: selectedProject
                        ? `Up to ${money(selectedProject.quote?.advance_cap_minor)} under illustrative terms.`
                        : "Select an approved sandbox project.",
                    })}
                  {selectedProject?.quote && (
                    <QuotePreview
                      project={selectedProject}
                      amount={form.amount}
                      funding={modal.action === "funding"}
                      feeBps={data?.rules.advance_fee_bps || 0}
                    />
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    An independent reviewer decides this application. A
                    simulated approval does not reserve real capital or create
                    coverage.
                  </p>
                </>
              )}
              {modal.action === "claim" && (
                <>
                  {select(
                    "protection_id",
                    "Active sandbox protection",
                    protections
                      .filter(
                        (p) =>
                          p.status === "active" &&
                          !claims.some((c) => c.protection_id === p.id),
                      )
                      .map((p) => ({ value: p.id, label: p.title })),
                  )}
                  {field("amount", "Claim amount (USD)", {
                    type: "number",
                    hint: selectedProtection
                      ? `Illustrative limit: ${money(selectedProtection.quote?.coverage_minor)}.`
                      : undefined,
                  })}
                  {area(
                    "reason",
                    "What happened?",
                    30,
                    "Explain the event and the amount requested. Minimum 30 characters.",
                  )}
                  {field("evidence_url", "Supporting evidence (HTTPS)", {
                    type: "url",
                    maxLength: 1000,
                  })}
                </>
              )}
              {modal.action === "offering" && (
                <>
                  {field("title", "Listing name", {
                    minLength: 3,
                    maxLength: 120,
                  })}
                  {select("entity_type", "Opportunity type", [
                    { value: "freelancer", label: "People / freelancer" },
                    { value: "agency", label: "Agency" },
                    ...(data?.reviewer
                      ? [{ value: "platform", label: "Overall platform" }]
                      : []),
                  ])}
                  {area(
                    "summary",
                    "What would this capital help you build?",
                    40,
                    "Describe the use of capital. Do not promise returns, insurance or ownership rights.",
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {field("target", "Sandbox target (USD)", {
                      type: "number",
                    })}
                    {field("minimum", "Minimum commitment (USD)", {
                      type: "number",
                      hint: "At least $10, no greater than the target.",
                    })}
                  </div>
                  {select(
                    "term_months",
                    "Illustrative duration",
                    [1, 3, 6, 12, 24, 36, 60].map((n) => ({
                      value: String(n),
                      label: `${n} months`,
                    })),
                  )}
                  {field("profile_url", "Public profile (HTTPS)", {
                    type: "url",
                    maxLength: 1000,
                  })}
                </>
              )}
              {modal.action === "commit" && (
                <>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="font-semibold">{modal.offering?.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {modal.offering?.summary}
                    </p>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt>Minimum</dt>
                        <dd className="font-medium">
                          {money(modal.offering?.minimum_minor)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Remaining sandbox target</dt>
                        <dd className="font-medium">
                          {money(modal.offering?.remaining_minor)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {field("amount", "Sandbox commitment (USD)", {
                    type: "number",
                  })}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This records a simulation only. It creates no payment,
                    token, equity, return, or contractual investment
                    entitlement. Actual offering terms remain undecided.
                  </p>
                </>
              )}
              {modal.action === "review" && (
                <>
                  <RecordDetails record={modal.record!} compact />
                  {select(
                    "review_action",
                    "Decision / next action",
                    reviewActions(modal.record!),
                  )}
                  {area(
                    "review_note",
                    "Reason and evidence checked",
                    10,
                    "Record what you checked. You cannot approve your own submission.",
                  )}
                </>
              )}
              {modal.action !== "review" && (
                <label className="flex items-start gap-2.5 rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    required
                    disabled={busy}
                    className="mt-0.5 size-4 shrink-0 accent-violet-600"
                  />
                  I understand this is a sandbox simulation with illustrative
                  terms, no money movement, and no guaranteed funding, coverage
                  or returns.
                </label>
              )}
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    busy || (modal.action !== "review" && !acknowledged)
                  }
                >
                  {busy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  {busy
                    ? "Saving…"
                    : modal.action === "review"
                      ? "Record decision"
                      : modal.action === "commit"
                        ? "Record sandbox commitment"
                        : "Submit for review"}
                </Button>
              </div>
            </form>
          )}
        </FinanceDialog>
      )}
    </div>
  );
}

function Rules({ data }: { data: FinanceOverview }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-sm font-semibold">Illustrative sandbox terms</h3>
      <dl className="mt-4 space-y-3 text-xs">
        {[
          ["Advance limit", `${data.rules.advance_cap_bps / 100}% of project`],
          ["Advance fee", `${data.rules.advance_fee_bps / 100}%`],
          [
            "Protection service fee",
            `${data.rules.protection_fee_bps / 100}% of project`,
          ],
          [
            "Coverage limit",
            `${data.rules.coverage_cap_bps / 100}% of project`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
        {data.rules.version}. The protection service rate is {data.rules.protection_fee_bps / 100}% of project value.
        Other prices and limits remain illustrative sandbox assumptions.
      </p>
    </div>
  );
}

function QuotePreview({
  project,
  amount,
  funding,
  feeBps,
}: {
  project: FinanceRecord;
  amount: string;
  funding: boolean;
  feeBps: number;
}) {
  const q = project.quote!;
  let advance = 0;
  try {
    advance = minorUnits(amount);
  } catch {
    /* An incomplete input isn't a quote. */
  }
  const fee = Math.ceil((advance * feeBps) / 10000);
  return (
    <div className="rounded-xl border bg-primary/5 p-4">
      <p className="mb-3 text-xs font-semibold text-primary">
        Illustrative estimate · final quote calculated by server
      </p>
      <dl className="space-y-2 text-sm">
        {(funding
          ? [
              ["Project value", money(project.amount_minor)],
              [`Advance fee (${feeBps / 100}%)`, advance ? money(fee) : "—"],
              ["Net advance", advance ? money(advance - fee) : "—"],
              ["Settlement amount", advance ? money(advance) : "—"],
            ]
          : [
              ["Protection service fee", money(q.protection_fee_minor)],
              ["Illustrative coverage limit", money(q.coverage_minor)],
            ]
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RecordDetails({
  record: r,
  compact = false,
}: {
  record: FinanceRecord;
  compact?: boolean;
}) {
  const fields = [
    ["Type", KINDS[r.kind]],
    ["Platform", r.platform],
    ["Reference", r.reference],
    ["Due date", r.due_date],
    [
      "Requested / project amount",
      r.amount_minor ? money(r.amount_minor) : undefined,
    ],
    ["Sandbox target", r.target_minor ? money(r.target_minor) : undefined],
    [
      "Sandbox commitments",
      r.committed_minor !== undefined ? money(r.committed_minor) : undefined,
    ],
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Status value={r.status} />
        <span className="text-xs text-muted-foreground">
          Version {r.version}
        </span>
      </div>
      <dl className="space-y-2 text-sm">
        {fields
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
      </dl>
      {(r.notes || r.reason || r.summary) && (
        <p className="whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
          {r.notes || r.reason || r.summary}
        </p>
      )}
      {(r.evidence_url || r.profile_url) && (
        <a
          href={r.evidence_url || r.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary"
        >
          Open submitted evidence
          <ExternalLink className="size-3.5" />
        </a>
      )}
      {r.quote && (
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-xs font-semibold">
            {r.kind === "project" ? "Current project estimate" : "Saved sandbox quote"} · {r.quote.rules_version}
          </p>
          <dl className="space-y-2 text-xs">
            {(r.kind === "protection"
              ? [
                  ["Protection service fee", money(r.quote.protection_fee_minor)],
                  ["Coverage limit", money(r.quote.coverage_minor)],
                ]
              : [
                  ["Advance limit", money(r.quote.advance_cap_minor)],
                  ["Requested advance", money(r.quote.amount_minor)],
                  ["Fee", money(r.quote.fee_minor)],
                  ["Net advance", money(r.quote.net_minor)],
                  ["Settlement", money(r.quote.settlement_minor)],
                ]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {!compact && (
        <div>
          <h3 className="mb-4 text-sm font-semibold">Case history</h3>
          <ol className="space-y-4 border-l pl-4">
            {r.events?.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary" />
                <p className="text-sm font-medium">
                  {e.action.replaceAll("_", " ")}
                </p>
                {e.note && (
                  <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                    {e.note}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Sandbox record only. No real financial transaction, verified identity,
        investment rights, or insurance coverage is created.
      </p>
    </div>
  );
}
