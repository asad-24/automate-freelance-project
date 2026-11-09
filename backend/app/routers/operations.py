"""Operations — clients, contracts, milestones, freelancers, blind bids,
conversations, voice calls, QA, deliverables, HITL queue."""
import time
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import llm
from ..store import DB, audit, get_by_id

router = APIRouter(tags=["operations"])


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# --- Clients ---
@router.get("/clients")
def list_clients():
    return DB["clients"]


@router.get("/clients/{client_id}")
def get_client(client_id: str):
    client = get_by_id("clients", client_id)
    if not client:
        raise HTTPException(404, "Client not found")
    return client


# --- Contracts ---
@router.get("/contracts")
def list_contracts():
    return DB["contracts"]


@router.get("/contracts/{contract_id}")
def get_contract(contract_id: str):
    contract = get_by_id("contracts", contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    return contract


# --- Milestones ---
@router.get("/milestones")
def list_milestones():
    return DB["milestones"]


@router.post("/milestones/{milestone_id}/approve")
def approve_milestone(milestone_id: str):
    ms = get_by_id("milestones", milestone_id)
    if not ms:
        raise HTTPException(404, "Milestone not found")
    ms["status"] = "Approved"
    audit("QA & Delivery", f"Milestone '{ms['title']}' approved — payout queued")
    return ms


# --- Freelancers ---
@router.get("/freelancers")
def list_freelancers():
    return DB["freelancers"]


class FreelancerInvite(BaseModel):
    name: str
    email: str


@router.post("/freelancers/invite")
def invite_freelancer(body: FreelancerInvite):
    new = {
        "id": f"FL-{uuid4().int % 9000 + 1000}",
        "name": body.name,
        "region": "—",
        "skills": [],
        "quality": 0,
        "avgDelivery": 0,
        "activeJobs": 0,
        "rate": 0,
        "status": "Invited",
    }
    DB["freelancers"].append(new)
    audit("Arbitrage Dispatcher", f"Freelancer invited: {body.email}")
    return new


# --- Blind Bids (Arbitrage Dispatcher) ---
@router.get("/bids")
def list_bids():
    return DB["bids"]


@router.post("/bids/{bid_id}/award")
def award_bid(bid_id: str):
    bid = get_by_id("bids", bid_id)
    if not bid:
        raise HTTPException(404, "Bid not found")
    for b in DB["bids"]:
        b["awarded"] = False
    bid["awarded"] = True
    audit("Arbitrage Dispatcher", f"Awarded contract to {bid['freelancer']} (ROI {bid['roi']})")
    return bid


@router.post("/specs/broadcast")
def broadcast_spec():
    audit("Arbitrage Dispatcher", "Spec broadcast to 15 freelancers")
    return {"ok": True, "message": "Spec broadcast to vetted pool"}


# --- Conversations & Messages ---
@router.get("/conversations")
def list_conversations():
    return DB["conversations"]


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str):
    convo = get_by_id("conversations", conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    return DB["chat_messages"]


class SendMessage(BaseModel):
    text: str
    persona: str = "Sarah (PM)"


@router.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: str, body: SendMessage):
    convo = get_by_id("conversations", conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    msg = {
        "id": f"msg{len(DB['chat_messages']) + 1}",
        "from": "ai",
        "author": body.persona,
        "text": body.text,
        "time": time.strftime("%H:%M", time.gmtime()),
        "delay": 18,
    }
    DB["chat_messages"].append(msg)
    convo["last"] = body.text
    convo["time"] = _now()
    return msg


class AutoReplyBody(BaseModel):
    thread: list[dict] | None = None   # client sends its rendered thread (demo convos carry it)
    contact: str = ""
    channel: str = ""
    persona: str = ""


@router.post("/conversations/{conversation_id}/auto-reply")
def auto_reply(conversation_id: str, body: AutoReplyBody):
    """Draft a contextual AI reply. NEVER sends — the reply lands in the
    composer for the human to edit + send (same HITL rule as bids)."""
    convo = get_by_id("conversations", conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    contact = body.contact or convo.get("contact", "the client")
    channel = body.channel or convo.get("channel", "message")
    thread = (body.thread or convo.get("thread") or DB["chat_messages"])[-8:]
    transcript = "\n".join(
        f"{'Client' if m.get('from') != 'ai' else 'You'}: {m.get('text', '')}" for m in thread
    )
    generated = llm.chat(
        [
            {"role": "system", "content": (
                "You draft short, human-sounding replies for a freelancer/agency. "
                "Match the thread's tone and language. 1-3 sentences max, answer the "
                "client's actual question, move the deal forward (next step, timeline, "
                "or one clarifying question). No greetings, no sign-offs, no emojis."
            )},
            {"role": "user", "content": (
                f"Contact: {contact} via {channel}. "
                f"Recent thread:\n{transcript or '(no messages yet)'}\n\n"
                "Write the reply."
            )},
        ],
        max_tokens=300,
    )
    reply = generated or (
        "Thanks for the update — sounds good. Let me confirm the details and "
        "I'll come back to you with next steps today."
    )
    audit("Unified Inbox", f"AI reply drafted for {contact} ({channel})")
    return {"reply": reply, "aiGenerated": bool(generated), "sent": False}


class AutoReplyToggle(BaseModel):
    enabled: bool | None = None


@router.post("/conversations/{conversation_id}/auto-reply-toggle")
def auto_reply_toggle(conversation_id: str, body: AutoReplyToggle):
    """Per-conversation auto-reply switch. When real inbox sync is live,
    flagged conversations auto-draft replies to new inbound messages
    (still approval-gated before anything sends)."""
    convo = get_by_id("conversations", conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    convo["autoReply"] = (not convo.get("autoReply", False)) if body.enabled is None else body.enabled
    audit("Unified Inbox", f"Auto-reply {'enabled' if convo['autoReply'] else 'disabled'} for {convo.get('contact')}")
    return {"ok": True, "autoReply": convo["autoReply"]}


# --- Voice Calls ---
@router.get("/voice-calls")
def list_voice_calls():
    return DB["voice_calls"]


# --- QA & Delivery ---
@router.get("/qa-runs")
def list_qa_runs():
    return DB["qa_runs"]


@router.post("/qa-runs/{run_id}/rerun")
def rerun_qa(run_id: str):
    run = get_by_id("qa_runs", run_id)
    if not run:
        raise HTTPException(404, "QA run not found")
    run["status"] = "Queued"
    audit("QA & Delivery", f"Re-running QA on {run['pr']}")
    return run


@router.get("/deliverables")
def list_deliverables():
    return DB["deliverables"]


@router.post("/contracts/{contract_id}/deliver")
def deliver_contract(contract_id: str):
    contract = get_by_id("contracts", contract_id)
    if not contract:
        raise HTTPException(404, "Contract not found")
    contract["status"] = "Delivered"
    audit("QA & Delivery", f"Delivered {contract['title']} to {contract['client']}")
    return {"ok": True, "contract": contract}


# --- HITL Queue ---
@router.get("/hitl")
def list_hitl():
    return DB["hitl"]


@router.post("/hitl/{item_id}/take")
def take_hitl(item_id: str):
    item = get_by_id("hitl", item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    item["status"] = "In Review"
    audit("System", f"HITL {item_id} taken by operator")
    return item


@router.post("/hitl/{item_id}/resolve")
def resolve_hitl(item_id: str):
    item = get_by_id("hitl", item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    item["status"] = "Resolved"
    audit("System", f"HITL {item_id} resolved")
    return item
