"""In-memory data store.

Phase: backend implemented without a database. All collections live in
module-level memory (seeded from seed.py). Swap each accessor for a real
repository (Postgres/SQLAlchemy) later — routers stay unchanged.
"""
from copy import deepcopy
from typing import Any

from . import seed

DB: dict[str, Any] = {}


def _clean_agents() -> list[dict]:
    """The agent catalog is product, not user data — keep it, but with honest
    activity (nothing has run until the owner launches it)."""
    return [
        {**a, "status": "idle", "runsToday": 0, "lastRun": None, "successRate": 0}
        for a in seed.AGENTS
    ]


def _clean_integrations() -> list[dict]:
    """Connector catalog stays; statuses are honest — nothing is connected
    until the user actually configures it."""
    return [{**i, "status": "Disconnected"} for i in seed.INTEGRATIONS]


_ZERO_KPIS = {k: 0 for k in seed.KPIS}
_ZERO_MARGIN_TS = [{**m, "revenue": 0, "cost": 0, "margin": 0} for m in seed.MARGIN_TIMESERIES]
_ZERO_FUNNEL = [{**f, "value": 0} for f in seed.FUNNEL_DATA]

# Fabricated collections — in clean mode these start EMPTY (real data only).
_CLEAN_OVERRIDES: dict[str, Any] = {
    "kpis": _ZERO_KPIS,
    "margin_timeseries": _ZERO_MARGIN_TS,
    "funnel": _ZERO_FUNNEL,
    "channel_mix": [],
    "margin_by_project": [],
    "agents": None,          # sentinel → _clean_agents()
    "jobs": [],
    "leads": [],
    "proposals": [],
    "sales_leads": [],
    "sequences": [],
    "clients": [],
    "contracts": [],
    "milestones": [],
    "freelancers": [],
    "bids": [],
    "conversations": [],
    "chat_messages": [],
    "voice_calls": [],
    "qa_runs": [],
    "deliverables": [],
    "hitl": [],
    "invoices": [],
    "payouts": [],
    "market_rates": [],
    "competitors": [],
    "portfolio": [],
    "personas": [],
    "integrations": None,    # sentinel → _clean_integrations()
    "audit_log": [],
    "notifications": [],
    "users": [],
    "affiliates": [],
    "revenue_streams": [],
    "billing_history": [],
    "freelancer_specs": [],
    "freelancer_bids": [],
    "freelancer_contracts": [],
    "freelancer_earnings": [],
    "client_projects": [],
    "client_files": [],
    "client_invoices": [],
    "credentials": [],
    "security_events": [],
    "user_feedback": [],
}

# Nested keys inside the synced client state that are fabricated/demo output —
# wiped on clean startup. User-owned data (accounts, gigs, radar, monetization,
# growth/campaigns, agents config, onboarding) is kept.
_STATE_LISTS_TO_CLEAR = [
    "clients", "contracts", "milestones", "proposals", "leads", "salesLeads",
    "conversations", "chatMessages", "notifications", "auditLog", "jobs",
    "freelancers", "bids", "qaRuns", "deliverables", "hitl", "voiceCalls",
    "invoices", "payouts", "marketRates", "competitors", "portfolio",
    "affiliates", "billingHistory", "revenueStreams", "sequences",
    "personas", "users", "credentials", "securityEvents", "userFeedback",
    "marginByProject", "channelMix",
]
_STATE_OBJECTS_TO_ZERO = ["kpis", "funnel", "marginTimeseries"]


def apply_clean_mode() -> None:
    """Force fabricated collections empty. Idempotent — safe every boot."""
    for key, val in _CLEAN_OVERRIDES.items():
        if val is None:
            DB[key] = _clean_agents() if key == "agents" else _clean_integrations()
        else:
            DB[key] = deepcopy(val)
    sanitize_client_state()


def sanitize_client_state() -> None:
    """Strip fabricated/demo-generated data from the synced client state while
    preserving everything the user actually owns."""
    state = DB.get("client_state")
    if not isinstance(state, dict):
        return
    for key in _STATE_LISTS_TO_CLEAR:
        if isinstance(state.get(key), list):
            state[key] = []
    for key in _STATE_OBJECTS_TO_ZERO:
        obj = state.get(key)
        if isinstance(obj, dict):
            state[key] = {k: 0 for k in obj}
        elif isinstance(obj, list):
            state[key] = [
                {**item, **{k: 0 for k, v in item.items() if isinstance(v, (int, float))}}
                if isinstance(item, dict) else item
                for item in obj
            ]
    if isinstance(state.get("agents"), list):
        state["agents"] = [
            {**a, "status": "idle", "runsToday": 0, "lastRun": "—", "successRate": 0}
            if isinstance(a, dict) else a
            for a in state["agents"]
        ]
    state["cycles"] = 0


