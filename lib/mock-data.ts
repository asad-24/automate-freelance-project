// Central mock/static data layer. Everything the frontend renders comes from here.
// A single boundary so swapping to real FastAPI endpoints later is trivial.

export type Status = string;

export const kpis = { liveMargin: 0, marginTrend: 0, activeContracts: 0, contractsTrend: 0, winRate: 0, winRateTrend: 0, jobsApplied: 0, jobsTrend: 0, freelancersActive: 0, hitlOpen: 0, apiOverheadMonth: 0, revenueMonth: 0 };

export const marginTimeseries = [
  { month: "Apr", revenue: 42000, cost: 22000, margin: 20000 },
  { month: "May", revenue: 51000, cost: 26000, margin: 25000 },
  { month: "Jun", revenue: 63000, cost: 31000, margin: 32000 },
  { month: "Jul", revenue: 58000, cost: 27000, margin: 31000 },
  { month: "Aug", revenue: 79000, cost: 36000, margin: 43000 },
  { month: "Sep", revenue: 96400, cost: 48150, margin: 48250 },
].map((m: any) => ({ ...m, revenue: 0, cost: 0, margin: 0 }));

export const funnelData = [
  { stage: "Leads Scraped", value: 1240 },
  { stage: "Bids Submitted", value: 480 },
  { stage: "Replies", value: 190 },
  { stage: "Contracts Won", value: 62 },
  { stage: "Delivered", value: 51 },
  { stage: "Paid", value: 48 },
].map((f: any) => ({ ...f, value: 0 }));

export const marginByProject: any[] = [];

export const agents = [
  {
    id: "agent-1",
    name: "Job Hunter",
    subtitle: "Direct Employment",
    description: "Finds & applies to LA/Remote Software/AI roles on autopilot via JobSpy + Playwright.",
    status: "running",
    lastRun: "2026-09-16T08:12:00Z",
    schedule: "Daily @ 06:00",
    runsToday: 8,
    successRate: 92,
    icon: "briefcase",
  },
  {
    id: "agent-2",
    name: "Marketing & Sales",
    subtitle: "B2B Direct",
    description: "Scrapes Clutch.co/LinkedIn for funded startups, runs cold email via n8n, builds micro-sites.",
    status: "running",
    lastRun: "2026-09-16T09:00:00Z",
    schedule: "Every 6h",
    runsToday: 4,
    successRate: 71,
    icon: "megaphone",
  },
  {
    id: "agent-3",
    name: "Bidding & Acquisition",
    subtitle: "Freelance Job Finder",
    description: "Scrapes Upwork/Fiverr/Reddit every 2h, analyses margin, writes RAG proposals, submits bids.",
    status: "running",
    lastRun: "2026-09-16T10:00:00Z",
    schedule: "Every 2h",
    runsToday: 5,
    successRate: 34,
    icon: "gavel",
  },
  {
    id: "agent-4",
    name: "Stealth Client Manager",
    subtitle: "Comms & Upsell",
    description: "Human-persona client comms via Rocket.Chat + Claude, upsell engine, voice fallback.",
    status: "paused",
    lastRun: "2026-09-16T07:30:00Z",
    schedule: "Realtime",
    runsToday: 23,
    successRate: 88,
    icon: "messages-square",
  },
  {
    id: "agent-5",
    name: "Arbitrage Dispatcher",
    subtitle: "Freelancer Finder",
    description: "Broadcasts specs to 10-20 vetted freelancers, runs blind auction, auto-awards by ROI score.",
    status: "running",
    lastRun: "2026-09-16T09:45:00Z",
    schedule: "On contract win",
    runsToday: 3,
    successRate: 79,
    icon: "network",
  },
  {
    id: "agent-6",
    name: "QA & Delivery",
    subtitle: "Quality Gate",
    description: "Runs ESLint/Black/Pytest/Jest + SonarQube on freelancer PRs, delivers on pass.",
    status: "error",
    lastRun: "2026-09-16T06:50:00Z",
    schedule: "On PR push",
    runsToday: 11,
    successRate: 95,
    icon: "shield-check",
  },
  {
    id: "agent-7",
    name: "Gig Studio",
    subtitle: "Gig Builder",
    description: "AI gig architect — titles, packages, pricing tiers, FAQ and imagery, then publishes to connected platforms.",
    status: "paused",
    lastRun: "2026-09-15T18:20:00Z",
    schedule: "Manual only",
    runsToday: 0,
    successRate: 86,
    icon: "package",
  },
  {
    id: "agent-8",
    name: "Prospect Scout",
    subtitle: "Target Finder",
    description: "Builds outreach target lists — agencies, funded startups, hiring posts — straight into your campaigns.",
    status: "paused",
    lastRun: "2026-09-15T15:05:00Z",
    schedule: "Daily @ 06:00",
    runsToday: 0,
    successRate: 74,
    icon: "target",
  },
].map((a: any) => ({ ...a, status: "idle", runsToday: 0, lastRun: null, successRate: 0 }));

