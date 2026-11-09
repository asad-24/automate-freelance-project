"""Workspace — the dashboard's own state, one document per user.

GET /api/state   -> {state, version}
PUT /api/state   {state, version} -> {version}; 409 {state, version} when
                 another tab or device saved first
GET /api/accounts, /api/gigs, /api/chat-messages -> slices of the workspace

Plan and credits are not part of it — they're server-owned (routers/billing.py)
and any copy the browser sends is dropped.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import repo
from ..auth import current_user

router = APIRouter(tags=["workspace"])

SERVER_OWNED_KEYS = ("monetization", "billingHistory")
MAX_STATE_BYTES = 1_000_000


class WorkspaceBody(BaseModel):
    state: dict
    version: int = 0


@router.get("/state")
async def get_state(user: dict = Depends(current_user)):
    return await repo.get_workspace(user["id"])


@router.put("/state")
async def put_state(body: WorkspaceBody, user: dict = Depends(current_user)):
    state = {k: v for k, v in body.state.items() if k not in SERVER_OWNED_KEYS}
    if len(json.dumps(state, default=str)) > MAX_STATE_BYTES:
        raise HTTPException(413, "Workspace is too large to save.")
    version = await repo.save_workspace(user["id"], state, body.version)
    if version is None:
        current = await repo.get_workspace(user["id"])
        return JSONResponse(status_code=409, content={"detail": "Saved from another tab — reloaded.", **current})
    return {"version": version}


async def _slice(user: dict, key: str) -> list:
    return (await repo.get_workspace(user["id"]))["state"].get(key, [])


@router.get("/accounts")
async def get_accounts(user: dict = Depends(current_user)):
    return await _slice(user, "accounts")


@router.get("/gigs")
async def get_gigs(user: dict = Depends(current_user)):
    return await _slice(user, "gigs")


@router.get("/chat-messages")
async def get_chat_messages(user: dict = Depends(current_user)):
    return await _slice(user, "chatMessages")
