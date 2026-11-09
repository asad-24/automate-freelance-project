"use client";
import * as React from "react";
import { apiCall, apiFetch, apiGet } from "@/lib/api";
import { DEMO_MODE, useAuth } from "@/lib/auth";
import {
  DemoState, CycleResult, Row, ConnectResult, GigDraftInput, GigDraftResult, Monetization,
  initialState, runCycle,
  runAgent as engineRunAgent, toggleAgent as engineToggleAgent,
  resolveHitl as engineResolveHitl, updateAgent as engineUpdateAgent,
  connectAccount as engineConnectAccount, disconnectAccount as engineDisconnectAccount,
  createGig as engineCreateGig, toggleGig as engineToggleGig, removeGig as engineRemoveGig,
  buyCredits as engineBuyCredits, upgradePlan as engineUpgradePlan,
  recordShare as engineRecordShare, addReferral as engineAddReferral,
  addAgency as engineAddAgency, removeAgency as engineRemoveAgency,
  patchAgency as enginePatchAgency,
  saveCampaign as engineSaveCampaign, addOutreachTarget as engineAddOutreachTarget,
  saveTemplate as engineSaveTemplate, removeTemplate as engineRemoveTemplate,
  patchCampaign as enginePatchCampaign,
  patchOutreach as enginePatchOutreach, removeOutreach as engineRemoveOutreach,
  markReferralSignedUp as engineMarkReferralSignedUp,
  radarRecordScan, radarSaveSearch, radarRemoveSearch, radarTrackJob,
  radarPatchApp, radarRemoveApp, radarToggleSaved, radarDismiss, radarSetGoal,
} from "@/lib/demo-engine";

// Frontend-only demo (no backend) keeps its state in this browser.
// v2 — previous demo data was test-seeded; the fresh account starts empty.
const STORAGE_KEY = "autopilot-demo-v2";

type Workspace = { state: Partial<DemoState>; version: number };

type DemoStoreValue = {
  state: DemoState;
  cycles: number;
  /** Read a collection by the same key useEntity uses. Falls back to `seed`. */
  get: <T>(key: string, seed: T) => T;
  /** Run one acquisition cycle (client-side). Returns what the agents did. */
  run: (opts?: { niche?: string }) => CycleResult;
  /** Run a single agent on demand — command-center "Run now". */
  runAgent: (name: string) => CycleResult;
  /** Pause/resume an agent. Returns the updated agent. */
  toggleAgent: (id: string) => Row | undefined;
  /** Approve/resolve a HITL queue item. */
  resolveHitl: (id: string) => Row | undefined;
  /** Persist edits to an agent's config. */
  updateAgent: (id: string, patch: Row) => Row | undefined;
  // Connector hub
  connectAccount: (platform: string, handle: string) => Promise<ConnectResult>;
  disconnectAccount: (id: string) => Row | undefined;
  createGig: (input: GigDraftInput) => GigDraftResult;
  toggleGig: (id: string) => Row | undefined;
  removeGig: (id: string) => Row | undefined;
  saveAccountSetup: (progress: Record<string, string[]>) => void;
  // Monetization — server-owned with a backend; null when the server refused.
  buyCredits: (kind: "bids" | "profiles") => Promise<Row | null>;
  upgradePlan: () => Promise<Row | null>;
  // Growth — trial/referrals + outreach
  recordShare: (channel: string) => { extended: boolean };
  addReferral: (name: string, channel?: string) => { referral: Row; extended: boolean };
  markReferralSignedUp: (id: string) => Row | undefined;
  addAgency: (input: { name: string; email: string; focus?: string; size?: string; notes?: string }) => Row;
  removeAgency: (id: string) => void;
  patchAgency: (id: string, patch: Row) => void;
  saveCampaign: (input: { name: string; offer: string; subject: string; body: string; sent: number; failed: number; status: string; results?: Row[] }) => Row;
  saveTemplate: (input: { name: string; subject: string; body: string }) => Row;
  removeTemplate: (id: string) => void;
  patchCampaign: (id: string, patch: Row) => void;
  addOutreachTarget: (input: { platform: string; target: string; profileUrl?: string; note?: string }) => Row;
  patchOutreach: (id: string, patch: Row) => void;
  removeOutreach: (id: string) => void;
  // Job Radar workspace
  radarRecordScan: (query: string, newCount: number) => void;
  radarSaveSearch: (name: string, query: string) => Row;
  radarRemoveSearch: (id: string) => void;
  radarTrackJob: (job: Row, stage?: string, proposal?: string) => Row | undefined;
  radarPatchApp: (id: string, patch: Row) => void;
  radarRemoveApp: (id: string) => void;
  radarToggleSaved: (jobId: string) => boolean;
  radarDismiss: (jobId: string) => void;
  radarSetGoal: (goal: number) => void;
  // Money ledger and Calendar events (saved with the workspace).
  /** False until this user's workspace has loaded; don't migrate or save before. */
  hydrated: boolean;
  updateLedger: (fn: (ledger: Row | undefined) => Row) => void;
  updateCalendarEvents: (fn: (events: Row[]) => Row[]) => void;
  reset: () => void;
};

