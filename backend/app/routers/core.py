"""Core dashboard metrics — KPIs, margins, funnel, analytics."""
from fastapi import APIRouter

from ..store import DB

router = APIRouter(tags=["core"])


@router.get("/kpis")
def get_kpis():
    return DB["kpis"]


@router.get("/margins")
def get_margins():
    return {
        "live": DB["kpis"]["liveMargin"],
        "timeseries": DB["margin_timeseries"],
        "byProject": DB["margin_by_project"],
    }


@router.get("/margins/timeseries")
def get_margin_timeseries():
    return DB["margin_timeseries"]


@router.get("/margins/by-project")
def get_margin_by_project():
    return DB["margin_by_project"]


@router.get("/funnel")
def get_funnel():
    return DB["funnel"]


@router.get("/channel-mix")
def get_channel_mix():
    return DB["channel_mix"]


@router.get("/analytics")
def get_analytics():
    return {
        "funnel": DB["funnel"],
        "channelMix": DB["channel_mix"],
        "marginTimeseries": DB["margin_timeseries"],
        "kpis": DB["kpis"],
    }


@router.get("/overview")
def get_overview():
    """Aggregated payload for the dashboard overview page."""
    return {
        "kpis": DB["kpis"],
        "marginTimeseries": DB["margin_timeseries"],
        "funnel": DB["funnel"],
        "agents": DB["agents"],
        "auditLog": DB["audit_log"],
        "contracts": DB["contracts"],
    }
