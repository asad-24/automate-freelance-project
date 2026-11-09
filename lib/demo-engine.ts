/**
 * Client-side acquisition engine (no backend required).
 *
 * This is a browser-only port of the FastAPI demo engine so the onboarding /
 * "get your first clients" flow works on the live Vercel site with zero server
 * dependencies. Each `runCycle` mutates a plain state object: it scrapes
 * freelance leads, finds funded startups, onboards brand-new clients, wins a
 * contract and rolls the KPIs / funnel / margin chart / channel mix / audit log
 * forward — exactly like the real agents would.
 */
import {
  kpis as kpisSeed,
  funnelData as funnelSeed,
  marginTimeseries as marginSeed,
  agents as agentsSeed,
} from "@/lib/mock-data";
import { PAYMENTS_LIVE } from "@/lib/flags";

export type Row = Record<string, any>;
export type AuditEvent = { id: string; agent: string; action: string; status: string; time: string };

export const channelMixSeed = [
  { name: "Upwork", value: 46 },
  { name: "B2B Direct", value: 28 },
  { name: "Reddit", value: 14 },
  { name: "Fiverr", value: 12 },
];

export type Monetization = {
  plan: "free" | "pro";
  bidCredits: number;
  profileCredits: number;
  purchases: Row[];
};

/**
 * Growth engine — referral/trial mechanics plus the outbound tools
 * (agency email campaigns + compliant platform outreach drafts).
 * Persisted inside DemoState → auto-syncs to MongoDB via /api/state.
 */
export type Growth = {
  trialStartedAt: string;   // ISO — when this workspace's trial began
  trialDays: number;        // TRIAL_BASE_DAYS → TRIAL_EXTENDED_DAYS
  referralCode: string;     // share code, e.g. "AP-9F2K"
  referrals: Row[];         // {id, name, channel, status, at}
  shares: Row[];            // {id, channel, at}
  agencies: Row[];          // {id, name, email, focus, status, notes}
  campaigns: Row[];         // {id, name, offer, subject, sent, failed, results, createdAt, status}
  outreach: Row[];          // {id, platform, target, profileUrl, message, status, at}
  templates: Row[];         // {id, name, subject, body, createdAt} — saved email copy
};

export const TRIAL_BASE_DAYS = 3;
export const TRIAL_EXTENDED_DAYS = 7;

/**
 * Job Radar workspace — saved searches, application pipeline, retention
 * mechanics (daily streak + weekly goal). Persisted via /api/state.
 */
export type RadarState = {
  savedSearches: Row[];   // {id, name, query, lastScanAt, lastCount, newSinceLast}
  applications: Row[];    // {id, jobId, title, company, url, source, budget, stage, proposal, appliedAt, notes}
  dismissed: string[];    // job ids hidden from the feed
  saved: string[];        // job ids bookmarked for later
  lastVisitAt: string;
  scanStreak: number;     // consecutive days with ≥1 scan
  lastScanDate: string;   // YYYY-MM-DD
  weeklyGoal: number;     // applications per week
};

export type DemoState = {
  cycles: number;
  seq: number;
  kpis: Row;
  funnel: Row[];
  channelMix: { name: string; value: number }[];
  marginTimeseries: Row[];
  marginByProject: Row[];
  clients: Row[];
  leads: Row[];
  proposals: Row[];
  contracts: Row[];
  salesLeads: Row[];
  conversations: Row[];
  notifications: Row[];
  auditLog: AuditEvent[];
  agents: Row[];
  milestones: Row[];
  // Connector hub — the user's linked platform accounts and gigs.
  accounts: Row[];
  gigs: Row[];
  accountSetup: Record<string, string[]>;
  // Monetization — free-plan credits & purchases.
  monetization: Monetization;
  // Growth — trial/referrals + outbound campaigns & outreach drafts.
  growth: Growth;
  // Job Radar workspace — searches, pipeline, retention stats.
  radar: RadarState;
  // Remaining transactional collections — empty on a fresh account.
  hitl: Row[];
  invoices: Row[];
  payouts: Row[];
  bids: Row[];
  qaRuns: Row[];
  deliverables: Row[];
  voiceCalls: Row[];
  jobs: Row[];
  billingHistory: Row[];
  users: Row[];
  // Money ledger (lib/ledger.ts) and Calendar events — saved with the workspace,
  // so a signed-in user's copy lives on the server. Absent on older workspaces.
  ledger?: Row;
  calendarEvents?: Row[];
};

export type CycleResult = {
  cycle: number;
  events: AuditEvent[];
  found: {
    leads: Row[];
    salesLeads: Row[];
    clients: Row[];
    proposals: Row[];
    contracts: Row[];
    conversations: Row[];
  };
  deltas: {
    leads: number;
    salesLeads: number;
    clients: number;
    proposals: number;
    contractsWon: number;
    revenue: number;
    margin: number;
  };
  /** True when the free-plan bid credits ran out — UI should show the paywall. */
  needsCredits?: boolean;
};

// --------------------------------------------------------------------------- //
// Generation pools
// --------------------------------------------------------------------------- //
const B2B_COMPANIES: [string, string, string][] = [
  ["Smith & Armani Enterprises", "Construction", "Series A ($14M)"],
  ["Northwind Labs", "AI Infrastructure", "Series A ($14M)"],
  ["Verdant Health", "HealthTech", "Seed ($4M)"],
  ["Quanta Freight", "Logistics", "Series B ($30M)"],
  ["Lumen Retail", "E-commerce", "Series A ($9M)"],
  ["Harbor Fintech", "Fintech", "Series B ($42M)"],
  ["Beacon EdTech", "Education", "Seed ($2.5M)"],
  ["Cobalt Energy", "CleanTech", "Series A ($18M)"],
  ["Pine & Oak", "Consumer", "Bootstrapped"],
  ["Signal Robotics", "Robotics", "Series A ($11M)"],
  ["Meridian Travel", "Travel", "Seed ($3.2M)"],
  ["Atlas Proptech", "PropTech", "Series B ($55M)"],
  ["Cedar Legal", "LegalTech", "Seed ($1.8M)"],
  ["Nimbus Analytics", "Data/SaaS", "Series A ($16M)"],
  ["Orchid Beauty", "D2C", "Seed ($2M)"],
];

const FIRST_NAMES = ["Jordan", "Dana", "Marco", "Sofia", "Tom", "Avery", "Priya", "Noah", "Lena", "Diego", "Mia", "Omar", "Ivy", "Kai", "Elena", "Ruben"];
const LAST_NAMES = ["Blake", "Wu", "Reyes", "Klein", "Fisher", "Nguyen", "Patel", "Brooks", "Novak", "Alvarez", "Haddad", "Rossi", "Okafor", "Lindqvist"];

const JOB_TITLES = [
  "Build a SaaS analytics dashboard (Next.js)",
  "AI chatbot for e-commerce store",
  "React Native app MVP",
  "Facebook Marketplace automation agent",
  "Shopify Plus theme customization",
  "Python data pipeline (ETL)",
  "Fintech dashboard with live charts",
  "Internal admin portal + RBAC",
  "LLM document search (RAG) service",
  "Stripe billing integration",
  "Marketing site rebuild + CMS",
  "Real-time logistics tracker",
];

const PLATFORMS = ["Upwork", "Upwork", "Fiverr", "Reddit r/forhire"];

const FREELANCERS: [string, string][] = [
  ["Priya Sharma", "India"],
  ["Diego Alvarez", "Argentina"],
  ["Olena Kovar", "Ukraine"],
  ["Linh Tran", "Vietnam"],
  ["Mateusz Nowak", "Poland"],
  ["Ananya Rao", "India"],
];

// --------------------------------------------------------------------------- //
// Helpers
// --------------------------------------------------------------------------- //
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const nowIso = () => new Date().toISOString();

/**
 * A brand-new account starts completely clean: zero clients, zero revenue,
 * empty CRM / pipeline / audit log, and a paused agent fleet. The onboarding
 * flow ("Get First Clients") is what fills it in — so nothing looks canned.
 */
export function initialState(): DemoState {
  const zeroedKpis = Object.fromEntries(
    Object.keys(kpisSeed).map((k) => [k, 0])
  );
  return {
    cycles: 0,
    seq: 0,
    kpis: zeroedKpis,
    funnel: funnelSeed.map((f) => ({ ...f, value: 0 })),
    channelMix: [],
    marginTimeseries: marginSeed.map((m) => ({ ...m, revenue: 0, cost: 0, margin: 0 })),
    marginByProject: [],
    clients: [],
    leads: [],
    proposals: [],
    contracts: [],
    salesLeads: [],
    conversations: [],
    notifications: [],
    auditLog: [],
    // The fleet exists but is idle until the owner launches it.
    agents: agentsSeed.map((a) => ({ ...a, status: "paused", runsToday: 0, lastRun: "—" })),
    milestones: [],
    accounts: [],
    gigs: [],
    accountSetup: {},
    // Free-first model: 10 free job bids + 2 free platform profiles.
    monetization: { plan: "free", bidCredits: 10, profileCredits: 2, purchases: [] },
    // Trial starts now: 3 days, extends to 7 when they share or refer.
    growth: {
      trialStartedAt: nowIso(),
      trialDays: TRIAL_BASE_DAYS,
      referralCode: `AP-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      referrals: [],
      shares: [],
      agencies: [],
      campaigns: [],
      outreach: [],
      templates: [],
    },
    radar: {
      savedSearches: [],
      applications: [],
      dismissed: [],
      saved: [],
      lastVisitAt: nowIso(),
      scanStreak: 0,
      lastScanDate: "",
      weeklyGoal: 10,
    },
    hitl: [],
    invoices: [],
    payouts: [],
    bids: [],
    qaRuns: [],
    deliverables: [],
    voiceCalls: [],
    jobs: [],
    billingHistory: [],
    users: [],
  };
}

function nextId(s: DemoState, prefix: string): string {
  s.seq += 1;
  return `${prefix}-${Date.now().toString().slice(-6)}${s.seq}`;
}

function recomputeChannelMix(s: DemoState) {
  const counts: Record<string, number> = {};
  for (const lead of s.leads) {
    const p: string = lead.platform ?? "Other";
    const key = p.includes("Reddit") ? "Reddit" : p === "LinkedIn" || p === "Clutch.co" ? "B2B Direct" : p;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const c of s.clients) {
    const key = ["B2B Direct", "LinkedIn", "Clutch.co"].includes(c.source) ? "B2B Direct" : c.source ?? "Other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const mix = Object.entries(counts)
    .map(([name, v]) => ({ name, value: Math.round((v * 100) / total) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  if (mix.length) s.channelMix = mix;
}

function bumpAgent(s: DemoState, name: string) {
  const a = s.agents.find((x) => x.name === name);
  if (a) {
    a.status = "running";
    a.runsToday = (a.runsToday ?? 0) + 1;
    a.lastRun = nowIso();
  }
}

type Ctx = {
  s: DemoState;
  events: AuditEvent[];
  found: CycleResult["found"];
  log: (agent: string, action: string, status?: string) => AuditEvent;
  notify: (title: string, body: string, type?: string) => void;
};

function makeCtx(s: DemoState): Ctx {
  const events: AuditEvent[] = [];
  return {
    s,
    events,
    found: { leads: [], salesLeads: [], clients: [], proposals: [], contracts: [], conversations: [] },
    log(agent, action, status = "success") {
      const e: AuditEvent = { id: nextId(s, "a"), agent, action, status, time: nowIso() };
      s.auditLog.unshift(e);
      events.push(e);
      return e;
    },
    notify(title, body, type = "success") {
      s.notifications.unshift({ id: nextId(s, "n"), title, body, type, time: nowIso(), read: false });
    },
  };
}

// --------------------------------------------------------------------------- //
// Generated content — proposal bodies & conversation threads (what users asked
// to *see*: the actual outreach the agents sent)
// --------------------------------------------------------------------------- //

/** Realistic proposal text — used for new proposals and as the viewer body for older ones. */
export function proposalBodyText(p: Row): string {
  const rate = p.platform === "Fiverr" ? "package" : "fixed-bid";
  return [
    `Subject: ${p.leadTitle} — senior team, delivered in days not months`,
    ``,
    `Hi,`,
    ``,
    `I read your post on ${p.platform} for "${p.leadTitle}" — this is squarely in our wheelhouse. We run a senior AI-augmented dev pod that ships ${rate} work like this every week.`,
    ``,
    `Here's how we'd attack it:`,
    `• Day 1: scope lock + architecture, you approve the spec`,
    `• Days 2–4: build with a dedicated QA gate on every commit`,
    `• Day 5: delivered, documented, with a walkthrough video`,
    ``,
    `Similar work from our portfolio is attached — same stack, same scope size. Happy to start today and I can hop on a quick call if helpful.`,
    ``,
    `— Sarah, Delivery Lead`,
  ].join("\n");
}

function genThread(contact: string, company: string, persona: string): Row[] {
  const first = contact.split(" ")[0];
  const t = () => new Date().toTimeString().slice(0, 5);
  return [
    {
      id: `m-${Math.random().toString(36).slice(2, 8)}`,
      from: "ai", author: persona, time: t(), delay: 27,
      text: `Hi ${first} — noticed ${company} is scaling right now. We help teams like yours ship product work fast with a senior AI-augmented pod. Worth a quick chat?`,
    },
    {
      id: `m-${Math.random().toString(36).slice(2, 8)}`,
      from: "client", author: contact, time: t(),
      text: `Interesting timing — we actually need help. What would this look like cost-wise and how fast could you start?`,
    },
    {
      id: `m-${Math.random().toString(36).slice(2, 8)}`,
      from: "ai", author: persona, time: t(), delay: 41, upsell: true,
      text: `We can start this week. Typical MVP scope runs 3–5 days with milestones you approve each step. I can also include a month of maintenance at a discount if we kick off before Friday.`,
    },
    {
      id: `m-${Math.random().toString(36).slice(2, 8)}`,
      from: "client", author: contact, time: t(),
      text: `Thanks for the detailed scope — this looks great, let's move forward.`,
    },
  ];
}