def init_store() -> None:
    DB.update(
        {
            "kpis": deepcopy(seed.KPIS),
            "margin_timeseries": deepcopy(seed.MARGIN_TIMESERIES),
            "funnel": deepcopy(seed.FUNNEL_DATA),
            "channel_mix": deepcopy(seed.CHANNEL_MIX),
            "margin_by_project": deepcopy(seed.MARGIN_BY_PROJECT),
            "agents": deepcopy(seed.AGENTS),
            "jobs": deepcopy(seed.APPLIED_JOBS),
            "leads": deepcopy(seed.FREELANCE_LEADS),
            "proposals": deepcopy(seed.PROPOSALS),
            "sales_leads": deepcopy(seed.SALES_LEADS),
            "sequences": deepcopy(seed.EMAIL_SEQUENCES),
            "clients": deepcopy(seed.CLIENTS),
            "contracts": deepcopy(seed.CONTRACTS),
            "milestones": deepcopy(seed.MILESTONES),
            "freelancers": deepcopy(seed.FREELANCERS),
            "bids": deepcopy(seed.BLIND_BIDS),
            "conversations": deepcopy(seed.CONVERSATIONS),
            "chat_messages": deepcopy(seed.CHAT_MESSAGES),
            "voice_calls": deepcopy(seed.VOICE_CALLS),
            "qa_runs": deepcopy(seed.QA_RUNS),
            "deliverables": deepcopy(seed.DELIVERABLES),
            "hitl": deepcopy(seed.HITL_QUEUE),
            "invoices": deepcopy(seed.INVOICES),
            "payouts": deepcopy(seed.PAYOUTS),
            "market_rates": deepcopy(seed.MARKET_ARBITRAGE),
            "competitors": deepcopy(seed.COMPETITORS),
            "portfolio": deepcopy(seed.PORTFOLIO_ITEMS),
            "personas": deepcopy(seed.PERSONAS),
            "integrations": deepcopy(seed.INTEGRATIONS),
            "audit_log": deepcopy(seed.AUDIT_LOG),
            "notifications": deepcopy(seed.NOTIFICATIONS),
            "users": deepcopy(seed.DASHBOARD_USERS),
            "affiliates": deepcopy(seed.AFFILIATE_EVENTS),
            "plans": deepcopy(seed.SUBSCRIPTION_PLANS),
            "revenue_streams": deepcopy(seed.REVENUE_STREAMS),
            "addons": deepcopy(seed.ADDON_MARKETPLACE),
            "billing_history": deepcopy(seed.BILLING_HISTORY),
            "freelancer_specs": deepcopy(seed.FREELANCER_OPEN_SPECS),
            "freelancer_bids": deepcopy(seed.FREELANCER_MY_BIDS),
            "freelancer_contracts": deepcopy(seed.FREELANCER_CONTRACTS),
            "freelancer_earnings": deepcopy(seed.FREELANCER_EARNINGS),
            "client_projects": deepcopy(seed.CLIENT_PROJECTS),
            "client_files": deepcopy(seed.CLIENT_FILES),
            "client_invoices": deepcopy(seed.CLIENT_INVOICES),
            "settings": deepcopy(seed.SETTINGS),
            "credentials": deepcopy(seed.API_CREDENTIALS),
            "security_controls": deepcopy(seed.SECURITY_CONTROLS),
            "security_events": deepcopy(seed.SECURITY_EVENTS),
            "test_scenarios": deepcopy(seed.USER_TEST_SCENARIOS),
            "user_feedback": deepcopy(seed.USER_FEEDBACK),
            "demo_meta": {"cycles": 0, "seq": 0},
        }
    )
    if not _clean_enabled():
        apply_clean_mode()


def _clean_enabled() -> bool:
    from .config import get_settings
    return get_settings().seed_demo_data


def collection(name: str) -> list[dict]:
    return DB[name]


def get_by_id(name: str, item_id: str) -> dict | None:
    return next((x for x in DB[name] if x.get("id") == item_id), None)


def audit(agent: str, action: str, status: str = "success") -> None:
    import time

    DB["audit_log"].insert(
        0,
        {
            "id": f"a{len(DB['audit_log']) + 1}",
            "agent": agent,
            "action": action,
            "status": status,
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )
