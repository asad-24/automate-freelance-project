# Autonomous AI Agency & Career Ecosystem

> **Architecture Blueprint v2.0 → Engineering README**
> A fully autonomous, closed-loop revenue-generation platform that automates the entire lifecycle of a
> freelance/agency business **and** a personal job hunt — from lead acquisition and client conversation, to
> freelancer arbitrage, QA, delivery, and capital capture — requiring human intervention only for capital
> withdrawal and explicit Human-in-the-Loop (HITL) escalations.

---

## Table of Contents

The **Capital workspace** now includes sandbox project funding, protection and
claims, reviewed agency/freelancer/platform listings, private investor commitments,
and wallet/token readiness screens. These flows never move real money or issue a
token. See [the implementation and setup guide](docs/finance-sandbox.md), including
the new explicit owner-provisioning requirement for reviewers.

0. [Current Build Status](#0-current-build-status) — *what is implemented today*
1. [Executive Summary & The "Autopilot" Loop](#1-executive-summary--the-autopilot-loop)
2. [System Architecture & Tech Stack](#2-system-architecture--tech-stack)
3. [Monorepo Layout](#3-monorepo-layout)
4. [The Autonomous Agent Matrix](#4-the-autonomous-agent-matrix)
5. [20+ Revenue-Maximizing Tools & Strategies](#5-20-revenue-maximizing-tools--strategies)
6. [Database Requirements](#6-database-requirements)
7. [Backend Requirements](#7-backend-requirements)
8. [APIs & Integrations](#8-apis--integrations)
9. [Automation Workflows](#9-automation-workflows)
10. [**Page 0 — Complete Frontend (Build This First)**](#10-page-0--complete-frontend-build-this-first)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Risk Management, Security & Compliance](#12-risk-management-security--compliance)
13. [Local Development & Configuration](#13-local-development--configuration)
14. [Requirements Traceability Matrix](#14-requirements-traceability-matrix)

---

## 1. Executive Summary & The "Autopilot" Loop

The system is a continuous, closed-loop **"Autopilot Cycle"**. Each stage is handled by autonomous agents and
is observable/controllable from the dashboard.

| # | Stage | Description |
|---|-------|-------------|
| 1 | **Acquisition (Bidding)** | Autonomous bots scrape job boards (Upwork, Fiverr, Reddit `r/forhire`, B2B direct) for high-margin projects and submit tailored bids. |
| 2 | **Conversion (Comms)** | AI agents communicate with clients like a human account executive — scoping work, building trust, closing contracts. |
| 3 | **Fulfillment (Arbitrage)** | The system translates the scope into a technical spec and broadcasts it to a global pool of vetted freelancers, creating a blind bidding war to secure the lowest cost. |
| 4 | **Delivery (QA & Upsell)** | The winning freelancer's code passes automated CI/CD quality gates. The AI delivers to the client and upsells retainers/add-ons. |
| 5 | **Capital Capture** | Funds collected via Stripe (escrow), freelancer paid via automated mass-payout (Stripe Connect), margin logged. |

> **Core Directive:** Maximize development velocity by leveraging mature, open-source infrastructure. We do
> **not** reinvent wheels. We build only the **glue code**, the **proprietary business logic**, and the
> **system prompts**.

---

## 0. Current Build Status

| Layer | Status | Details |
|-------|--------|---------|
| **Frontend** | ✅ Complete | Next.js 14 App Router, 76 routes — public/marketing, auth, admin dashboard (32 pages), freelancer portal, client portal, dev index `/dev`. |
| **Backend API** | ✅ Complete (in-memory) | FastAPI app in [`backend/`](backend/) — ~70 REST endpoints covering the full §7 API surface, CORS-ready, OpenAPI docs at `/docs`. **In-memory store today** (no DB connected yet); seeded to mirror the frontend mock data 1:1. |
| **Command Center** | ✅ Complete | `/dashboard/command` — single-pane control of the whole agency: clickable KPIs, agent fleet toggles, revenue streams, HITL resolution, contract progress, security posture, live audit feed, notifications. |
| **Security & API Vault** | ✅ Complete | `/dashboard/security` — centrally managed credentials (masked keys, connect/rotate actions), security-control checklist, security events. Backend hardening live: security headers, per-IP rate limiting, `X-Request-Id`, optional `X-API-Key` gate (`API_KEY` env). |
| **User Testing** | ✅ Complete | `/dashboard/user-testing` — click-through scenario checklist per role (advance/reset status), pass-rate tracking, tester feedback log. |
| **Client Onboarding** | ✅ Complete | `/dashboard/onboarding` — 4-step wizard (client → project → milestones → review) that creates client + contract + milestones via `POST /api/onboarding`. First client seeded: **Platinum Sound Records — AI Music Production Hub** (spec: [`docs/ai-music-hub-mvp.md`](docs/ai-music-hub-mvp.md)). |
| **Frontend ↔ Backend wiring** | ✅ Complete | `lib/api.ts` + `useEntity`/`getEntity`/`useEntityQuery` hydrate every data-driven page from the API when `NEXT_PUBLIC_API_URL` is set; graceful fallback to mock data otherwise. Action buttons POST to the API (agent control, HITL, payouts, bids, messages, settings, billing, credential rotation, onboarding). **All stat cards and key table rows are clickable** and navigate to the relevant detail page. |
| **Database** | ⏳ Not connected | Schema designed in §6; swap `backend/app/store.py` for SQLAlchemy repositories later — routers unchanged. |
| **Auth / RBAC** | ⏳ Stub | JWT hooks reserved + optional `X-API-Key` gate; full auth in a later phase. |
| **Automation & agents** | ⏳ Pending | LangGraph/Celery/Playwright workers in a later phase. |
| **External integrations** | ⏳ Pending | See [`API.md`](API.md) — accounts are **managed by the agency vault** (dedicated email + password manager + 2FA), not the client. |

### Current delivery for the five platform capabilities

| Capability | Current implementation | Boundary |
|---|---|---|
| **Unified inbox and replies** | Per-user forwarded messages and optional read-only Outlook mailbox sync share one normalized inbox, deduplicate messages, and save reply drafts. Approved Outlook connections are polled every 15 minutes; users can also sync manually. | Outlook sync requires Nango, Microsoft `Mail.Read` consent, a reviewed sender allowlist, and `OUTLOOK_INBOX_READ_APPROVED=true`. Replies are still copied and sent manually; direct marketplace API sync is not connected. |
| **Job finder** | Radar matches saved skills against six public feeds that permit reuse (RemoteOK, We Work Remotely, Jobicy, Arbeitnow, Himalayas, 4 Day Week). Feeds are fetched once per source and shared across users; scheduled scans can alert on strong matches. Users can watch companies' public careers boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee) from the Companies tab. | 28 sources are registered in `backend/app/job_sources.py`. The rest stay off until their approval (`JOB_SOURCES_APPROVED`) or API key is configured. These include Remotive, Hacker News, Reddit, Topcoder, Dribbble Jobs, the keyed search APIs, all company-board providers, Upwork, and Freelancer.com. |
| **Bidding** | Creates personalized proposal drafts, applies per-user limits, and requires explicit review. Freelancer.com sandbox records can be exercised. | No cross-platform automatic bidding; live submission requires provider permission and credentials. Upwork proposals remain manual. |
| **Gig posting** | Builds and saves reusable drafts with copy controls and editor links. | Publishing or updating gigs is done manually on each platform. |
| **Account/email creation** | Provides official signup links and per-user setup checklists for 46 platforms. | The app does not create third-party accounts or email inboxes; users complete registration and verification themselves. |

Deployment steps for Vercel and Render are in [`docs/deployment.md`](docs/deployment.md); the pre-release checklist and `npm run qa` checks are in [`docs/launch-readiness.md`](docs/launch-readiness.md). The capability map covers 79 platforms (`lib/platforms.ts`). Platform-specific evidence and open approvals are tracked in [`docs/platform-matrix.md`](docs/platform-matrix.md).

### Backend quickstart

```bash
cd backend
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/health   http://localhost:8000/docs
```

```bash
# frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

---

## 2. System Architecture & Tech Stack

The blueprint's open-source-first stack is preserved. A small number of components are marked
**[Recommended change]** where a more maintainable/robust alternative exists — the **functionality and purpose
are identical**.

| Component | Tool | License | Purpose |
|-----------|------|---------|---------|
| Agent Orchestration | **LangGraph** | MIT | Stateful, cyclical multi-agent orchestration for complex workflows. |
| Browser Automation | **Playwright + Botasaurus** | Apache-2.0 | Stealth browsing, CAPTCHA handling, DOM manipulation, human-like emulation. |
| Job Board Scraping | **JobSpy** | MIT | Unified API for LinkedIn, Indeed, Glassdoor, ZipRecruiter. |
| Vector Database | **ChromaDB** | Apache-2.0 | RAG storage for portfolios, past proposals, sales scripts, semantic matching. |
| Relational DB | **PostgreSQL** | PostgreSQL | Primary datastore: users, jobs, margins, contracts, freelancer profiles. |
| Backend API | **FastAPI** | MIT | High-performance async Python backend. |
| Task Queue | **Celery + Redis** | BSD / (Redis: RSALv2/SSPL — see note) | Async processing, rate-limiting, scheduled/cron tasks. |
| Frontend Dashboard | **Next.js (App Router) + shadcn/ui + Tailwind CSS** | MIT | Admin panel to monitor margins, bots, and interventions. |
| Comms Routing | **Rocket.Chat** | MIT | Omnichannel messaging (Web, WhatsApp, Email) routed through AI. |
| Workflow Automation | **n8n** | Sustainable Use License | Self-hosted Zapier alternative for Stripe webhooks, CRM, alerts. Internal use only (non-redistributable). |
| Local LLM | **Ollama (llama3 / llama3.1)** | MIT | Runs LLMs locally for high-volume, low-stakes tasks to cut API costs. |
| Client-facing LLM | **Anthropic Claude (Sonnet)** | Commercial API | High-quality client communication and reasoning. |
| Voice Agent | **Vapi.ai** *(or)* **Whisper (STT) + Piper/Tortoise-TTS (TTS)** | API / MIT | AI voice for "discovery calls." **[Recommended change]**: Tortoise-TTS is slow for real-time; use **Piper** or **XTTS** for low-latency voice. |
| Scraper Data/Analytics | **Scrapy + Pandas + scikit-learn** | BSD | Market-rate arbitrage, dynamic pricing, competitor monitoring. |
| Proxy Rotation | **Scrapoxy** | MIT | Route Playwright/Scrapy traffic through residential IPs. |
| CI/CD & Code QA | **GitHub Actions + SonarQube (Community) + ESLint/Black/Pytest/Jest** | Various OSS | Freelancer code quality gate. |
| Sentiment/NLP | **HuggingFace Transformers** | Apache-2.0 | Sentiment/frustration detection for escalation. |
| Doc Generation | **Pandoc + Python AST** | GPL / PSF | White-label deliverable branding, release notes. **[Note]**: Pandoc is GPL — invoke as an external CLI (not linked) to avoid copyleft contamination. |
| White-Label Client Portal | **Next.js routes** (blueprint alt: Appsmith + Keycloak) | MIT | Branded per-client portal + auth/SSO. **[Decision]** Page 0 builds the portal as Next.js routes in the same app for one consistent codebase; Appsmith + Keycloak remains a documented alternative. |
| Scheduling | **Cal.com** | AGPL | Discovery-call scheduling. **[Note]**: AGPL — self-host, no code linking. |

**Recommended-change rationale (functionality preserved):**
- **Tortoise-TTS → Piper/XTTS** for real-time voice latency (Tortoise cannot sustain live conversation).
- **Redis license note:** modern Redis is RSALv2/SSPL; **Valkey** (BSD) is a drop-in alternative if a fully-permissive license is required. Celery/broker functionality is identical.
- **`Resemble.js` → `pixelmatch`/Playwright visual comparisons + LLM selector-repair.** The blueprint names "Resemble.js" for visual regression; the maintained tool for pixel diffing is `pixelmatch`/`resemblejs` (npm). Functionality — detect DOM/UI drift and auto-patch selectors — is unchanged.

---

## 3. Monorepo Layout

**Turborepo** monorepo (as specified). Suggested structure:

```
/ (turborepo root)
├─ apps/
│  ├─ dashboard/            # Next.js (App Router) admin dashboard  ← PAGE 0 lives here
│  ├─ api/                  # FastAPI backend
│  └─ workers/              # Celery workers + beat schedules
├─ packages/
│  ├─ ui/                   # Shared shadcn/ui component library + design tokens
│  ├─ agents/               # LangGraph agent graphs (Job Hunter, Sales, Bidding, Comms, Arbitrage, QA)
│  ├─ scrapers/             # Playwright/Botasaurus + JobSpy + Scrapy modules
│  ├─ core/                 # Shared Python domain logic, pydantic schemas, scoring algorithms
│  ├─ llm/                  # LLM routing (Claude vs Ollama), prompt templates, RAG (ChromaDB) helpers
│  └─ config/              # Shared TS/ESLint/TSConfig, env schema
├─ infra/
│  ├─ docker-compose.yml    # Postgres, Redis, ChromaDB, Rocket.Chat, n8n, SonarQube, Ollama
│  └─ k8s/ (optional)
└─ .github/workflows/       # CI: lint, test, pip-audit, npm audit; freelancer-code QA gate
```

---

## 4. The Autonomous Agent Matrix

All agents are implemented as **LangGraph** state machines and dispatched/scheduled via **Celery**. Every agent
writes structured events to Postgres and streams status to the dashboard over WebSockets.

### Agent 1 — The Job Hunter (Direct Employment)
Finds and applies to LA/Remote Software/AI roles on autopilot.
- **Execution:** JobSpy pulls daily feeds → ChromaDB compares JD to master résumé → if **match > 80%**, LangGraph tailors the résumé → Playwright navigates **Greenhouse/Lever** to auto-fill and submit.
- **Rate limiting:** Celery enforces **max 10 applications/day** at randomized intervals.

### Agent 2 — Marketing & Sales Engine (B2B Direct)
Bypasses marketplace fees by hunting direct B2B clients.
- **Scraping:** Playwright scrapes **Clutch.co** and **LinkedIn** for newly funded startups.
- **Outreach:** n8n + Gmail orchestrates cold-email sequences.
- **Landing Pages:** On prospect click, Next.js dynamically generates a personalized micro-site (`startupname.ouragency.com`) showing relevant portfolio pieces.
- **Sales AI:** LangGraph handles replies, objection handling, schedules discovery calls via **Cal.com**.

### Agent 3 — Bidding & Acquisition Layer (Freelance Job Finder)
Autonomously finds, evaluates, and bids on **Upwork, Fiverr, Reddit (r/forhire)**.
- **Monitoring:** Playwright persistent context (residential proxies) logs into Upwork, scrapes RSS feed + "Best Matches" **every 2 hours**.
- **Margin Analysis:** LangGraph extracts client budget; if **budget > $500**, computes potential margin.
- **Proposal Generation:** LangGraph + ChromaDB (RAG) pulls past successful proposals + relevant portfolio; writes a specific, **non-templated ~150-word** pitch.
- **Submission:** Playwright submits proposal via the Upwork UI.

### Agent 4 — Stealth Client Manager (Comms & Upsell)
Manages client comms post-win; maximizes LTV.
- **Comms:** Integrated via Rocket.Chat; uses **Claude Sonnet** with strict "Human Persona" system prompts.
- **Human-like behavior:** 15–45s natural typing delays, casual phrasing ("Gotcha," "Makes sense"), and (in Stealth mode) minor auto-corrected typos to reduce AI-detection signal. *(See [Compliance mode](#12-risk-management-security--compliance).)*
- **Upsell Engine:** Detects upsell triggers in scope and organically pitches high-margin add-ons (e.g., "add a CI/CD pipeline with GitHub Actions for $800").
- **Voice Fallback:** If the client insists on a Zoom/phone call, an AI voice agent (Vapi.ai, or Whisper + Piper/XTTS) conducts the call and feeds requirements back to the DB.

### Agent 5 — Dynamic Arbitrage Dispatcher (Freelancer Finder)
Pits freelancers against each other for best quality at lowest cost.
- **Broadcasting:** On win, translates the client brief into an unambiguous technical spec, broadcast to **10–20 vetted freelancers** simultaneously via Rocket.Chat, Discord bots, and WhatsApp API.
- **Blind Bidding:** Requests estimated hours + rate; **client's actual budget is never disclosed**.
- **Algorithmic Selection:** Custom Python scoring algorithm ranks bids on **Cost vs. Client Budget (Margin)**, **Historical Quality Score** (Postgres), and **Time to Deliver**; auto-awards to highest ROI.
- **NDA Shielding:** Client never learns the freelancer exists; freelancer never learns the client's identity. The bot is a strict intermediary.

### Agent 6 — QA & Delivery Engine
Ensures we never pay for or deliver broken code.
- **CI/CD Gate:** Freelancers push to an isolated GitHub branch → GitHub Actions runs linters (**ESLint, Black**), tests (**Pytest, Jest**), and **SonarQube**.
- **Auto-Rejection:** On failure, the bot auto-comments on the PR and messages the freelancer to fix.
- **Delivery:** On pass, LangGraph generates release notes and delivers the final package via the Rocket.Chat portal.

---

## 5. 20+ Revenue-Maximizing Tools & Strategies

Every strategy from the blueprint is preserved (duplicates in the source are consolidated).

1. **Dynamic Auto-Portfolio Generator** — On bid, Next.js + Vercel CLI deploys a unique subdomain (`clientname.ourdomain.com`) showing only semantically-relevant work.
2. **Reverse Auction Blind Bidding** — Celery task dispatches specs to 15+ freelancers, driving prices down 20–30%.
3. **Stealth Persona Prompting** — LangGraph prompts mimic human cadence (delays, idioms; typos in Stealth mode).
4. **Real-Time Margin Tracker** — Next.js dashboard over WebSockets computes live profit (Client payment − Freelancer cost − API overhead) per project.
5. **Local LLM Cost Router** — Ollama/llama3 for internal tasks (job categorization, message parsing) to keep API cost near $0.
6. **AI Voice Negotiator** — Whisper (STT) + Piper/XTTS (TTS) to run discovery calls and dictate notes to the DB.
7. **Market Rate Arbitrage Engine** — Pandas + Scrapy scrapes Upwork historical data vs. Eastern European/LatAm rates; alerts when margin > 60%.
8. **Automated CI/CD Upselling** — Client Manager analyzes client stack and pitches retainers (e.g., backups for $200/mo).
9. **Automated Code QA Gate** — GitHub Actions + SonarQube on freelancer PRs.
10. **Micro-SaaS Templater** — LangGraph templates custom client builds into reusable SaaS products.
11. **Decentralized Proxy Rotation** — Scrapoxy routes traffic through residential IPs to avoid bans.
12. **White-Label Client Portal** — Next.js branded per-client portal (milestones, files, invoices); Appsmith + Keycloak is the documented alternative.
13. **Semantic Portfolio Matching** — ChromaDB matches meaning ("event ticketing" ↔ "booking reservation system").
14. **Sentiment Escalation** — HuggingFace models detect frustration → halt auto-replies, flag conversation, alert admin.
15. **White-Label Deliverable Branding** — Pandoc + Python AST strips freelancer metadata (comments, doc properties) and rebrands.
16. **Passive Income Affiliate Engine** — Sales AI recommends stacks (DigitalOcean, Vercel) via affiliate links.
17. **Automated Escrow & Mass Payouts** — n8n + Stripe Connect: escrow hold → on milestone approval, mass-payout freelancers, capture margin.
18. **Dynamic Pricing Algorithm** — scikit-learn adjusts bid price by client budget, urgency, market demand.
19. **Competitor Undercutting Engine** — Scrapy monitors competitor Upwork profiles; bids 5% lower with faster delivery. *(High ToS risk — gated.)*
20. **Self-Healing Scrapers** — Playwright + visual regression (pixelmatch/resemblejs) detects UI/DOM drift and auto-patches CSS selectors via LLM.
21. **Fake "Agency Team" Illusion** — Rocket.Chat bots present personas ("Sarah, PM"; "Mike, Senior Dev") to appear as a larger team. *(Disclosure/ethics-gated — see Compliance.)*
22. **Automated Invoice & Late-Fee Chasing** — Odoo CRM auto-generates invoices and sends escalating reminders for late payments.

---

## 6. Database Requirements

**Primary store:** PostgreSQL. **Vector store:** ChromaDB. **Cache/broker:** Redis.

### 6.1 Core PostgreSQL entities (indicative schema)

| Table | Key fields | Purpose |
|-------|-----------|---------|
| `users` | id, email, role (`admin`/`operator`/`viewer`), hashed_password, created_at | Dashboard/staff accounts + RBAC. |
| `personas` | id, name, role_label, avatar, comm_style, active | "Sarah PM / Mike Dev" personas for comms illusion. |
| `job_leads` | id, source (`upwork`/`fiverr`/`reddit`/`greenhouse`/`lever`/`clutch`/`linkedin`), external_id, title, description, budget, url, match_score, status, scraped_at | All acquired employment + freelance leads. |
| `applications` | id, job_lead_id, resume_version, submitted_at, status | Job Hunter (Agent 1) auto-applications. |
| `proposals` | id, job_lead_id, body, portfolio_refs, status, submitted_at | Agent 3 bids. |
| `clients` | id, name, company, source, contact_channel, ltv, sentiment_state | B2B/freelance clients. |
| `contracts` | id, client_id, job_lead_id, agreed_price, currency, status, milestones | Won work. |
| `milestones` | id, contract_id, title, amount, status, due_date | Milestone tracking + escrow triggers. |
| `freelancers` | id, name, contact_channel, skills[], quality_score, avg_delivery_days, blind_id | Vetted freelancer pool. |
| `freelancer_bids` | id, contract_id, freelancer_id, hours, rate, total_cost, roi_score, awarded | Blind-auction bids. |
| `margins` | id, contract_id, client_payment, freelancer_cost, api_overhead, net_margin, updated_at | Real-time margin tracking. |
| `messages` | id, conversation_id, sender_type (`ai`/`client`/`freelancer`/`human_admin`), persona_id, channel, body, delay_ms, sent_at | Omnichannel comms log. |
| `conversations` | id, client_id/freelancer_id, channel, escalated, sentiment | Rocket.Chat conversation mapping. |
| `qa_runs` | id, contract_id, pr_url, lint_status, test_status, sonar_score, passed | CI/CD QA gate results. |
| `deliverables` | id, contract_id, artifact_url, rebranded, release_notes | Final packages. |
| `invoices` | id, contract_id, amount, status, due_date, reminders_sent | Invoicing + late-fee chasing. |
| `payouts` | id, freelancer_id, contract_id, amount, stripe_transfer_id, status | Stripe Connect mass payouts. |
| `hitl_queue` | id, entity_type, entity_id, reason, status, assigned_to | Human-in-the-loop escalations. |
| `agent_runs` | id, agent_name, status, started_at, finished_at, logs, error | Bot observability. |
| `affiliate_events` | id, provider, link, contract_id, revenue | Affiliate tracking. |
| `settings` | id, key, value | Feature flags incl. **Stealth/Compliance mode**, rate limits, thresholds. |

### 6.2 ChromaDB collections
- `portfolio` — past project descriptions (semantic matching).
- `proposals_won` — successful proposals for RAG.
- `sales_scripts` — objection-handling and outreach scripts.
- `resume_master` — master résumé chunks for JD comparison.

---

## 7. Backend Requirements

> **Status: API layer implemented** — see [`backend/`](backend/). FastAPI app with ~60 endpoints covering this
> surface, backed today by an in-memory store (`backend/app/store.py`) seeded to mirror the frontend fixtures.
> Auth, DB, Celery, LangGraph, and webhooks are pending phases — their integration points are already
> represented in the API shape.

- **Framework:** FastAPI (async), Pydantic v2 schemas, SQLAlchemy 2.x + Alembic migrations.
- **Auth:** JWT/session + RBAC (`admin`, `operator`, `viewer`). *(Implemented in a later phase — Page 0 bypasses auth.)*
- **Task queue:** Celery workers + Celery Beat for cron (daily job pulls, 2-hour Upwork scrape, invoice chasing).
- **LLM routing layer:** deterministic router — **client-facing → Claude Sonnet**; **internal/low-stakes → Ollama/llama3**. Cost/usage logged per call.
- **Agent runtime:** LangGraph graphs per agent, checkpointed state in Postgres/Redis.
- **RAG service:** ChromaDB read/write helpers with strict context-bounding (anti-hallucination).
- **Scoring services:** freelancer ROI scoring, dynamic pricing (scikit-learn), margin computation.
- **WebSocket gateway:** live push of margins, agent status, HITL queue, conversation events to the dashboard.
- **Webhooks:** Stripe (escrow/payout), GitHub (PR/QA), Rocket.Chat, n8n, Cal.com.
- **Observability:** structured logging, agent_runs table, health endpoints, per-agent metrics.
- **Rate limiting & stealth:** randomized intervals, per-source caps (e.g., 10 apps/day), proxy rotation via Scrapoxy.

### Implemented API surface (all under `/api`, live today)
```
/core            GET kpis, margins[/timeseries|/by-project], funnel, channel-mix, analytics, overview
/agents          GET list, GET :id, POST :id/toggle, POST :id/run, POST resume-all
/pipeline        GET jobs, POST jobs/rescan; GET leads[/:id], POST leads/rescan;
                 GET proposals, POST proposals/:id/regenerate; GET sales-leads, sequences
/operations      GET clients[/:id], contracts[/:id], milestones, POST milestones/:id/approve;
                 GET freelancers, POST freelancers/invite; GET bids, POST bids/:id/award,
                 POST specs/broadcast; GET conversations, GET/POST conversations/:id/messages;
                 GET voice-calls; GET qa-runs, POST qa-runs/:id/rerun; GET deliverables,
                 POST contracts/:id/deliver; GET hitl, POST hitl/:id/take|resolve
/revenue         GET invoices, POST invoices/:id/remind; GET payouts, POST payouts/:id/approve;
                 GET affiliates; GET market-rates, competitors, POST competitors/:id/undercut;
                 GET plans, addons, POST addons/:id/purchase; GET revenue-streams, billing-history,
                 monetization; POST billing/plan/:id
/system          GET notifications, POST notifications/read-all|/:id/read; GET audit-log;
                 GET users, POST users/invite; GET integrations, POST integrations/:id/toggle;
                 GET/PATCH/POST personas[/:id]; GET portfolio[/:id], POST portfolio/:id/match;
                 GET/PATCH settings; GET meta
/portal          GET freelancer/overview|specs|bids|contracts|earnings|qa|messages,
                 POST freelancer/specs/:id/bid; GET client/overview|projects|milestones|files|invoices|messages,
                 POST client/milestones/:id/approve, client/files, client/invoices/:id/pay
/admin           GET credentials, POST credentials/:id/rotate|toggle;
                 GET security (controls + events); GET user-testing,
                 POST user-testing/scenarios/:id, POST user-testing/feedback;
                 POST onboarding (client + contract + milestones in one call)
/health          GET service health
/auth            login, refresh, me                       (later phase — JWT hooks reserved)
```

### Security middleware (live today)
- `SecurityHeadersMiddleware` — `X-Request-Id`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on every response.
- `RateLimitMiddleware` — 240 req/min per-IP sliding window, `429` + `Retry-After` on breach.
- `ApiKeyMiddleware` — when `API_KEY` is set in `backend/.env`, all POST/PATCH/DELETE
  requests must send `X-API-Key`. Generate: `py -c "import secrets; print(secrets.token_urlsafe(32))"`.

### Frontend ↔ backend contract
- `NEXT_PUBLIC_API_URL` points the Next.js app at this API (e.g. `http://localhost:8000`).
- Client pages hydrate via `useEntity(key, seed)`; server pages via `getEntity(key, seed)`.
- If the API is unreachable the UI silently keeps its bundled mock data — zero breakage, demo-safe.

---

## 8. APIs & Integrations

| Category | Integration |
|----------|-------------|
| Payments | **Stripe** (Checkout/Payments, **Stripe Connect** for freelancer payouts, escrow-style holds) |
| Comms | **Rocket.Chat**, **WhatsApp Business API**, **Discord bots**, **Gmail/SMTP** |
| Scheduling | **Cal.com** |
| Voice | **Vapi.ai** (or Whisper + Piper/XTTS self-hosted) |
| Job boards | **Upwork**, **Fiverr**, **Reddit (r/forhire)**, **JobSpy** (LinkedIn/Indeed/Glassdoor/ZipRecruiter), **Greenhouse**, **Lever**, **Clutch.co** |
| LLMs | **Anthropic Claude**, **Ollama (local)** |
| Code/QA | **GitHub API + GitHub Actions**, **SonarQube** |
| CRM/Invoicing | **Odoo** |
| Deploy | **Vercel** (Next.js), **DigitalOcean App Platform** (FastAPI) |
| Proxies | **Scrapoxy** (residential proxy pool) |
| Automation hub | **n8n** (Stripe webhooks, CRM, alerts) |

---

## 9. Automation Workflows

| Workflow | Trigger | Steps |
|----------|---------|-------|
| **Daily Job Hunt** | Celery cron (daily) | JobSpy pull → ChromaDB match → tailor résumé (>80%) → Playwright apply (≤10/day, randomized) |
| **Freelance Bidding** | Celery cron (every 2h) | Playwright scrape Upwork/Fiverr/Reddit → margin filter (>$500) → LangGraph RAG proposal → critique → submit |
| **B2B Outreach** | Celery cron / event | Scrape Clutch/LinkedIn → n8n cold-email sequence → auto-generate personalized landing micro-site → Sales AI replies + Cal.com booking |
| **Client Conversation** | Inbound message | Rocket.Chat → sentiment check → Claude persona reply (delays/typos in stealth) → upsell detection → HITL escalation if frustrated |
| **Blind Bidding War** | Contract won | Brief → tech spec → broadcast to 15–20 freelancers → collect bids → ROI scoring → auto-award → NDA shielding |
| **QA Gate** | Freelancer PR | GitHub Actions lint/test/SonarQube → pass: release notes + deliver; fail: auto-comment + notify freelancer |
| **Escrow & Payout** | Milestone approved | n8n + Stripe: release escrow → Stripe Connect payout → log margin |
| **Invoice & Late-Fee Chasing** | Milestone complete / overdue | Odoo invoice → escalating reminder emails |
| **Self-Healing Scrapers** | Scraper failure / visual drift | Visual regression diff → LLM selector auto-patch → retry → alert if unrecoverable |

---

## 10. Page 0 — Complete Frontend (Build This First)

> **Goal:** Build the **entire** frontend up front — every public page, every dashboard, every internal page,
> every form and shared component — **before** any backend work. Auth is **bypassed** in this phase so every
> page and dashboard is directly openable for review. Data is served from **typed mock fixtures** behind a
> single data-access layer so the swap to real APIs later is trivial.
>
> **Page 0 is complete when no additional frontend pages need to be created later.** Subsequent phases only
> wire backend, auth, DB, APIs, automation, and integrations to this existing UI.

### 10.1 Frontend stack & conventions
- **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** + **shadcn/ui** + **lucide-react** icons.
- **Charts:** Recharts (margins, funnels, analytics).
- **State/data:** TanStack Query wrapping a `lib/api` layer that currently returns **mock fixtures** (single toggle to switch to live API later).
- **Real-time:** WebSocket hook stubbed with mock streaming for the live margin tracker.
- **Forms:** React Hook Form + Zod validation.
- **Theming:** light/dark mode, responsive, accessible (a11y).
- **Auth bypass:** a `DEV_BYPASS_AUTH` flag renders all protected routes and seeds a mock "admin" session; a route map/index page links to **every** page for easy review.

### 10.2 Global layout & shared components
- **Marketing/public layout:** top navigation header (logo, links, Login/Sign-Up CTAs), footer (links, legal, contact, social).
- **App/dashboard layout:** collapsible sidebar (agent + section navigation), top bar (search, mode switch **Stealth/Compliance**, notifications, HITL badge, user menu), breadcrumb.
- **Shared components:** Button, Input, Select, Textarea, Modal/Dialog, Drawer, Tabs, Table (sortable/filterable/paginated), Card, Badge/Status pill, Toast, Tooltip, Avatar, DateRange picker, KPI stat card, Chart wrappers, Empty/Loading/Error states, Confirmation dialog (for destructive actions), File uploader, Chat/conversation panel, Timeline/stepper (milestones), Code/diff viewer (QA), Kanban board.

### 10.3 Complete page inventory

**A. Public / marketing pages**
1. **Home / Landing** — hero, value prop (the Autopilot loop), feature highlights, portfolio showcase, testimonials, pricing/CTA, footer.
2. **Sign Up** — registration form (name, email, password, confirm), validation, social-signup buttons (UI only).
3. **Login** — email/password, "remember me," forgot-password link, social-login (UI only).
4. **Forgot Password / Reset Password** — request + reset forms.
5. **Contact** — contact form (name, email, subject, message) + agency contact details/map.
6. **About / Agency** — team illusion personas presented as "the team," company story.
7. **Services / What We Do** — service catalog (web, AI, CI/CD, retainers).
8. **Portfolio / Case Studies** — grid + detail pages (fed by semantic-matching data later).
9. **Pricing** — tiers/retainers.
10. **Dynamic Personalized Micro-site** — `startupname.ouragency.com` / `clientname.ourdomain.com` template page (Agent 2/Auto-Portfolio): personalized hero + relevant portfolio pieces.
11. **Legal:** Terms, Privacy, plus **AI-disclosure page** (used in Compliance mode).
12. **404 / Error / Maintenance** pages.

**B. Admin dashboard pages (internal)**
13. **Dashboard Overview** — KPIs (active contracts, live margin, win rate, jobs applied, HITL count), Autopilot-loop status, recent activity, agent health.
14. **Real-Time Margin Tracker** — live per-project margin table + charts (Client − Freelancer − API overhead), totals, trends. *(WebSocket, mocked.)*
15. **Agent Control Center** — list of all 6 agents with status (running/paused/error), start/stop/pause, last-run logs, schedules.
16. **Job Hunter (Agent 1)** — "Jobs Applied To" table, match scores, résumé versions, daily-limit meter, apply history.
17. **Freelance Bidding (Agent 3)** — scraped leads, budget/margin filter, generated proposals (view/regenerate), submission status.
18. **Marketing & Sales (Agent 2)** — lead list (Clutch/LinkedIn), cold-email sequences/status, generated landing pages, Cal.com bookings.
19. **CRM / Clients** — client list + client detail (contact, source, LTV, sentiment, contracts, conversation history).
20. **Active Freelance Contracts** — contract list + detail (price, milestones, freelancer, QA status, deliverables).
21. **Milestones / Kanban** — milestone board across contracts (stepper/kanban).
22. **Arbitrage Dispatcher (Agent 5)** — spec broadcast view, blind-bid table, ROI scoring breakdown, auto-award action, NDA-shield indicators.
23. **Freelancer Pool** — vetted freelancers, skills, quality scores, avg delivery, invite/onboard form.
24. **Comms / Conversations Inbox (Agent 4)** — omnichannel inbox (Web/WhatsApp/Email/Discord), conversation panel with persona selector, typing-delay/typo indicators (stealth), sentiment status, upsell suggestions.
25. **Voice Calls** — discovery-call log, transcripts, extracted requirements.
26. **QA & Delivery (Agent 6)** — QA runs table (lint/test/SonarQube), PR/diff viewer, pass/fail, release notes, deliver action.
27. **HITL Queue** — escalations needing human action (sentiment, hallucination flags, approvals); resolve/assign.
28. **Payments & Payouts** — Stripe escrow status, invoices, freelancer mass-payout queue (Stripe Connect), affiliate revenue.
29. **Analytics & Reports** — funnel (bid→win→deliver→paid), win rates, market-rate arbitrage alerts, dynamic-pricing insights, competitor monitoring.
30. **Market Arbitrage** — historical rate data, margin >60% alerts, LatAm/EE rate comparisons.
31. **Portfolio / Semantic Matcher (admin)** — manage portfolio items, preview semantic matches for a given JD.
32. **Personas Manager** — CRUD for "agency team" personas (Sarah PM, Mike Dev) + comm-style config.
33. **Settings** — feature flags, **Stealth vs. Compliance mode toggle**, rate limits/thresholds (match %, budget floor, apps/day), LLM routing config, proxy config, integrations/keys (UI only).
34. **Integrations** — connect/status cards for Stripe, GitHub, Rocket.Chat, WhatsApp, Discord, Gmail, Cal.com, n8n, Odoo, Vapi, Ollama, ChromaDB.
35. **Audit Log / Agent Runs** — full agent run history and system events.
36. **Notifications** — system alerts, ban warnings, self-healing scraper events.
37. **User & Team Management** — dashboard users, roles (RBAC UI).
38. **User Profile / Account Settings** — profile, password, preferences, theme.

**C. White-label client portal (per-client)**
39. **Client Portal — Login/Access** (branded).
40. **Client Portal — Milestones & Progress** — track milestones, approve deliverables.
41. **Client Portal — Files/Deliverables** — download rebranded deliverables + release notes.
42. **Client Portal — Invoices & Payment** — view/pay invoices (Stripe).
43. **Client Portal — Messages** — chat with the "agency team."

### 10.4 Frontend acceptance criteria (Page 0 "done")
- Every page above exists, is routed, responsive, themed, and reachable from a **dev route index** with auth bypassed.
- All tables, forms, charts, chat panels, kanban, and diff viewers render from typed **mock fixtures**.
- A single `lib/api` boundary isolates all data access for a clean later swap to FastAPI.
- Shared component library in `packages/ui`; no page depends on backend availability.
- Stealth/Compliance mode toggle visibly changes relevant UI affordances (typo/delay indicators, AI-disclosure).

---

## 11. Implementation Roadmap

The blueprint's day-wise plan is preserved and reorganized into capability phases. **Phase 0 (frontend-first)
is inserted per project direction.** Original day ranges are noted for traceability.

### Phase 0 — Complete Frontend (**do first**)
- Build **all** pages in [Page 0](#10-page-0--complete-frontend-build-this-first) with mock data, auth bypassed. No backend.

### Phase 1 — Infrastructure & Foundation *(orig. Days 1–4)*
- ~~Initialize **Turborepo**~~ → **done differently:** single Next.js app at repo root + `backend/` FastAPI service (simpler; same separation of concerns).
- ✅ **FastAPI backend implemented** — full REST surface, in-memory store, CORS, OpenAPI docs ([`backend/`](backend/)).
- ✅ **Frontend ↔ backend wired** — `lib/api.ts` + `useEntity`/`getEntity`, action POSTs connected.
- **Dockerize:** `docker-compose.yml` with PostgreSQL, Redis, ChromaDB, Rocket.Chat, n8n (+ SonarQube, Ollama).
- **Queue:** initialize Celery; dummy task to verify Redis.
- **LLM routing:** LangGraph router — client-facing → Claude; internal → Ollama.
- **Database:** swap in-memory store for SQLAlchemy + Alembic per §6 schema.

### Phase 2 — Job Hunter & Bidding Layer *(orig. Days 5–12)*
- **JobSpy** + Celery crontabs for daily employment jobs; auto-apply via Playwright (Greenhouse/Lever).
- **Playwright** persistent context + residential proxies; scrape Upwork + r/forhire every 2h.
- **Proposal LangGraph agent:** Read JD → RAG ChromaDB → Draft → Critique → Submit.
- **B2B lead gen:** scrape Clutch.co → n8n cold email.

### Phase 3 — Arbitrage, Comms & Delivery *(orig. Days 13–22)*
- Connect Upwork messages + B2B email to Rocket.Chat.
- Upsell system prompts (trigger detection + organic pitch).
- **Dynamic Dispatcher / Blind Bidding War Protocol:** Celery broadcast to 15, collect rates, auto-award via scoring.
- **QA Gate:** GitHub Actions lint/test; auto-message freelancer on failure.

### Phase 4 — Wire-up, Auth, Dashboard & Autopilot *(orig. Days 23–30)*
- Connect Page-0 dashboard views to live APIs; implement **auth + RBAC** (remove bypass).
- **Payment automation:** n8n + Stripe escrow + Stripe Connect mass payouts on milestone approval.
- **Deploy:** Next.js → Vercel; FastAPI → DigitalOcean App Platform.

---

## 12. Risk Management, Security & Compliance

> **Important professional note.** Several requested capabilities — impersonating a human to defeat "AI
> detection," injecting deliberate typos, presenting a **fake team**, scraping platforms that prohibit bots
> (Upwork/LinkedIn), automatically **undercutting competitors**, and **stripping freelancer attribution** —
> carry material **legal, contractual (ToS), and ethical** risk (account bans, breach-of-contract, consumer-
> protection/deception exposure). **No functionality is dropped**, but each such feature is implemented behind
> a **`STEALTH` vs. `COMPLIANCE` mode** flag (`settings.mode`) so the operator can consciously choose behavior
> and satisfy jurisdictions that require AI disclosure. This is the responsible way to retain the capability
> while protecting the business.

| Risk | Level | Mitigation |
|------|-------|------------|
| **ToS violations** (Upwork/LinkedIn ban bots) | High | Botasaurus/Playwright stealth, Scrapoxy residential proxies, randomized rate limits, human-like scroll/mouse. Gate behind Stealth mode. |
| **AI hallucinations** (fake work / impossible timelines) | High | ChromaDB strictly bounds RAG. System prompt: *"Only reference projects present in provided context; never promise delivery time without consulting engineering."* |
| **AI detection by clients** | Medium | Stealth prompting, 15–45s delays, injected/auto-corrected typos (Stealth mode). **Compliance mode** substitutes honest AI-assistant disclosure. |
| **Supply-chain security** | — | `pip-audit` + `npm audit` in CI; avoid <1,000-star packages for core infra; verify MIT/Apache-2.0 to avoid copyleft contamination. |
| **License compliance** | — | **n8n** = Sustainable Use License (internal use only, not for redistribution). Cal.com (AGPL) and Pandoc (GPL) invoked as isolated services/CLIs. Redis licensing → Valkey alternative if fully-permissive needed. |
| **Secrets handling** | — | No secrets in repo; use env/secret manager; never log secrets. |

---

## 13. Local Development & Configuration

**Prerequisites:** Node.js LTS, npm, Python 3.11+ (Docker + Docker Compose for later infra phases).

### Frontend + Backend (today — no DB required)

```bash
# 1) Frontend deps
npm install

# 2) Backend deps + run  (http://localhost:8000 · docs at /docs)
cd backend
py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000

# 3) Point the frontend at the API — create .env.local (see .env.local.example)
NEXT_PUBLIC_API_URL=http://localhost:8000

# 4) Run the frontend  (http://localhost:3000 · route index at /dev)
npm run dev
```

> Without `NEXT_PUBLIC_API_URL` the frontend runs purely on bundled mock data — identical UI,
> demo-safe. With it set, every page hydrates from the live API and actions POST to it.

### Environment variables

The names below are the variables read by the current frontend, API, and worker. Copy the examples from [`.env.local.example`](.env.local.example) and [`backend/.env.example`](backend/.env.example), then set the values in the environment for the service that uses them. Never commit real secrets. Variables described as optional enable a feature; the app can run without them unless you need that feature.

#### Frontend (root `.env.local`, Vercel build/runtime)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | For the live API | Public base URL of FastAPI, e.g. `http://localhost:8000` locally or the deployed API URL. Empty/unset uses frontend demo mode. |
| `BACKEND_API_URL` | Alternative to `NEXT_PUBLIC_API_URL` | Private build-time alternative; `next.config.mjs` maps it into the frontend bundle, so the resulting URL is still public. |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | No; keep `false` in production | `true` enables the frontend-only demo identity. Do not enable on a deployed production app. |
| `NEXT_PUBLIC_SITE_URL` | No (`https://autopilotv2.vercel.app`) | Public site URL for the sitemap, robots.txt and Open Graph metadata. |
| `NEXT_PUBLIC_PAYMENTS_LIVE` | No; keep unset | Set `true` only once Stripe checkout is integrated. Until then the paywall says payments open soon, collects no card details, and free-plan profile limits aren't enforced. |
| `NEXT_PUBLIC_SIGNUP_WALL` | No | `true` makes the app direct visitors to sign up instead of sign in. |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for browser-side error reporting. |
| `SENTRY_DSN` | No | Sentry DSN for server/edge reporting in the Next.js service. |
| `SENTRY_AUTH_TOKEN` | No | Build-only token for uploading source maps to Sentry; keep it private. |

#### FastAPI API and queue worker (backend service environment)

| Variable | Required | Purpose |
|---|---|---|
| `ENVIRONMENT` | No (`development` default) | Set to `production` for deployment; enables production secret validation. |
| `SECRET_KEY` | Required in production | Signs login/session tokens. Production requires a random value of at least 32 characters. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No (`60`) | Session token lifetime. |
| `API_PREFIX` | No (`/api`) | API route prefix. |
| `CORS_ORIGINS` | Required for a separate frontend origin | Comma-separated allowed browser origins, e.g. `http://localhost:3000,https://your-app.example`. |
| `OWNER_EMAILS` | No | Comma-separated owner accounts that can access owner-only routes. |
| `API_KEY` | No | Optional extra key required on mutating API requests via `X-API-Key`. |
| `MONGODB_URI` | No for local demo; recommended for persistent deployments | MongoDB connection string. When unset, account and application data use process memory and are lost on restart. Set on both API and queue services. |
| `MONGODB_DB` | No (`autopilot`) | MongoDB database name. |
| `REDIS_URL` | Required for the scheduled queue | Redis connection string. Render supplies it from the Blueprint; configure on both API and queue services. |
| `GROQ_API_KEY` | No | Enables Groq-powered proposal, reply, and other text generation. Without it, AI generation may fall back to templates or be unavailable. |
| `GROQ_MODEL` | No (`openai/gpt-oss-120b`) | Groq model name. |
| `SENTRY_DSN` | No | Backend error reporting DSN. |
| `INBOUND_EMAIL_DOMAIN` | No; needed for inbound forwarding | Domain receiving forwarded marketplace email, e.g. `in.example.com`. |
| `INBOUND_EMAIL_WEBHOOK_SECRET` | No; needed with inbound email | Shared secret checked by the inbound email provider webhook. Configure the provider to send it as a Bearer token. |
| `INBOUND_EMAIL_PLATFORMS` | No; leave empty until reviewed | Comma-separated platform allowlist, e.g. `Fiverr,Upwork,Freelancer.com`. Enable only after checking real notification content and permissions. |
| `OUTLOOK_INBOX_READ_APPROVED` | No (`false`) | Enables read-only Outlook message import only after Mail.Read consent and privacy review; it still requires the per-user Nango connection and `INBOUND_EMAIL_PLATFORMS` allowlist. |
| `NANGO_SECRET_KEY` | No; needed for user OAuth | Server-side Nango secret used to mint short-lived Connect sessions and verify connection ownership; never expose it to the browser. |
| `NANGO_BASE_URL` | No (`https://api.nango.dev`) | Nango API base URL; change for a self-hosted Nango instance. |
| `NANGO_INTEGRATIONS` | No (empty disables connection sessions) | Comma-separated Nango integration IDs allowed by the backend (for example `microsoft-outlook,upwork`). Outlook and Upwork are hidden until their respective approval gates pass. |
| `COMPOSIO_API_KEY` | No; needed for agent tool sessions | Server-side Composio project key. Never expose it to the frontend. |
| `COMPOSIO_ALLOWED_TOOLKITS` | No (empty disables tool sessions) | Explicit comma-separated allowlist of Composio toolkit slugs exposed to an agent. |
| `ACTIVEPIECES_WEBHOOK_URL` | No; needed for event workflows | URL for a configured Activepieces webhook-trigger flow. The app currently emits minimal `inbox.message_received` events. |
| `ACTIVEPIECES_WEBHOOK_SECRET` | Required with `ACTIVEPIECES_WEBHOOK_URL` | Shared secret sent as a Bearer token to the Activepieces flow. Delivery is disabled unless both are configured. |
| `RESEND_API_KEY` | No; for outbound email | Resend credential. If set, Resend is tried first for app-generated emails. |
| `RESEND_FROM` | No (`Autopilot <onboarding@resend.dev>`) | Sender identity for Resend; production mail generally needs a verified sender domain. |
| `SMTP_HOST` | No; alternative outbound email provider | SMTP hostname. SMTP is used when configured and Resend does not deliver. |
| `SMTP_PORT` | No (`587`) | SMTP port; current sender uses STARTTLS. |
| `SMTP_USER` | No; needed with `SMTP_HOST` | SMTP login username. |
| `SMTP_PASSWORD` | No; needed when provider requires authentication | SMTP login password/app password. |
| `SMTP_FROM` | No (defaults to `SMTP_USER`) | Optional SMTP sender address. |
| `FREELANCER_OAUTH_TOKEN` | No; gated integration | Freelancer.com API token. Production API use also requires explicit approval; keep `FREELANCER_SANDBOX=true` until authorized. |
| `FREELANCER_SANDBOX` | No (`true`) | Selects Freelancer.com sandbox versus live host. |
| `FREELANCER_API_APPROVED` | No (`false`) | Explicit feature gate for approved Freelancer.com production API access. |
| `UPWORK_COMMERCIAL_APPROVED` | No (`false`) | Must remain false until written commercial permission is granted. Upwork OAuth is per-user through the Nango `upwork` integration; the app does not use a shared environment access token. |
| `UPWORK_PROPOSAL_SUBMIT_APPROVED` | No (`false`) | Separate operation gate; only enable after the approved Upwork scope and written product permission include proposal submission. Submission is not implemented yet. |
| `UPWORK_MESSAGE_READ_APPROVED` | No (`false`) | Separate operation gate for Upwork's direct messaging API; only enable after the approved messaging read scope. Direct marketplace message API sync is not implemented; Outlook mailbox import is separate. |
| `UPWORK_MESSAGE_SEND_APPROVED` | No (`false`) | Separate operation gate; only enable after the approved messaging write scope. Sending is not implemented yet and must retain user confirmation. |
| `REDDIT_ACCESS_TOKEN` | No; gated integration | Reddit Data API OAuth token. |
| `REDDIT_COMMERCIAL_APPROVED` | No (`false`) | Must remain false until Reddit approves commercial use. |
| `HN_COMMERCIAL_REUSE_APPROVED` | No (`false`) | Enables Hacker News job feed ingestion only after commercial reuse review is complete. |
| `JOB_SOURCES_APPROVED` | No (empty) | Comma-separated Job Radar source ids to enable after their reuse review or written permission is recorded, e.g. `rmt,tc` or the company-board providers `gh,lev,ash,smr,wkb,rct`. Ids and findings are in `docs/platform-matrix.md`. Set on the API and queue services. |
| `JOB_SOURCES_DISABLED` | No (empty) | Comma-separated source ids to switch off, including default-on public feeds. |
| `THE_MUSE_API_KEY`, `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT`, `JOOBLE_API_KEY`, `WEB3_CAREER_TOKEN` | No | Each keyed job API switches on when its credentials are set. `USAJOBS_USER_AGENT` must be the email registered with the key. |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (+ `ADZUNA_COUNTRY`, default `us`), `REED_API_KEY`, `FINDWORK_API_TOKEN` | No | These keyed APIs also need their id (`adz`, `reed`, `fw`) in `JOB_SOURCES_APPROVED`, because their terms require a licence or permission for a revenue-generating product. |
| `WORKER_URL` | No; needed to call a deployed browser worker | Base URL of the separate automation worker. |
| `WORKER_KEY` | Required when using the worker | Shared secret; must match on the API and worker services. |

#### Automation worker (separate `worker/` service)

| Variable | Required | Purpose |
|---|---|---|
| `WORKER_KEY` | Required to authorize `/run` | Same private shared secret as the API service. Without it, the endpoint refuses requests. |
| `OPENAI_API_KEY` | Only for the real browser-use engine | API key for the OpenAI-compatible model client. Simulation mode works without it when the browser engine is unavailable. |
| `WORKER_MODEL` | No (`gpt-4o-mini`) | Model used by browser-use. |
| `WORKER_MAX_STEPS` | No (`25`) | Maximum browser-agent steps per run. |

`PYTHON_VERSION` is a Render build setting in `render.yaml` (currently `3.12.7`), not an application setting. The worker and API each need their own service environment; Render Blueprint values do not automatically configure Vercel.

The older example file also contains names for planned integrations (such as `DATABASE_URL`, `CHROMADB_URL`, Stripe, Anthropic, Ollama, Rocket.Chat, WhatsApp, Vapi, Scrapoxy, and n8n). They are **not read by the current app configuration** and are not needed to run the current build; configure them only if those integrations are implemented later.

### Later phases (infra stack)

```bash
docker compose -f infra/docker-compose.yml up -d   # Postgres, Redis, ChromaDB, Rocket.Chat, n8n, SonarQube, Ollama
```

---

## 14. Requirements Traceability Matrix

Confirms 100% of the original specification is represented in this README.

| Spec item (source) | Where covered |
|--------------------|---------------|
| Autopilot loop (Acquisition→…→Capital) | §1 |
| Full open-source stack table | §2 |
| Agents 1–6 | §4 |
| All 20+ tools/strategies (incl. duplicates) | §5 |
| Turborepo monorepo | §3, §11 Phase 1 |
| Dockerized services (PG, Redis, Chroma, Rocket.Chat, n8n) | §2, §11 Phase 1, §13 |
| Celery queue + rate limits (10 apps/day, 2h scrape) | §4, §7, §9 |
| LLM routing (Claude vs Ollama) | §7, §11 Phase 1 |
| JobSpy / Greenhouse / Lever auto-apply | §4 Agent 1, §9 |
| Upwork/Fiverr/Reddit bidding + RAG proposals | §4 Agent 3, §9 |
| B2B (Clutch/LinkedIn) + n8n + micro-sites + Cal.com | §4 Agent 2, §9, §10 |
| Stealth comms + upsell + voice fallback | §4 Agent 4, §9 |
| Blind bidding + ROI scoring + NDA shield | §4 Agent 5, §9 |
| QA gate (GH Actions/SonarQube) + delivery | §4 Agent 6, §9 |
| Dashboard views (Jobs, Contracts, Margin, HITL) | §10 (B) |
| Stripe escrow + Connect mass payouts | §7, §8, §9, §10 |
| Deploy (Vercel / DigitalOcean) | §11 Phase 4 |
| Risk/security/compliance + licenses | §12 |
| Day-wise plan (Days 1–30) | §11 (mapped) |
| **Complete frontend (Page 0)** | §10 |

---

*This README preserves 100% of the v2.0 blueprint's required functionality and purpose. Where a tool or
approach was changed, it is explicitly marked **[Recommended change]** / **[Note]** with rationale, and the
underlying capability is unchanged.*