// --------------------------------------------------------------------------- //
// Per-agent work steps — each returns what it produced so a single agent can
// also be run on demand ("Run now") from the command center.
// --------------------------------------------------------------------------- //

/** Platforms the agents actually hunt on — the user's connected accounts first. */
function activePlatforms(s: DemoState): string[] {
  const connected = s.accounts.filter((a) => a.status === "Connected").map((a) => a.platform);
  return connected.length ? connected : PLATFORMS;
}

function genLead(s: DemoState, opts?: { niche?: string; strong?: boolean }): Row {
  const title = opts?.niche ? `${opts.niche} project` : pick(JOB_TITLES);
  const platform = pick(activePlatforms(s));
  const budget = opts?.strong
    ? pick([2200, 3500, 4800, 5400, 6800, 9200])
    : pick([450, 900, 1200, 2200, 3500, 4800, 5400, 6800, 9200]);
  const match = opts?.strong ? rand(84, 97) : rand(42, 97);
  const margin = opts?.strong ? rand(48, 68) : rand(10, 68);
  let status: string;
  if (budget < 500) status = "Skipped (<$500)";
  else if (match < 80) status = "Under Review";
  else status = pick(["Bidding", "Proposal Sent", "Proposal Sent"]);
  return { id: nextId(s, "l"), title, platform, budget, margin, matchScore: match, status, posted: "just now" };
}

function genProposal(s: DemoState, lead: Row): Row {
  const p: Row = {
    id: nextId(s, "p"),
    leadTitle: lead.title,
    platform: lead.platform.split(" ")[0],
    words: rand(138, 154),
    status: "Sent",
    quality: rand(88, 97),
    submitted: nowIso(),
  };
  p.body = proposalBodyText(p);
  return p;
}

function stepScrape(ctx: Ctx, opts?: { niche?: string }) {
  const { s, log } = ctx;
  bumpAgent(s, "Bidding & Acquisition");
  const via = s.accounts.length ? ` via connected ${s.accounts.map((a) => a.platform).join("/")} profiles` : "";
  log("Bidding & Acquisition", `Scraping job feeds${via}…`);
  const nLeads = rand(3, 4);
  let outOfCredits = false;
  for (let idx = 0; idx < nLeads; idx++) {
    const lead = genLead(s, { niche: idx === 0 ? opts?.niche : undefined, strong: idx === 0 });
    s.leads.unshift(lead);
    ctx.found.leads.push(lead);
    if (lead.status === "Bidding" || lead.status === "Proposal Sent") {
      // Each submitted bid spends one bid credit on the free plan.
      if (s.monetization.plan === "free" && s.monetization.bidCredits <= 0) {
        lead.status = "Needs Credits";
        outOfCredits = true;
        continue;
      }
      if (s.monetization.plan === "free") s.monetization.bidCredits -= 1;
      const proposal = genProposal(s, lead);
      s.proposals.unshift(proposal);
      ctx.found.proposals.push(proposal);
      lead.status = "Proposal Sent";
    }
  }
  if (outOfCredits) {
    log("Bidding & Acquisition", "Out of bid credits — proposals queued until top-up", "warning");
  }
  log("Bidding & Acquisition", `Scraped ${ctx.found.leads.length} leads · ${ctx.found.proposals.length} RAG proposals auto-submitted`);
}

function stepB2B(ctx: Ctx) {
  const { s, log } = ctx;
  bumpAgent(s, "Marketing & Sales");
  const nB2B = rand(1, 2);
  for (let i = 0; i < nB2B; i++) {
    const [company, industry, funding] = pick(B2B_COMPANIES);
    const slug = company.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "");
    const source = pick(["Clutch.co", "LinkedIn"]);
    const sl: Row = {
      id: nextId(s, "s"),
      company,
      industry,
      funding,
      source,
      stage: pick(["Email Opened", "Reply Received", "Sequence 2/4"]),
      contact: `founder@${slug}.io`,
      microsite: `${slug}.ouragency.com`,
    };
    s.salesLeads.unshift(sl);
    ctx.found.salesLeads.push(sl);
    log("Marketing & Sales", `New funded startup found: ${company} (${industry}, ${funding}) → micro-site deployed`);
  }
}

