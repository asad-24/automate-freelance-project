"""Demo / Live Acquisition engine.

Powers the guided "Live Acquisition Demo" console in the dashboard. Unlike the
other routers (which mostly read seeded data), this one *mutates* the in-memory
store on every acquisition cycle so the whole platform feels alive:

  POST /api/demo/acquire    -> runs one acquisition cycle: the agents scrape
                               freelance leads + B2B startups, write proposals,
                               win contracts and onboard brand-new clients. KPIs,
                               funnel, margin chart, channel mix, audit log and
                               notifications are all updated live.
  GET  /api/demo/state       -> snapshot of the current demo totals.
  POST /api/demo/reset       -> re-seed the store back to the baseline.

Everything is deterministic-ish random so each run looks different in a live
pitch while staying realistic.
"""
import random
import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import llm
from ..auth import require_owner, require_roles
from ..store import DB, init_store

router = APIRouter(tags=["demo"])


# --------------------------------------------------------------------------- #
# Realistic generation pools
# --------------------------------------------------------------------------- #
_B2B_COMPANIES = [
    ("Northwind Labs", "AI Infrastructure", "Series A ($14M)"),
    ("Verdant Health", "HealthTech", "Seed ($4M)"),
    ("Quanta Freight", "Logistics", "Series B ($30M)"),
    ("Lumen Retail", "E-commerce", "Series A ($9M)"),
    ("Harbor Fintech", "Fintech", "Series B ($42M)"),
    ("Beacon EdTech", "Education", "Seed ($2.5M)"),
    ("Cobalt Energy", "CleanTech", "Series A ($18M)"),
    ("Pine & Oak", "Consumer", "Bootstrapped"),
    ("Signal Robotics", "Robotics", "Series A ($11M)"),
    ("Meridian Travel", "Travel", "Seed ($3.2M)"),
    ("Atlas Proptech", "PropTech", "Series B ($55M)"),
    ("Cedar Legal", "LegalTech", "Seed ($1.8M)"),
    ("Nimbus Analytics", "Data/SaaS", "Series A ($16M)"),
    ("Orchid Beauty", "D2C", "Seed ($2M)"),
    ("Vertex Gaming", "Gaming", "Series A ($12M)"),
]

_FIRST_NAMES = ["Jordan", "Dana", "Marco", "Sofia", "Tom", "Avery", "Priya", "Noah",
                "Lena", "Diego", "Mia", "Omar", "Ivy", "Kai", "Elena", "Ruben"]
_LAST_NAMES = ["Blake", "Wu", "Reyes", "Klein", "Fisher", "Nguyen", "Patel", "Brooks",
               "Novak", "Alvarez", "Haddad", "Rossi", "Okafor", "Lindqvist"]

_JOB_TITLES = [
    ("Build a SaaS analytics dashboard (Next.js)", ["Next.js", "Recharts", "Postgres"]),
    ("AI chatbot for e-commerce store", ["LLM", "RAG", "FastAPI"]),
    ("React Native app MVP", ["React Native", "Firebase"]),
    ("Shopify Plus theme customization", ["Shopify", "Liquid"]),
    ("Python data pipeline (ETL)", ["Python", "Airflow", "ETL"]),
    ("Fintech dashboard with live charts", ["React", "D3", "WebSockets"]),
    ("Internal admin portal + RBAC", ["Next.js", "Node", "Postgres"]),
    ("LLM document search (RAG) service", ["Python", "ChromaDB", "FastAPI"]),
    ("Stripe billing integration", ["Node", "Stripe", "React"]),
    ("Marketing site rebuild + CMS", ["Next.js", "Sanity", "SEO"]),
    ("Mobile fitness tracker (Flutter)", ["Flutter", "Firebase"]),
    ("Real-time logistics tracker", ["React", "WebSockets", "Go"]),
]

_PLATFORMS = ["Upwork", "Upwork", "Fiverr", "Reddit r/forhire", "LinkedIn", "Clutch.co"]

_FREELANCER_POOL = [
    ("Priya Sharma", "India", ["React", "Next.js", "Node"], 96, 28),
    ("Diego Alvarez", "Argentina", ["Python", "FastAPI", "LLM"], 92, 32),
    ("Olena Kovar", "Ukraine", ["React", "TypeScript", "D3"], 94, 35),
    ("Linh Tran", "Vietnam", ["Flutter", "Firebase"], 89, 26),
    ("Mateusz Nowak", "Poland", ["Node", "Postgres", "AWS"], 90, 34),
    ("Ananya Rao", "India", ["Next.js", "Stripe", "Tailwind"], 93, 30),
]


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _meta() -> dict:
    return DB.setdefault("demo_meta", {"cycles": 0, "seq": 0})