export const appliedJobs: any[] = [];

export const freelanceLeads: any[] = [];

export const proposals: any[] = [];

export const salesLeads: any[] = [];

export const emailSequences: any[] = [];

export const clients: any[] = [];

export const contracts: any[] = [];

export const milestones: any[] = [];

export const freelancers: any[] = [];

export const blindBids: any[] = [];

export const conversations: any[] = [];

export const chatMessages: any[] = [];

export const voiceCalls: any[] = [];

export const qaRuns: any[] = [];

export const deliverables: any[] = [];

export const hitlQueue: any[] = [];

export const invoices: any[] = [];

export const payouts: any[] = [];

export const marketArbitrage: any[] = [];

export const competitors: any[] = [];

export const portfolioItems: any[] = [];

export const personas: any[] = [];

export const integrations = [
  { id: "int-stripe", name: "Stripe", category: "Payments", status: "Connected", desc: "Escrow, Checkout & Connect mass payouts." },
  { id: "int-github", name: "GitHub", category: "Code/QA", status: "Connected", desc: "PRs, GitHub Actions CI/CD gate." },
  { id: "int-rocket", name: "Rocket.Chat", category: "Comms", status: "Connected", desc: "Omnichannel messaging routed through AI." },
  { id: "int-whatsapp", name: "WhatsApp Business", category: "Comms", status: "Connected", desc: "Freelancer & client messaging." },
  { id: "int-discord", name: "Discord", category: "Comms", status: "Connected", desc: "Freelancer spec broadcast bots." },
  { id: "int-gmail", name: "Gmail / SMTP", category: "Comms", status: "Connected", desc: "Cold email sequences via n8n." },
  { id: "int-cal", name: "Cal.com", category: "Scheduling", status: "Connected", desc: "Discovery call booking." },
  { id: "int-n8n", name: "n8n", category: "Automation", status: "Connected", desc: "Workflow automation hub." },
  { id: "int-odoo", name: "Odoo CRM", category: "CRM/Invoicing", status: "Disconnected", desc: "Invoicing & late-fee chasing." },
  { id: "int-vapi", name: "Vapi.ai", category: "Voice", status: "Connected", desc: "AI voice discovery calls." },
  { id: "int-ollama", name: "Ollama", category: "LLM", status: "Connected", desc: "Local llama3 for low-stakes tasks." },
  { id: "int-claude", name: "Anthropic Claude", category: "LLM", status: "Connected", desc: "Client-facing high-quality comms." },
  { id: "int-chroma", name: "ChromaDB", category: "Vector DB", status: "Connected", desc: "RAG for portfolio & proposals." },
  { id: "int-scrapoxy", name: "Scrapoxy", category: "Proxies", status: "Connected", desc: "Residential proxy rotation." },
].map((i: any) => ({ ...i, status: "Disconnected" }));

export const auditLog: any[] = [];

export const notifications: any[] = [];

export const dashboardUsers: any[] = [];

export const affiliateEvents: any[] = [];

// ---- Monetization / subscriptions ----
export const subscriptionPlans = [
  {
    id: "free",
    name: "Basic",
    price: 0,
    audience: "Try the platform",
    features: ["10 job bids included", "2 platform profile slots", "Job Radar scans", "Community support"],
    highlight: false,
  },
  {
    id: "plus",
    name: "Plus",
    price: 9,
    audience: "Freelancers getting started",
    features: ["50 job bids / month", "5 platform profiles", "AI Gig Builder", "Agency outreach tools", "Email support"],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    audience: "Serious freelancers & agencies",
    features: ["Unlimited bids & profiles", "Priority job matching", "Full outreach + campaign suite", "Client portal & invoice chasing", "Priority support"],
    highlight: true,
  },
];

export const revenueStreams: any[] = [];