const DemoStoreContext = React.createContext<DemoStoreValue | null>(null);

// Product catalog — the built-in values are the real plans and add-ons.
const CATALOG_KEYS = new Set(["plans", "addons"]);

/** Same shape as `seed` but empty — lists empty, numbers 0, text blank — so
 *  real accounts never see built-in mock rows while data loads or if it fails. */
function emptyLike<T>(seed: T): T {
  if (Array.isArray(seed)) return [] as unknown as T;
  if (seed && typeof seed === "object") {
    return Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, emptyLike(v)])) as T;
  }
  if (typeof seed === "number") return 0 as unknown as T;
  if (typeof seed === "string") return "" as unknown as T;
  if (typeof seed === "boolean") return false as unknown as T;
  return seed;
}

// Maps the string keys used across the app (useEntity/getEntity) to the
// matching collection on the client-side demo state.
function selectByKey(state: DemoState, key: string): unknown {
  switch (key) {
    case "kpis": return state.kpis;
    case "funnel": return state.funnel;
    case "channel-mix": return state.channelMix;
    case "margins/timeseries": return state.marginTimeseries;
    case "margins/by-project": return state.marginByProject;
    case "clients": return state.clients;
    case "leads": return state.leads;
    case "proposals": return state.proposals;
    case "contracts": return state.contracts;
    case "sales-leads": return state.salesLeads;
    case "conversations": return state.conversations;
    case "notifications": return state.notifications;
    case "audit-log": return state.auditLog;
    case "agents": return state.agents;
    case "milestones": return state.milestones;
    case "hitl": return state.hitl;
    case "invoices": return state.invoices;
    case "payouts": return state.payouts;
    case "bids": return state.bids;
    case "qa-runs": return state.qaRuns;
    case "deliverables": return state.deliverables;
    case "voice-calls": return state.voiceCalls;
    case "jobs": return state.jobs;
    case "billing-history": return state.billingHistory;
    case "users": return state.users;
    case "accounts": return state.accounts;
    case "gigs": return state.gigs;
    case "monetization":
    case "user-monetization": return state.monetization;
    case "growth": return state.growth;
    // Portals start empty too — no canned client/freelancer records.
    case "client/projects":
    case "client/files":
    case "client/invoices":
    case "client/milestones":
    case "freelancer/bids":
    case "freelancer/contracts":
    case "freelancer/earnings":
      return [];
    default: return undefined;
  }
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = React.useState<DemoState>(() => initialState());
  const [hydrated, setHydrated] = React.useState(false);

  const mergeSaved = React.useCallback((saved: Partial<DemoState>): DemoState => {
    const base = initialState();
    return {
      ...base,
      ...saved,
      monetization: { ...base.monetization, ...(saved.monetization ?? {}) },
      growth: { ...base.growth, ...(saved.growth ?? {}) },
    };
  }, []);

  // With a backend the server is the source of truth, one workspace per
  // signed-in user: `version` guards against stale overwrites from another
  // tab, and `loadedFor` blocks saving until that user's workspace arrived.
  const version = React.useRef(0);
  const loadedFor = React.useRef<string | null>(null);

  const applyMonetization = React.useCallback((mon: Monetization) => {
    setState((cur) => ({ ...cur, monetization: mon, billingHistory: mon.purchases }));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (DEMO_MODE) {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        if (raw) setState(mergeSaved(JSON.parse(raw) as Partial<DemoState>));
      } catch {
        /* ignore corrupt storage */
      }
      setHydrated(true);
      return;
    }
    // Switching accounts never shows the previous user's data.
    loadedFor.current = null;
    version.current = 0;
    setHydrated(false);
    setState(initialState());
    if (!userId) return;
    void Promise.all([
      apiGet<Workspace>("/api/state"),
      apiGet<Monetization>("/api/user-monetization"),
    ]).then(([ws, mon]) => {
      if (cancelled || !ws) return;
      version.current = ws.version;
      setState(mergeSaved({ ...ws.state, ...(mon ? { monetization: mon, billingHistory: mon.purchases } : {}) }));
      loadedFor.current = userId;
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, mergeSaved]);

  // Saves are debounced so rapid clicks batch into one write, and chained so
  // each one sends the version returned by the previous save.
  const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<DemoState | null>(null);
  const saveChain = React.useRef<Promise<void>>(Promise.resolve());

  const saveRemote = React.useCallback(async (owner: string) => {
    const next = pending.current;
    pending.current = null;
    if (!next || loadedFor.current !== owner) return;
    const rest: Partial<DemoState> = { ...next };
    delete rest.monetization; // server-owned
    delete rest.billingHistory;
    const res = await apiFetch("/api/state", {
      method: "PUT",
      body: JSON.stringify({ state: rest, version: version.current }),
    }).catch(() => null);
    if (!res || loadedFor.current !== owner) return;
    if (res.ok) {
      version.current = ((await res.json()) as { version: number }).version;
    } else if (res.status === 409) {
      // Another tab or device saved first — adopt its copy.
      const latest = (await res.json()) as Workspace;
      version.current = latest.version;
      setState((cur) => mergeSaved({ ...latest.state, monetization: cur.monetization, billingHistory: cur.billingHistory }));
    }
  }, [mergeSaved]);

  const persist = React.useCallback((next: DemoState) => {
    if (DEMO_MODE) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be full/disabled — demo still works in-memory */
      }
      return;
    }
    const owner = loadedFor.current;
    if (!owner) return; // never overwrite the server before the workspace loaded
    pending.current = next;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      saveChain.current = saveChain.current.then(() => saveRemote(owner));
    }, 800);
  }, [saveRemote]);

  // Always mutate the latest state, not a stale render closure, so several
  // actions fired in the same tick (e.g. saving five jobs in a loop) all survive.
  const stateRef = React.useRef(state);
  stateRef.current = state;

  /** Run a mutation on a fresh copy, persist it, return the result. */
  const mutate = React.useCallback(
    <R,>(fn: (draft: DemoState) => R): R => {
      const draft: DemoState = JSON.parse(JSON.stringify(stateRef.current));
      const out = fn(draft);
      stateRef.current = draft;
      setState(draft);
      persist(draft);
      return out;
    },
    [persist]
  );

  const updateLedger = React.useCallback(
    (fn: (ledger: Row | undefined) => Row) => mutate((d) => { d.ledger = fn(d.ledger); }),
    [mutate]
  );
  const updateCalendarEvents = React.useCallback(
    (fn: (events: Row[]) => Row[]) => mutate((d) => { d.calendarEvents = fn(d.calendarEvents ?? []); }),
    [mutate]
  );

  const run = React.useCallback(
    (opts?: { niche?: string }) => mutate((d) => runCycle(d, opts)),
    [mutate]
  );
  const runAgent = React.useCallback((name: string) => mutate((d) => engineRunAgent(d, name)), [mutate]);
  const toggleAgent = React.useCallback((id: string) => mutate((d) => engineToggleAgent(d, id)), [mutate]);
  const resolveHitl = React.useCallback((id: string) => mutate((d) => engineResolveHitl(d, id)), [mutate]);
  const updateAgent = React.useCallback(
    (id: string, patch: Row) => mutate((d) => engineUpdateAgent(d, id, patch)),
    [mutate]
  );
  const connectAccount = React.useCallback(
    async (platform: string, handle: string): Promise<ConnectResult> => {
      if (DEMO_MODE) return mutate((d) => engineConnectAccount(d, platform, handle));
      return { ok: false, reason: "Account OAuth is not implemented yet. Use the guided signup links; no account was connected." };
    },
    [mutate]
  );
  const disconnectAccount = React.useCallback(
    (id: string) => mutate((d) => engineDisconnectAccount(d, id)),
    [mutate]
  );
  const createGig = React.useCallback(
    (input: GigDraftInput) =>
      mutate((d) => engineCreateGig(d, input)),
    [mutate]
  );
  const toggleGig = React.useCallback((id: string) => mutate((d) => engineToggleGig(d, id)), [mutate]);
  const removeGig = React.useCallback((id: string) => mutate((d) => engineRemoveGig(d, id)), [mutate]);
  const saveAccountSetup = React.useCallback((progress: Record<string, string[]>) => {
    mutate((d) => { d.accountSetup = progress; });
  }, [mutate]);
  const buyCredits = React.useCallback(
    async (kind: "bids" | "profiles"): Promise<Row | null> => {
      if (DEMO_MODE) return mutate((d) => engineBuyCredits(d, kind));
      const res = await apiCall<{ purchase: Row; monetization: Monetization }>("/api/billing/credits", { kind });
      if (!res || res.status >= 400) return null;
      applyMonetization(res.data.monetization);
      return res.data.purchase;
    },
    [mutate, applyMonetization]
  );
  const upgradePlan = React.useCallback(async (): Promise<Row | null> => {
    if (DEMO_MODE) return mutate((d) => engineUpgradePlan(d));
    const res = await apiCall<{ purchase: Row; monetization: Monetization }>("/api/billing/upgrade", {});
    if (!res || res.status >= 400) return null;
    applyMonetization(res.data.monetization);
    return res.data.purchase;
  }, [mutate, applyMonetization]);
  const recordShare = React.useCallback((channel: string) => mutate((d) => engineRecordShare(d, channel)), [mutate]);
  const addReferral = React.useCallback(
    (name: string, channel?: string) => mutate((d) => engineAddReferral(d, name, channel)),
    [mutate]
  );
  const markReferralSignedUp = React.useCallback((id: string) => mutate((d) => engineMarkReferralSignedUp(d, id)), [mutate]);
  const addAgency = React.useCallback(
    (input: { name: string; email: string; focus?: string; size?: string; notes?: string }) => mutate((d) => engineAddAgency(d, input)),
    [mutate]
  );
  const removeAgency = React.useCallback((id: string) => mutate((d) => engineRemoveAgency(d, id)), [mutate]);
  const patchAgency = React.useCallback((id: string, patch: Row) => {
    mutate((d) => enginePatchAgency(d, id, patch));
  }, [mutate]);
  const saveCampaign = React.useCallback(
    (input: { name: string; offer: string; subject: string; body: string; sent: number; failed: number; status: string; results?: Row[] }) =>
      mutate((d) => engineSaveCampaign(d, input)),
    [mutate]
  );
  const saveTemplate = React.useCallback(
    (input: { name: string; subject: string; body: string }) => mutate((d) => engineSaveTemplate(d, input)),
    [mutate]
  );
  const removeTemplate = React.useCallback((id: string) => mutate((d) => engineRemoveTemplate(d, id)), [mutate]);
  const patchCampaign = React.useCallback((id: string, patch: Row) => {
    mutate((d) => enginePatchCampaign(d, id, patch));
  }, [mutate]);
  const addOutreachTarget = React.useCallback(
    (input: { platform: string; target: string; profileUrl?: string; note?: string }) =>
      mutate((d) => engineAddOutreachTarget(d, input)),
    [mutate]
  );
  const patchOutreach = React.useCallback((id: string, patch: Row) => {
    mutate((d) => enginePatchOutreach(d, id, patch));
  }, [mutate]);
  const removeOutreach = React.useCallback((id: string) => mutate((d) => engineRemoveOutreach(d, id)), [mutate]);
  const radarRecordScanCb = React.useCallback((query: string, newCount: number) => {
    mutate((d) => radarRecordScan(d, query, newCount));
  }, [mutate]);
  const radarSaveSearchCb = React.useCallback((name: string, query: string) => mutate((d) => radarSaveSearch(d, name, query)), [mutate]);
  const radarRemoveSearchCb = React.useCallback((id: string) => mutate((d) => radarRemoveSearch(d, id)), [mutate]);
  const radarTrackJobCb = React.useCallback(
    (job: Row, stage = "Saved", proposal = "") => mutate((d) => radarTrackJob(d, job, stage as any, proposal)),
    [mutate]
  );
  const radarPatchAppCb = React.useCallback((id: string, patch: Row) => {
    mutate((d) => radarPatchApp(d, id, patch));
  }, [mutate]);
  const radarRemoveAppCb = React.useCallback((id: string) => mutate((d) => radarRemoveApp(d, id)), [mutate]);
  const radarToggleSavedCb = React.useCallback((jobId: string) => mutate((d) => radarToggleSaved(d, jobId)), [mutate]);
  const radarDismissCb = React.useCallback((jobId: string) => mutate((d) => radarDismiss(d, jobId)), [mutate]);
  const radarSetGoalCb = React.useCallback((goal: number) => mutate((d) => radarSetGoal(d, goal)), [mutate]);

  const reset = React.useCallback(() => {
    const fresh = initialState();
    if (DEMO_MODE) {
      setState(fresh);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    // Plan and credits are server-owned — a reset keeps them.
    mutate((d) => Object.assign(d, fresh, { monetization: d.monetization, billingHistory: d.billingHistory }));
  }, [mutate]);

  const get = React.useCallback(
    <T,>(key: string, seed: T): T => {
      const v = selectByKey(state, key);
      if (v !== undefined) return v as T;
      return DEMO_MODE || CATALOG_KEYS.has(key) ? seed : emptyLike(seed);
    },
    [state]
  );

  const value: DemoStoreValue = {
    state, cycles: state.cycles, get, run, runAgent, toggleAgent, resolveHitl, updateAgent,
    connectAccount, disconnectAccount, createGig, toggleGig, removeGig, saveAccountSetup, buyCredits, upgradePlan,
    recordShare, addReferral, markReferralSignedUp, addAgency, removeAgency, patchAgency, saveCampaign,
    saveTemplate, removeTemplate, patchCampaign,
    addOutreachTarget, patchOutreach, removeOutreach,
    radarRecordScan: radarRecordScanCb, radarSaveSearch: radarSaveSearchCb,
    radarRemoveSearch: radarRemoveSearchCb, radarTrackJob: radarTrackJobCb,
    radarPatchApp: radarPatchAppCb, radarRemoveApp: radarRemoveAppCb,
    radarToggleSaved: radarToggleSavedCb, radarDismiss: radarDismissCb,
    radarSetGoal: radarSetGoalCb,
    hydrated, updateLedger, updateCalendarEvents,
    reset,
  };
  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStoreValue | null {
  return React.useContext(DemoStoreContext);
}