def _next_id(prefix: str) -> str:
    m = _meta()
    m["seq"] += 1
    return f"{prefix}-{int(time.time()) % 100000}{m['seq']}"


def _log(agent: str, action: str, status: str = "success", events: list | None = None) -> dict:
    entry = {
        "id": _next_id("a"),
        "agent": agent,
        "action": action,
        "status": status,
        "time": _now(),
    }
    DB["audit_log"].insert(0, entry)
    if events is not None:
        events.append(entry)
    return entry


def _notify(title: str, body: str, kind: str = "success") -> None:
    DB["notifications"].insert(0, {
        "id": _next_id("n"),
        "title": title,
        "body": body,
        "type": kind,
        "time": _now(),
        "read": False,
    })


def _bump_agent(name: str) -> None:
    for a in DB["agents"]:
        if a["name"] == name:
            a["status"] = "running"
            a["runsToday"] = a.get("runsToday", 0) + 1
            a["lastRun"] = _now()
            break


def _recompute_channel_mix() -> None:
    """Renormalise channel mix to percentages from the raw lead/client sources."""
    counts: dict[str, int] = {}
    for lead in DB["leads"]:
        p = lead.get("platform", "Other")
        key = "Reddit" if "Reddit" in p else ("B2B Direct" if p in ("LinkedIn", "Clutch.co") else p)
        counts[key] = counts.get(key, 0) + 1
    for c in DB["clients"]:
        key = "B2B Direct" if c.get("source") in ("B2B Direct", "LinkedIn", "Clutch.co") else c.get("source", "Other")
        counts[key] = counts.get(key, 0) + 1
    total = sum(counts.values()) or 1
    mix = [{"name": k, "value": round(v * 100 / total)} for k, v in
           sorted(counts.items(), key=lambda kv: -kv[1])]
    if mix:
        DB["channel_mix"] = mix[:6]


class AcquireBody(BaseModel):
    intensity: int = 1  # 1 = normal cycle; higher scrapes more