export const addonMarketplace = [
  { id: "ad1", name: "Featured Listing", price: "$29/mo", for: "Freelancers", desc: "Appear first in the blind-auction pool" },
  { id: "ad2", name: "Priority Dispatch", price: "$49/mo", for: "Freelancers", desc: "Get specs 1 hour before the general pool" },
  { id: "ad3", name: "Verified Badge", price: "$19/mo", for: "Freelancers", desc: "Blue checkmark + trust boost on bids" },
  { id: "ad4", name: "Expedited Delivery", price: "$199/project", for: "Clients", desc: "Fast-track your project to top-rated freelancers" },
  { id: "ad5", name: "Dedicated PM Hours", price: "$150/10h", for: "Clients", desc: "Extra human project-manager attention" },
  { id: "ad6", name: "Voice AI Minutes", price: "$0.40/min", for: "Agencies", desc: "AI discovery calls billed per minute" },
  { id: "ad7", name: "Custom Micro-site Domain", price: "$15/mo", for: "Agencies", desc: "clientname.youragency.com branding" },
  { id: "ad8", name: "Market Rate Reports", price: "$99/mo", for: "Agencies", desc: "Weekly arbitrage & pricing intelligence" },
  { id: "ad9", name: "White-Label Pack", price: "$199/mo", for: "Agencies", desc: "Remove all Autopilot branding" },
];

export const billingHistory: any[] = [];

// ---- Freelancer-portal specific views ----
export const freelancerOpenSpecs: any[] = [];

export const freelancerMyBids: any[] = [];

export const freelancerContracts: any[] = [];

export const freelancerEarnings: any[] = [];

// ---- Client-portal specific views ----
export const clientProjects: any[] = [];

export const clientFiles: any[] = [];

export const clientInvoices: any[] = [];

// ---- API Vault — centrally managed credentials (masked; real keys live in env/secrets) ----
export const apiCredentials: any[] = [];

export const securityControls = [
  { id: "sec1", control: "Secrets in env vars only — never in repo or logs", area: "Secrets", status: "Enforced" },
  { id: "sec2", control: "Security headers (X-Frame-Options, nosniff, Referrer-Policy)", area: "HTTP", status: "Enforced" },
  { id: "sec3", control: "Per-IP rate limiting (240 req/min sliding window)", area: "Abuse", status: "Enforced" },
  { id: "sec4", control: "X-Request-Id on every request for audit correlation", area: "Observability", status: "Enforced" },
  { id: "sec5", control: "Optional X-API-Key gate for mutating endpoints", area: "Auth", status: "Configured" },
  { id: "sec6", control: "CORS allowlist (frontend origin only)", area: "HTTP", status: "Enforced" },
  { id: "sec7", control: "Credential rotation schedule (30/60/90-day by tier)", area: "Secrets", status: "In progress" },
  { id: "sec8", control: "pip-audit + npm audit in CI (supply chain)", area: "Dependencies", status: "Planned" },
  { id: "sec9", control: "JWT auth + RBAC (admin/operator/viewer)", area: "Auth", status: "Planned" },
  { id: "sec10", control: "Webhook signature verification (Stripe, GitHub)", area: "Webhooks", status: "Planned" },
];

export const securityEvents: any[] = [];

// ---- User testing ----
export const userTestScenarios = [
  { id: "ut1", role: "Admin", scenario: "Start/pause each agent from Command Center", status: "Passed", tester: "Alex", notes: "All 6 agents toggle correctly" },
  { id: "ut2", role: "Admin", scenario: "Broadcast a spec to freelancer pool", status: "Passed", tester: "Alex", notes: "Toast + audit entry confirmed" },
  { id: "ut3", role: "Admin", scenario: "Approve a pending payout", status: "In progress", tester: "Riley", notes: "Verifying audit trail" },
  { id: "ut4", role: "Admin", scenario: "Resolve a HITL escalation", status: "In progress", tester: "Riley", notes: "" },
  { id: "ut5", role: "Admin", scenario: "Click every stat card → lands on detail page", status: "Planned", tester: "Sam", notes: "Full click-through sweep" },
  { id: "ut6", role: "Freelancer", scenario: "Browse open specs and submit a bid", status: "Passed", tester: "Priya", notes: "Bid appears in My Bids" },
  { id: "ut7", role: "Freelancer", scenario: "Check QA status on a submitted PR", status: "In progress", tester: "Priya", notes: "" },
  { id: "ut8", role: "Freelancer", scenario: "Activate a paid boost from billing", status: "Planned", tester: "Priya", notes: "" },
  { id: "ut9", role: "Client", scenario: "Approve a milestone and pay invoice", status: "Passed", tester: "Jordan", notes: "Escrow flow clear to user" },
  { id: "ut10", role: "Client", scenario: "Send a message to the team", status: "Passed", tester: "Jordan", notes: "" },
  { id: "ut11", role: "Client", scenario: "Upgrade plan from billing page", status: "In progress", tester: "Jordan", notes: "Testing trial CTA clarity" },
  { id: "ut12", role: "Public", scenario: "Signup → role form → dashboard entry", status: "Planned", tester: "Sam", notes: "All 3 role forms" },
];

export const userFeedback: any[] = [];