function stepOnboard(ctx: Ctx) {
  const { s, log, notify } = ctx;
  bumpAgent(s, "Stealth Client Manager");
  const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const sl = s.salesLeads[0];
  const company = sl ? sl.company : pick(B2B_COMPANIES)[0];
  const source = sl ? "B2B Direct" : pick([...activePlatforms(s), "B2B Direct"]);
  const client: Row = {
    id: nextId(s, "c"),
    name,
    company,
    source,
    ltv: pick([6400, 8600, 12400, 18200, 24000, 32000]),
    sentiment: pick(["positive", "positive", "neutral"]),
    contracts: 1,
    status: "Onboarding",
  };
  s.clients.unshift(client);
  ctx.found.clients.push(client);
  log("Stealth Client Manager", `Opened human-persona conversation with ${name} @ ${company}`);

  const persona = pick(["Sarah (PM)", "Mike (Senior Dev)", "Elena (AE)"]);
  const conversation: Row = {
    id: nextId(s, "cv"),
    contact: name,
    channel: pick(["Web", "Email", "WhatsApp"]),
    persona,
    last: "Thanks for the detailed scope — this looks great, let's move forward.",
    unread: rand(0, 3),
    sentiment: "positive",
    time: nowIso(),
    thread: genThread(name, company, persona),
  };
  s.conversations.unshift(conversation);
  ctx.found.conversations.push(conversation);
  log("Stealth Client Manager", `Sent outreach + handled reply via ${conversation.channel} (${persona})`);
  notify("New client acquired", `${company} — via ${source}`);
}

function stepAuction(ctx: Ctx) {
  const { s, log, notify } = ctx;
  bumpAgent(s, "Arbitrage Dispatcher");
  const convertible =
    ctx.found.leads.find((l) => l.status === "Proposal Sent" && l.matchScore >= 85) ??
    s.leads.find((l) => l.status === "Proposal Sent");
  const client =
    ctx.found.clients[0] ??
    s.clients.find((c) => c.status === "Onboarding") ??
    s.clients[0] ??
    { id: nextId(s, "c"), name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, company: pick(B2B_COMPANIES)[0], source: "Upwork", ltv: 12400, sentiment: "positive", contracts: 0, status: "Active" };
  if (!client.id.startsWith("c-")) client.id = nextId(s, "c");
  if (!s.clients.includes(client)) s.clients.unshift(client);

  const title = convertible ? convertible.title : `${client.company} platform build`;
  const value = convertible ? convertible.budget : pick([4800, 6800, 9200, 12800]);
  const cost = Math.round(value * (0.38 + Math.random() * 0.08));
  const overhead = rand(60, 240);
  const margin = value - cost - overhead;

  const fl = pick(FREELANCERS);
  const flId = `FL-${rand(1000, 9900)}`;
  log("Arbitrage Dispatcher", `Blind auction opened for '${title}' — ${rand(8, 16)} vetted freelancers invited`);
  log("Arbitrage Dispatcher", `Blind auction closed → awarded to ${fl[0]} (${fl[1]}) · ROI-selected`);

  const milestonesTotal = pick([3, 4]);
  const contract: Row = {
    id: nextId(s, "ct"),
    title,
    client: client.company,
    value,
    status: "In Progress",
    milestonesDone: 0,
    milestonesTotal,
    freelancer: flId,
    qa: "Pending",
    due: "2026-12-15",
  };
  s.contracts.unshift(contract);
  ctx.found.contracts.push(contract);
  client.status = "Active";
  client.contracts = (client.contracts ?? 0) + 1;
  if (convertible) convertible.status = "Won";

  for (let mi = 0; mi < milestonesTotal; mi++) {
    s.milestones.push({
      id: nextId(s, "m"),
      contract: title,
      title: `Milestone ${mi + 1}`,
      amount: Math.round(value / milestonesTotal),
      status: "Pending",
      due: "2026-12-15",
    });
  }

  s.marginByProject.unshift({ project: title, client: client.company, payment: value, freelancerCost: cost, apiOverhead: overhead, margin });

  // First payout always routes to the human-in-the-loop queue for sign-off.
  s.hitl.unshift({
    id: nextId(s, "h"),
    type: "Payout Approval",
    entity: `${fl[0]} · $${Math.round(cost * 0.5).toLocaleString()}`,
    reason: `First milestone on '${title}' queued — awaiting your approval`,
    priority: "Medium",
    status: "Open",
    created: nowIso(),
  });

  log("Bidding & Acquisition", `Contract WON: '${title}' — ${client.company} ($${value.toLocaleString()} · ${Math.round((margin * 100) / value)}% margin)`);
  notify("New contract won", `${title} — $${value.toLocaleString()} · ${Math.round((margin * 100) / value)}% margin`);
  return { revenue: value, cost: cost + overhead, margin };
}

function stepJobHunter(ctx: Ctx) {
  const { s, log } = ctx;
  bumpAgent(s, "Job Hunter");
  const JOBS = [
    ["Senior Full-Stack Engineer", "Greenhouse"], ["AI/ML Engineer", "Lever"],
    ["Frontend Engineer (React)", "Greenhouse"], ["Backend Engineer (Python)", "Lever"],
    ["LLM Applications Engineer", "Ashby"], ["Platform Engineer", "LinkedIn"],
    ["Marketplace Automation Dev", "Indeed"], ["SaaS Dashboard Engineer", "Workable"],
  ];
  const n = rand(2, 3);
  for (let i = 0; i < n; i++) {
    const [title, source] = pick(JOBS);
    const job: Row = {
      id: nextId(s, "j"),
      title,
      company: pick(B2B_COMPANIES)[0],
      source,
      location: pick(["Remote (US)", "Remote", "San Francisco", "New York", "Austin"]),
      match: rand(76, 97),
      status: pick(["Applied", "Applied", "Screening"]),
      date: new Date().toISOString().slice(0, 10),
    };
    s.jobs.unshift(job);
    s.kpis.jobsApplied = (s.kpis.jobsApplied ?? 0) + 1;
  }
  log("Job Hunter", `Applied to ${n} matching roles via JobSpy + Playwright (avg match ${rand(82, 95)}%)`);
}

function stepQA(ctx: Ctx) {
  const { s, log } = ctx;
  bumpAgent(s, "QA & Delivery");
  const c = s.contracts.find((x) => x.qa !== "Passing") ?? s.contracts[0];
  const passed = Math.random() < 0.75;
  if (c) {
    s.qaRuns.unshift({
      id: nextId(s, "qa"),
      contract: c.title,
      pr: `#${rand(40, 300)}`,
      lint: "pass",
      tests: passed ? "pass" : "fail",
      sonar: passed ? rand(82, 96) : rand(55, 74),
      status: passed ? "Passed" : "Failed",
      freelancer: c.freelancer ?? "FL-3821",
      time: nowIso(),
    });
    c.qa = passed ? "Passing" : "Failing";
    log("QA & Delivery", `Ran lint+tests+SonarQube on '${c.title}' PR — ${passed ? "PASSED, deployable" : "FAILED, sent back to freelancer"}`, passed ? "success" : "warning");
  } else {
    log("QA & Delivery", "Idle sweep — no open PRs to validate");
  }
}

/** Map each agent to what it actually does when triggered. */
const AGENT_STEPS: Record<string, (ctx: Ctx, opts?: { niche?: string }) => { revenue: number; cost: number; margin: number } | void> = {
  "Bidding & Acquisition": (ctx, opts) => stepScrape(ctx, opts),
  "Marketing & Sales": (ctx) => stepB2B(ctx),
  "Stealth Client Manager": (ctx) => stepOnboard(ctx),
  "Arbitrage Dispatcher": (ctx) => stepAuction(ctx),
  "Job Hunter": (ctx) => stepJobHunter(ctx),
  "QA & Delivery": (ctx) => stepQA(ctx),
};

function rollup(s: DemoState, found: CycleResult["found"], gained: { revenue: number; cost: number; margin: number }) {
  const k = s.kpis;
  k.jobsApplied = (k.jobsApplied ?? 0) + found.proposals.length;
  k.activeContracts = (k.activeContracts ?? 0) + found.contracts.length;
  k.liveMargin = (k.liveMargin ?? 0) + gained.margin;
  k.revenueMonth = (k.revenueMonth ?? 0) + gained.revenue;
  k.freelancersActive = (k.freelancersActive ?? 0) + found.contracts.length;
  k.hitlOpen = s.hitl.filter((h) => h.status === "Open").length;
  if (found.proposals.length) {
    const realised = Math.round((found.contracts.length * 100) / Math.max(found.proposals.length, 1));
    k.winRate = Math.max(20, Math.min(60, Math.round(((k.winRate ?? 0) * 3 + realised) / 4)));
  }

  const bumpFunnel = (stage: string, by: number) => {
    const row = s.funnel.find((r) => r.stage === stage);
    if (row) row.value += by;
  };
  bumpFunnel("Leads Scraped", found.leads.length + found.salesLeads.length);
  bumpFunnel("Bids Submitted", found.proposals.length);
  bumpFunnel("Replies", found.clients.length);
  bumpFunnel("Contracts Won", found.contracts.length);

  if (s.marginTimeseries.length) {
    const last = s.marginTimeseries[s.marginTimeseries.length - 1];
    last.revenue += gained.revenue;
    last.cost += gained.cost;
    last.margin += gained.margin;
  }

  recomputeChannelMix(s);
}

function cycleResult(s: DemoState, ctx: Ctx, gained: { revenue: number; cost: number; margin: number }): CycleResult {
  return {
    cycle: s.cycles,
    events: ctx.events,
    found: ctx.found,
    deltas: {
      leads: ctx.found.leads.length,
      salesLeads: ctx.found.salesLeads.length,
      clients: ctx.found.clients.length,
      proposals: ctx.found.proposals.length,
      contractsWon: ctx.found.contracts.length,
      revenue: gained.revenue,
      margin: gained.margin,
    },
    needsCredits: s.monetization.plan === "free" && s.monetization.bidCredits <= 0,
  };
}

/**
 * Run one full acquisition cycle — every agent does its part in sequence.
 */
export function runCycle(s: DemoState, opts?: { niche?: string }): CycleResult {
  s.cycles += 1;
  const ctx = makeCtx(s);
  let gained = { revenue: 0, cost: 0, margin: 0 };

  stepScrape(ctx, opts);
  stepB2B(ctx);
  const nClients = Math.max(1, ctx.found.salesLeads.length);
  for (let i = 0; i < nClients; i++) stepOnboard(ctx);
  if (ctx.found.leads.some((l) => l.status === "Proposal Sent") || ctx.found.clients.length) {
    gained = stepAuction(ctx) ?? gained;
  }

  rollup(s, ctx.found, gained);
  return cycleResult(s, ctx, gained);
}

/**
 * Run a single agent on demand ("Run now" in the command center). Produces
 * only that agent's work and returns the same result shape.
 */
export function runAgent(s: DemoState, agentName: string, opts?: { niche?: string }): CycleResult {
  s.cycles += 1;
  const ctx = makeCtx(s);
  const step = AGENT_STEPS[agentName];
  let gained = { revenue: 0, cost: 0, margin: 0 };
  if (step) gained = step(ctx, opts) ?? gained;
  else ctx.log(agentName, "Manual run — health check OK, standing by");

  rollup(s, ctx.found, gained);
  return cycleResult(s, ctx, gained);
}

/** Operator toggle — pause/resume an agent (recorded in the audit log). */
export function toggleAgent(s: DemoState, agentId: string): Row | undefined {
  const a = s.agents.find((x) => x.id === agentId);
  if (!a) return undefined;
  a.status = a.status === "running" ? "paused" : "running";
  s.auditLog.unshift({
    id: nextId(s, "a"),
    agent: "Operator",
    action: `${a.status === "running" ? "Resumed" : "Paused"} agent '${a.name}'`,
    status: "success",
    time: nowIso(),
  });
  return a;
}

/** Resolve a human-in-the-loop queue item (approve/sign-off). */
export function resolveHitl(s: DemoState, hitlId: string): Row | undefined {
  const h = s.hitl.find((x) => x.id === hitlId);
  if (!h) return undefined;
  h.status = "Resolved";
  s.kpis.hitlOpen = s.hitl.filter((x) => x.status === "Open").length;
  s.auditLog.unshift({
    id: nextId(s, "a"),
    agent: "Operator",
    action: `Resolved HITL '${h.type}' — ${h.entity}`,
    status: "success",
    time: nowIso(),
  });
  return h;
}

/** Persist operator edits to an agent's config (schedule, persona, notes). */
export function updateAgent(s: DemoState, agentId: string, patch: Row): Row | undefined {
  const a = s.agents.find((x) => x.id === agentId);
  if (!a) return undefined;
  Object.assign(a, patch);
  s.auditLog.unshift({
    id: nextId(s, "a"),
    agent: "Operator",
    action: `Updated config for '${a.name}'`,
    status: "success",
    time: nowIso(),
  });
  return a;
}

// --------------------------------------------------------------------------- //
// Connector hub — link platform accounts, publish gigs, track applications
// --------------------------------------------------------------------------- //

export const PLATFORMS_CONNECTABLE = [
  { id: "upwork", name: "Upwork", desc: "Bid on freelance contracts via your Upwork profile." },
  { id: "fiverr", name: "Fiverr", desc: "Publish gigs and receive inbound orders." },
  { id: "linkedin", name: "LinkedIn", desc: "B2B outreach, funded-startup discovery." },
  { id: "reddit", name: "Reddit", desc: "r/forhire, r/slavelabour and niche subreddits." },
  { id: "facebook", name: "Facebook Marketplace", desc: "Local services & marketplace gigs." },
  { id: "twitter", name: "X / Twitter", desc: "Outbound via DMs and keyword alerts." },
  { id: "shopify", name: "Shopify", desc: "Apps, stores and ecommerce gigs for merchants." },
  { id: "freelancer", name: "Freelancer.com", desc: "Bid on projects and contests worldwide." },
  { id: "toptal", name: "Toptal", desc: "Premium client work for vetted talent." },
  { id: "contra", name: "Contra", desc: "Commission-free freelance marketplace." },
  { id: "peopleperhour", name: "PeoplePerHour", desc: "Hourly & fixed-price projects." },
  { id: "guru", name: "Guru", desc: "Long-term client relationships and workrooms." },
  { id: "weworkremotely", name: "We Work Remotely", desc: "Remote job board gigs and contracts." },
  { id: "dribbble", name: "Dribbble", desc: "Design gigs from the Dribbble board." },
  { id: "behance", name: "Behance", desc: "Creative project leads and job posts." },
];

export type ConnectResult = { ok: true; account: Row } | { ok: false; reason: string };
export type GigDraftResult = { ok: true; account?: Row; gig: Row } | { ok: false; reason: string };
export type GigDraftInput = {
  platform: string;
  title: string;
  price: number;
  category: string;
  description?: string;
  deliveryDays?: string;
  packages?: { name: string; price: number; deliveryDays: number; details: string }[];
  titles?: string[];
  tags?: string[];
  faq?: { q: string; a: string }[];
};

/**
 * Connect (or create) a platform profile. Free plan includes 2 profiles;
 * further ones cost a profile credit (purchased at $5.99). Pass
 * `chargeCredits: false` when the server has already spent the credit.
 */
export function connectAccount(
  s: DemoState,
  platform: string,
  handle: string,
  opts: { chargeCredits?: boolean } = {}
): ConnectResult {
  const charge = opts.chargeCredits ?? true;
  if (s.accounts.some((a) => a.platform === platform)) {
    return { ok: false, reason: `${platform} is already connected.` };
  }
  // Profile limits only apply once paid plans can actually be bought (lib/flags.ts).
  if (PAYMENTS_LIVE && charge && s.monetization.plan === "free" && s.monetization.profileCredits <= 0) {
    return { ok: false, reason: "no-credits" };
  }
  if (PAYMENTS_LIVE && charge && s.monetization.plan === "free") s.monetization.profileCredits -= 1;
  const account: Row = {
    id: nextId(s, "acc"),
    platform,
    handle: handle.startsWith("@") ? handle : `@${handle}`,
    status: "Connected",
    connectedAt: nowIso(),
    gigs: 0,
    applications: 0,
  };
  s.accounts.unshift(account);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Connected ${platform} profile ${account.handle}`,
    status: "success", time: nowIso(),
  });
  s.notifications.unshift({
    id: nextId(s, "n"), title: `${platform} connected`,
    body: `Agents can now bid and message through ${account.handle}`, type: "success", time: nowIso(), read: false,
  });
  return { ok: true, account };
}

export function disconnectAccount(s: DemoState, accountId: string): Row | undefined {
  const i = s.accounts.findIndex((a) => a.id === accountId);
  if (i < 0) return undefined;
  const [removed] = s.accounts.splice(i, 1);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Disconnected ${removed.platform} profile ${removed.handle}`,
    status: "warning", time: nowIso(),
  });
  return removed;
}

/** Save a gig draft for manual review and publishing on its platform. */
export function createGig(
  s: DemoState,
  input: GigDraftInput
): GigDraftResult {
  const account = s.accounts.find((a) => a.platform === input.platform);
  const gig: Row = {
    id: nextId(s, "g"),
    platform: input.platform,
    accountId: account?.id,
    title: input.title,
    price: input.price,
    category: input.category,
    description: input.description ?? "",
    deliveryDays: input.deliveryDays ? Number(input.deliveryDays) : undefined,
    packages: input.packages ?? [],
    titles: input.titles ?? [input.title],
    tags: input.tags ?? [],
    faq: input.faq ?? [],
    status: "Draft",
    orders: 0,
    createdAt: nowIso(),
  };
  s.gigs.unshift(gig);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Saved gig draft '${input.title}' for ${input.platform} ($${input.price}) — not published`,
    status: "warning", time: nowIso(),
  });
  return { ok: true, account, gig };
}

/** Pause or resume a gig listing. */
export function toggleGig(s: DemoState, gigId: string): Row | undefined {
  const g = s.gigs.find((x) => x.id === gigId);
  if (!g) return undefined;
  g.status = g.status === "Live" ? "Paused" : "Live";
  return g;
}

/** Remove a gig listing. */
export function removeGig(s: DemoState, gigId: string): Row | undefined {
  const i = s.gigs.findIndex((x) => x.id === gigId);
  if (i < 0) return undefined;
  const [removed] = s.gigs.splice(i, 1);
  const account = s.accounts.find((a) => a.id === removed.accountId);
  if (account) account.gigs = Math.max(0, (account.gigs ?? 1) - 1);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Removed gig '${removed.title}' from ${removed.platform}`,
    status: "warning", time: nowIso(),
  });
  return removed;
}

// --------------------------------------------------------------------------- //
// Monetization — credit packs & plan upgrade (simulated checkout; Stripe needed
// for real charges — see SERVICES.md)
// --------------------------------------------------------------------------- //

export const CREDIT_PACKS = {
  bids: { label: "10 Job Bids", credits: 10, price: 9.9 },
  profiles: { label: "1 Platform Profile", credits: 1, price: 5.99 },
} as const;

export function buyCredits(s: DemoState, kind: "bids" | "profiles"): Row {
  const pack = CREDIT_PACKS[kind];
  if (kind === "bids") s.monetization.bidCredits += pack.credits;
  else s.monetization.profileCredits += pack.credits;
  const purchase: Row = {
    id: nextId(s, "po"),
    item: pack.label,
    amount: pack.price,
    status: "Paid",
    date: nowIso(),
  };
  s.monetization.purchases.unshift(purchase);
  s.billingHistory.unshift(purchase);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Purchased ${pack.label} — $${pack.price}`,
    status: "success", time: nowIso(),
  });
  return purchase;
}

export function upgradePlan(s: DemoState): Row {
  s.monetization.plan = "pro";
  const purchase: Row = {
    id: nextId(s, "po"),
    item: "Pro plan — unlimited bids & profiles",
    amount: 19,
    status: "Paid",
    date: nowIso(),
    recurring: true,
  };
  s.monetization.purchases.unshift(purchase);
  s.billingHistory.unshift(purchase);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: "Upgraded to Pro plan",
    status: "success", time: nowIso(),
  });
  return purchase;
}

// --------------------------------------------------------------------------- //
// Growth — trial/referral engine + outbound campaign tracking
// --------------------------------------------------------------------------- //

/** Whole days remaining on the trial (0 when expired). */
export function trialDaysLeft(g: Growth): number {
  const start = Date.parse(g.trialStartedAt);
  if (Number.isNaN(start)) return g.trialDays;
  const elapsed = (Date.now() - start) / 86_400_000;
  return Math.max(0, Math.ceil(g.trialDays - elapsed));
}

export function trialExtended(g: Growth): boolean {
  return g.trialDays >= TRIAL_EXTENDED_DAYS;
}

function maybeExtendTrial(s: DemoState): boolean {
  if (trialExtended(s.growth)) return false;
  // Anti-cheat: extension requires verification — either a referred friend
  // actually signed up, or shares on 2+ distinct channels plus a real invite.
  const verified = s.growth.referrals.some((r) => r.status === "Signed up");
  const channels = new Set(s.growth.shares.map((x) => x.channel)).size;
  if (!verified && !(channels >= 2 && s.growth.referrals.length >= 1)) return false;
  s.growth.trialDays = TRIAL_EXTENDED_DAYS;
  s.notifications.unshift({
    id: nextId(s, "n"),
    title: "Trial extended to 7 days",
    body: "Thanks for spreading the word — your full-access trial now runs a whole week.",
    type: "success",
    time: nowIso(),
    read: false,
  });
  return true;
}

/** User shared their referral link on a channel → counts toward extension. */
export function recordShare(s: DemoState, channel: string): { extended: boolean } {
  s.growth.shares.unshift({ id: nextId(s, "sh"), channel, at: nowIso() });
  const extended = maybeExtendTrial(s);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Shared referral link on ${channel}${extended ? " — trial extended to 7 days" : ""}`,
    status: "success", time: nowIso(),
  });
  return { extended };
}

/** User referred a friend → tracked invite, counts toward extension. */
export function addReferral(s: DemoState, name: string, channel = "Link"): { referral: Row; extended: boolean } {
  const referral: Row = {
    id: nextId(s, "rf"),
    name,
    channel,
    status: "Invited",
    at: nowIso(),
  };
  s.growth.referrals.unshift(referral);
  const extended = maybeExtendTrial(s);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Referred ${name}${extended ? " — trial extended to 7 days" : ""}`,
    status: "success", time: nowIso(),
  });
  return { referral, extended };
}

/** A referred friend actually signed up (webhook/attribution) — mark converted. */
export function markReferralSignedUp(s: DemoState, id: string): Row | undefined {
  const r = s.growth.referrals.find((x) => x.id === id);
  if (r) {
    r.status = "Signed up";
    maybeExtendTrial(s);
  }
  return r;
}

// --- Agency outreach ------------------------------------------------------- //

export function addAgency(s: DemoState, input: { name: string; email: string; focus?: string; size?: string; notes?: string }): Row {
  const agency: Row = {
    id: nextId(s, "ag"),
    name: input.name,
    email: input.email,
    focus: input.focus ?? "",
    size: input.size ?? "",
    notes: input.notes ?? "",
    status: "Target",
  };
  s.growth.agencies.unshift(agency);
  return agency;
}

export function removeAgency(s: DemoState, id: string): void {
  s.growth.agencies = s.growth.agencies.filter((a) => a.id !== id);
}

/** Move an agency through the pipeline: Target → Contacted → Replied → Converted. */
export function patchAgency(s: DemoState, id: string, patch: Row): Row | undefined {
  const row = s.growth.agencies.find((a) => a.id === id);
  if (row) Object.assign(row, patch);
  return row;
}

/** Record a campaign (draft or sent) + per-recipient results. */
export function saveCampaign(
  s: DemoState,
  input: { name: string; offer: string; subject: string; body: string; sent: number; failed: number; status: string; results?: Row[] }
): Row {
  const campaign: Row = {
    id: nextId(s, "cp"),
    ...input,
    results: input.results ?? [],
    opened: 0,
    replied: 0,
    createdAt: nowIso(),
  };
  s.growth.campaigns.unshift(campaign);
  for (const a of s.growth.agencies) {
    if (a.status === "Target" && input.status === "Sent") a.status = "Contacted";
  }
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Campaign "${input.name}" — ${input.sent} sent, ${input.failed} failed`,
    status: input.failed ? "warning" : "success", time: nowIso(),
  });
  return campaign;
}

