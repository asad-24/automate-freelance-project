"""AI Studio — content generation for marketplace listings.

POST /api/studio/gig  →  generates a complete, optimized gig package
(title options, description, 3-tier pricing, tags, FAQ) ready for the
user to review and paste into Fiverr/Upwork. Content generation only —
the user publishes from their own account.
"""
import json
import re

from fastapi import APIRouter
from pydantic import BaseModel

from .. import llm

router = APIRouter(tags=["studio"])


class GigRequest(BaseModel):
    service: str                       # what they offer, e.g. "Next.js dashboards"
    platform: str = "Fiverr"           # Fiverr | Upwork | Contra ...
    userName: str = ""
    skills: str = ""                   # "React, TypeScript, Stripe"
    experience: str = ""               # "3 years", "10+ projects"


def _fallback(req: GigRequest) -> dict:
    svc = req.service or "freelance services"
    return {
        "titles": [
            f"I will build your {svc} — fast, professional, guaranteed quality",
            f"I will deliver high-quality {svc} tailored to your business",
            f"I will be your expert for {svc} — quick turnaround",
        ],
        "description": (
            f"Looking for reliable {svc}? I specialize in {req.skills or svc} and deliver "
            "work that gets results.\n\nWhat you get:\n• Clear communication throughout\n"
            "• On-time delivery\n• Unlimited reasonable revisions\n\nMessage me to discuss your project."
        ),
        "packages": [
            {"name": "Basic", "price": 50, "deliveryDays": 3,
             "details": f"Starter {svc} — core deliverable, 1 revision"},
            {"name": "Standard", "price": 150, "deliveryDays": 5,
             "details": f"Full {svc} — complete solution, 3 revisions"},
            {"name": "Premium", "price": 400, "deliveryDays": 7,
             "details": f"Comprehensive {svc} — everything + priority support, unlimited revisions"},
        ],
        "tags": [t.strip() for t in (req.skills or svc).split(",")][:5],
        "faq": [
            {"q": "How fast can you start?", "a": "I can usually begin within 24 hours of ordering."},
            {"q": "What do you need from me?", "a": "A short brief describing your goal and any examples you like."},
        ],
        "aiGenerated": False,
    }


@router.post("/studio/gig")
def generate_gig(body: GigRequest):
    prompt = (
        f"Create a top-converting {body.platform} gig listing for this freelancer.\n"
        f"Service: {body.service}\n"
        f"Skills: {body.skills or 'not specified'}\n"
        f"Experience: {body.experience or 'not specified'}\n"
        f"Freelancer name: {body.userName or 'a specialist'}\n\n"
        "Return ONLY valid JSON (no markdown, no commentary) with exactly this shape:\n"
        "{\n"
        '  "titles": ["3 punchy gig titles, under 80 chars each"],\n'
        '  "description": "compelling gig description, ~120 words, with bullet-style line breaks",\n'
        '  "packages": [\n'
        '    {"name":"Basic","price":50,"deliveryDays":3,"details":"what is included"},\n'
        '    {"name":"Standard","price":150,"deliveryDays":5,"details":"what is included"},\n'
        '    {"name":"Premium","price":400,"deliveryDays":7,"details":"what is included"}\n'
        "  ],\n"
        '  "tags": ["5 search tags buyers actually type"],\n'
        '  "faq": [{"q":"common buyer question","a":"short answer"}]  // 3 items\n'
        "}"
    )
    raw = llm.chat(
        [
            {"role": "system", "content": "You are a marketplace-conversion copywriter. Output strict JSON only."},
            {"role": "user", "content": prompt},
        ],
        # gpt-oss-120b is a reasoning model — needs headroom for its
        # internal chain-of-thought plus the full JSON response.
        max_tokens=3000,
    )
    if not raw:
        return _fallback(body)

    # Tolerant JSON extraction — models sometimes wrap in ```json fences.
    match = re.search(r"\{.*\}", raw, re.S)
    try:
        data = json.loads(match.group(0)) if match else {}
    except Exception:
        return _fallback(body)
    if not isinstance(data.get("titles"), list) or not data["titles"]:
        return _fallback(body)
    data["aiGenerated"] = True
    return data