@router.post("/demo/acquire", dependencies=[Depends(require_roles("admin"))])
def acquire(body: AcquireBody | None = None):
    from ..config import get_settings
    if not get_settings().seed_demo_data:
        return {"ok": True, "cycle": 0, "fabricated": False,
                "message": "Live mode — demo fabrication disabled."}
    intensity = max(1, min(3, (body.intensity if body else 1)))
    events: list = []
    found = {"leads": [], "salesLeads": [], "clients": [], "proposals": [],
             "contracts": [], "conversations": []}
    gained_revenue = 0
    gained_margin = 0
    gained_cost = 0

    m = _meta()
    m["cycles"] += 1
    cycle = m["cycles"]

    _log("Bidding & Acquisition",
         "Scraping Upwork / Fiverr / Reddit feeds via residential proxies…",
         "success", events)
    _bump_agent("Bidding & Acquisition")

    # 1) Freelance leads ----------------------------------------------------- #
    n_leads = random.randint(3, 4) * intensity
    for idx in range(n_leads):
        title, _skills = random.choice(_JOB_TITLES)
        platform = random.choice(_PLATFORMS[:4])
        # Guarantee the first scraped lead each cycle is a strong, qualified one
        # so proposals/wins visibly flow during the pitch; the rest are realistic.
        if idx == 0:
            budget = random.choice([2200, 3500, 4800, 5400, 6800, 9200])
            match = random.randint(84, 97)
            margin = random.randint(48, 68)
        else:
            budget = random.choice([450, 900, 1200, 2200, 3500, 4800, 5400, 6800, 9200])
            match = random.randint(42, 97)
            margin = random.randint(10, 68)
        if budget < 500:
            status = "Skipped (<$500)"
        elif match < 80:
            status = "Under Review"
        else:
            status = random.choice(["Bidding", "Proposal Sent", "Proposal Sent"])
        lead = {
            "id": _next_id("l"),
            "title": title,
            "platform": platform,
            "budget": budget,
            "margin": margin,
            "matchScore": match,
            "status": status,
            "posted": "just now",
        }
        DB["leads"].insert(0, lead)
        found["leads"].append(lead)

        # 2) Proposal for every qualified lead ------------------------------- #
        if status in ("Bidding", "Proposal Sent"):
            quality = random.randint(88, 97)
            # Real AI-written bid via Groq; template fallback if offline.
            body_text = llm.write_proposal(title, platform, budget) or (
                f"Hi — saw your post for \"{title}\". We've shipped similar work recently and can move fast. "
                f"Plan: (1) same-day kickoff, (2) working draft in 48h, (3) revisions until sign-off. "
                f"Happy to share a relevant repo/demo. What does your timeline look like?"
            )
            proposal = {
                "id": _next_id("p"),
                "leadTitle": title,
                "platform": platform.split(" ")[0],
                "words": len(body_text.split()),
                "status": "Sent",
                "quality": quality,
                "submitted": _now(),
                "body": body_text,
                "aiModel": f"groq/{get_settings().groq_model}" if llm.enabled() else "template",
            }
            DB["proposals"].insert(0, proposal)
            found["proposals"].append(proposal)
            lead["status"] = "Proposal Sent"

    _log("Bidding & Acquisition",
         f"Scraped {len(found['leads'])} leads · {len(found['proposals'])} RAG proposals auto-submitted",
         "success", events)

    # 3) B2B startup discovery (Marketing & Sales) --------------------------- #
    _bump_agent("Marketing & Sales")
    n_b2b = random.randint(1, 2) * intensity
    for _ in range(n_b2b):
        company, industry, funding = random.choice(_B2B_COMPANIES)
        slug = company.lower().replace(" & ", "-").replace(" ", "")
        source = random.choice(["Clutch.co", "LinkedIn"])
        sales_lead = {
            "id": _next_id("s"),
            "company": company,
            "industry": industry,
            "funding": funding,
            "source": source,
            "stage": random.choice(["Email Opened", "Reply Received", "Sequence 2/4"]),
            "contact": f"founder@{slug}.io",
            "microsite": f"{slug}.ouragency.com",
        }
        DB["sales_leads"].insert(0, sales_lead)
        found["salesLeads"].append(sales_lead)
        _log("Marketing & Sales",
             f"New funded startup found: {company} ({industry}, {funding}) → micro-site deployed",
             "success", events)

    # 4) Convert the strongest signals into brand-new CLIENTS ---------------- #
    #    (B2B replies + won freelance leads)
    convertible = [l for l in found["leads"] if l["status"] == "Proposal Sent" and l["matchScore"] >= 85]
    n_clients = max(1, len(found["salesLeads"]))  # at least one new client per cycle
    sources_pool = list(found["salesLeads"])

    for i in range(n_clients):
        first, last = random.choice(_FIRST_NAMES), random.choice(_LAST_NAMES)
        if sources_pool:
            sl = sources_pool.pop()
            company, source = sl["company"], "B2B Direct"
        else:
            company = random.choice(_B2B_COMPANIES)[0]
            source = random.choice(["Upwork", "Reddit", "B2B Direct"])
        ltv = random.choice([6400, 8600, 12400, 18200, 24000, 32000])
        client = {
            "id": _next_id("c"),
            "name": f"{first} {last}",
            "company": company,
            "source": source,
            "ltv": ltv,
            "sentiment": random.choice(["positive", "positive", "neutral"]),
            "contracts": 1,
            "status": "Onboarding",
        }
        DB["clients"].insert(0, client)
        found["clients"].append(client)
        _log("Stealth Client Manager",
             f"Opened human-persona conversation with {client['name']} @ {company}",
             "success", events)
        _bump_agent("Stealth Client Manager")

        conversation = {
            "id": _next_id("cv"),
            "contact": client["name"],
            "channel": random.choice(["Web", "Email", "WhatsApp"]),
            "persona": random.choice(["Sarah (PM)", "Mike (Senior Dev)", "Elena (AE)"]),
            "last": "Thanks for the detailed scope — this looks great, let's move forward.",
            "unread": random.randint(0, 3),
            "sentiment": "positive",
            "time": _now(),
        }
        DB["conversations"].insert(0, conversation)
        found["conversations"].append(conversation)
        _notify("New client acquired", f"{company} — via {source}", "success")

    # 5) Win a contract from a converted client ------------------------------ #
    if convertible or found["clients"]:
        win_from = convertible[0] if convertible else None
        client = found["clients"][0]
        title = win_from["title"] if win_from else f"{client['company']} platform build"
        value = win_from["budget"] if win_from else random.choice([4800, 6800, 9200, 12800])
        cost = round(value * random.uniform(0.38, 0.46))
        overhead = random.randint(60, 240)
        margin = value - cost - overhead

        _bump_agent("Arbitrage Dispatcher")
        freelancer = random.choice(_FREELANCER_POOL)
        fl_id = f"FL-{random.randint(1000, 9900)}"
        _log("Arbitrage Dispatcher",
             f"Blind auction closed → awarded '{title}' to {freelancer[0]} ({freelancer[1]}) · ROI-selected",
             "success", events)

        contract = {
            "id": _next_id("ct"),
            "title": title,
            "client": client["company"],
            "value": value,
            "status": "In Progress",
            "milestonesDone": 0,
            "milestonesTotal": random.choice([3, 4]),
            "freelancer": fl_id,
            "qa": "Pending",
            "due": "2026-12-15",
        }
        DB["contracts"].insert(0, contract)
        found["contracts"].append(contract)
        client["status"] = "Active"

        for mi in range(contract["milestonesTotal"]):
            DB["milestones"].append({
                "id": _next_id("m"),
                "contract": title,
                "title": f"Milestone {mi + 1}",
                "amount": round(value / contract["milestonesTotal"]),
                "status": "Pending",
                "due": "2026-12-15",
            })

        DB["margin_by_project"].insert(0, {
            "project": title, "client": client["company"], "payment": value,
            "freelancerCost": cost, "apiOverhead": overhead, "margin": margin,
        })

        gained_revenue += value
        gained_cost += cost + overhead
        gained_margin += margin

        _log("Bidding & Acquisition",
             f"Contract WON: '{title}' — {client['company']} (${value:,} · {round(margin*100/value)}% margin)",
             "success", events)
        _notify("New contract won", f"{title} — ${value:,} · {round(margin*100/value)}% margin", "success")

    # 6) Roll the numbers forward -------------------------------------------- #
    k = DB["kpis"]
    k["jobsApplied"] = k.get("jobsApplied", 0) + len(found["proposals"])
    k["activeContracts"] = k.get("activeContracts", 0) + len(found["contracts"])
    k["liveMargin"] = k.get("liveMargin", 0) + gained_margin
    k["revenueMonth"] = k.get("revenueMonth", 0) + gained_revenue
    k["freelancersActive"] = k.get("freelancersActive", 0) + len(found["contracts"])
    # win rate drifts toward the realised ratio of wins per proposals this cycle
    if found["proposals"]:
        realised = round(len(found["contracts"]) * 100 / max(len(found["proposals"]), 1))
        k["winRate"] = max(20, min(60, round((k.get("winRate", 34) * 3 + realised) / 4)))

    # funnel
    def _bump_funnel(stage: str, by: int) -> None:
        for row in DB["funnel"]:
            if row["stage"] == stage:
                row["value"] += by
                return
    _bump_funnel("Leads Scraped", len(found["leads"]) + len(found["salesLeads"]))
    _bump_funnel("Bids Submitted", len(found["proposals"]))
    _bump_funnel("Replies", len(found["clients"]))
    _bump_funnel("Contracts Won", len(found["contracts"]))

    # margin chart — push this month's bar up so the trend visibly climbs
    if DB["margin_timeseries"]:
        last = DB["margin_timeseries"][-1]
        last["revenue"] += gained_revenue
        last["cost"] += gained_cost
        last["margin"] += gained_margin

    _recompute_channel_mix()

    return {
        "ok": True,
        "cycle": cycle,
        "startedAt": _now(),
        "events": events,
        "found": found,
        "deltas": {
            "leads": len(found["leads"]),
            "salesLeads": len(found["salesLeads"]),
            "clients": len(found["clients"]),
            "proposals": len(found["proposals"]),
            "contractsWon": len(found["contracts"]),
            "revenue": gained_revenue,
            "margin": gained_margin,
        },
        "kpis": DB["kpis"],
        "funnel": DB["funnel"],
        "channelMix": DB["channel_mix"],
        "totals": {
            "clients": len(DB["clients"]),
            "leads": len(DB["leads"]),
            "contracts": len(DB["contracts"]),
            "proposals": len(DB["proposals"]),
        },
    }


@router.get("/demo/state")
def demo_state():
    m = _meta()
    return {
        "cycles": m["cycles"],
        "kpis": DB["kpis"],
        "totals": {
            "clients": len(DB["clients"]),
            "leads": len(DB["leads"]),
            "contracts": len(DB["contracts"]),
            "proposals": len(DB["proposals"]),
            "salesLeads": len(DB["sales_leads"]),
        },
        "funnel": DB["funnel"],
        "channelMix": DB["channel_mix"],
    }


@router.post("/demo/reset", dependencies=[Depends(require_owner)])
def demo_reset():
    init_store()
    DB["demo_meta"] = {"cycles": 0, "seq": 0}
    _log("Operator", "Demo environment reset to baseline", "success")
    return {"ok": True, "message": "Demo reset to baseline", "totals": {
        "clients": len(DB["clients"]), "leads": len(DB["leads"]),
        "contracts": len(DB["contracts"]),
    }}