/** Saved outreach copy the user wants to reuse across campaigns. */
export function saveTemplate(s: DemoState, input: { name: string; subject: string; body: string }): Row {
  const row: Row = { id: nextId(s, "tp"), ...input, createdAt: nowIso() };
  s.growth.templates.unshift(row);
  return row;
}

export function removeTemplate(s: DemoState, id: string): void {
  s.growth.templates = s.growth.templates.filter((t) => t.id !== id);
}

/** Per-campaign engagement updates (opens/replies as the user observes them). */
export function patchCampaign(s: DemoState, id: string, patch: Row): Row | undefined {
  const row = s.growth.campaigns.find((c) => c.id === id);
  if (row) Object.assign(row, patch);
  return row;
}

// --- Platform outreach (compliant: draft → review → copy/open → send) ------ //

export function addOutreachTarget(
  s: DemoState,
  input: { platform: string; target: string; profileUrl?: string; note?: string }
): Row {
  const row: Row = {
    id: nextId(s, "om"),
    platform: input.platform,
    target: input.target,
    profileUrl: input.profileUrl ?? "",
    note: input.note ?? "",
    message: "",
    status: "Draft",
    at: nowIso(),
  };
  s.growth.outreach.unshift(row);
  return row;
}

export function patchOutreach(s: DemoState, id: string, patch: Row): Row | undefined {
  const row = s.growth.outreach.find((o) => o.id === id);
  if (row) Object.assign(row, patch);
  return row;
}

export function removeOutreach(s: DemoState, id: string): void {
  s.growth.outreach = s.growth.outreach.filter((o) => o.id !== id);
}

// --------------------------------------------------------------------------- //
// Job Radar — searches, application pipeline, retention
// --------------------------------------------------------------------------- //

const APP_STAGES = ["Saved", "Drafted", "Applied", "Interview", "Won", "Lost", "Ghosted"] as const;
export { APP_STAGES };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A scan happened — bumps the daily streak + visit timestamp. */
export function radarRecordScan(s: DemoState, query: string, newCount: number): void {
  const today = todayKey();
  const last = s.radar.lastScanDate;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    s.radar.scanStreak = last === yesterday ? s.radar.scanStreak + 1 : 1;
    s.radar.lastScanDate = today;
  }
  s.radar.lastVisitAt = nowIso();
  const search = s.radar.savedSearches.find((x) => x.query === query);
  if (search) {
    search.newSinceLast = newCount;
    search.lastScanAt = nowIso();
  }
}

export function radarSaveSearch(s: DemoState, name: string, query: string): Row {
  const existing = s.radar.savedSearches.find((x) => x.query === query);
  if (existing) { existing.name = name; return existing; }
  const row: Row = { id: nextId(s, "ss"), name, query, lastScanAt: "", lastCount: 0, newSinceLast: 0 };
  s.radar.savedSearches.unshift(row);
  return row;
}

export function radarRemoveSearch(s: DemoState, id: string): void {
  s.radar.savedSearches = s.radar.savedSearches.filter((x) => x.id !== id);
}

/** Track a job through the pipeline. Creates it at stage "Saved" if new. */
export function radarTrackJob(
  s: DemoState,
  job: Row,
  stage: (typeof APP_STAGES)[number] = "Saved",
  proposal = ""
): Row {
  const existing = s.radar.applications.find((a) => a.jobId === job.id);
  if (existing) {
    existing.stage = stage;
    if (proposal) existing.proposal = proposal;
    return existing;
  }
  const app: Row = {
    id: nextId(s, "ap"),
    jobId: job.id,
    title: job.title,
    company: job.company,
    url: job.url,
    source: job.source,
    budget: job.budget ?? null,
    stage,
    proposal,
    appliedAt: nowIso(),
    notes: "",
  };
  s.radar.applications.unshift(app);
  s.auditLog.unshift({
    id: nextId(s, "a"), agent: "Operator",
    action: `Tracked application — ${job.title} → ${stage}`,
    status: "success", time: nowIso(),
  });
  return app;
}

export function radarPatchApp(s: DemoState, id: string, patch: Row): Row | undefined {
  const row = s.radar.applications.find((a) => a.id === id);
  if (row) Object.assign(row, patch);
  return row;
}

export function radarRemoveApp(s: DemoState, id: string): void {
  s.radar.applications = s.radar.applications.filter((a) => a.id !== id);
}

export function radarToggleSaved(s: DemoState, jobId: string): boolean {
  const i = s.radar.saved.indexOf(jobId);
  if (i >= 0) { s.radar.saved.splice(i, 1); return false; }
  s.radar.saved.push(jobId);
  return true;
}

export function radarDismiss(s: DemoState, jobId: string): void {
  if (!s.radar.dismissed.includes(jobId)) s.radar.dismissed.push(jobId);
  // Dismissing also un-saves it if it was bookmarked.
  s.radar.saved = s.radar.saved.filter((x) => x !== jobId);
}

export function radarSetGoal(s: DemoState, goal: number): void {
  s.radar.weeklyGoal = Math.max(1, Math.min(50, Math.round(goal)));
}

/** Applications created in the current ISO week — drives the goal ring. */
export function radarWeeklyCount(s: DemoState): number {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return s.radar.applications.filter(
    (a) => Date.parse(a.appliedAt) > weekAgo && a.stage !== "Saved"
  ).length;
}
