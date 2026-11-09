"""LLM layer — Groq (OpenAI-compatible chat completions).

Used to write real proposal/bid text during acquisition cycles. If the key is
unset or the call fails, callers fall back to the template text — the platform
never hard-breaks on an AI outage.

Free-tier default model: openai/gpt-oss-120b (Groq's flagship open model).
"""
import asyncio

import httpx

from .config import get_settings

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def enabled() -> bool:
    return bool(get_settings().groq_api_key)


async def achat(messages: list[dict], **kwargs) -> str | None:
    """`chat` for async routes — runs the blocking HTTP call off the event loop."""
    return await asyncio.to_thread(chat, messages, **kwargs)


def chat(messages: list[dict], *, max_tokens: int = 400, temperature: float = 0.7) -> str | None:
    settings = get_settings()
    if not settings.groq_api_key:
        return None
    try:
        payload: dict = {
            "model": settings.groq_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        # gpt-oss models burn completion budget on hidden reasoning — with a
        # tight max_tokens they return finish_reason="length" and EMPTY content.
        # Low effort + extra headroom leaves room for the actual answer.
        if "gpt-oss" in settings.groq_model:
            payload["reasoning_effort"] = "low"
            payload["max_tokens"] = max(max_tokens * 3, 1024)
        with httpx.Client(timeout=30) as client:
            res = client.post(
                _GROQ_URL,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if res.status_code == 200:
            return res.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        pass
    return None


def write_proposal(title: str, platform: str, budget: int) -> str | None:
    """Generate a real bid/proposal body for a scraped freelance lead."""
    return chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a senior freelancer's AI agent writing short, persuasive project bids. "
                    "Write 110-150 words: specific plan, relevant skills, fast delivery, one concrete question. "
                    "No placeholders, no headers, plain text only."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Job on {platform}: \"{title}\" — client budget ${budget}. "
                    "Write the bid we'd submit."
                ),
            },
        ],
        max_tokens=450,
    )


def write_outreach(company: str, industry: str, funding: str) -> str | None:
    """Cold outreach message for a funded B2B startup."""
    return chat(
        [
            {
                "role": "system",
                "content": (
                    "You write short cold emails for an agency. 60-90 words, direct, "
                    "one clear value hook tied to their funding/industry, soft CTA. Plain text."
                ),
            },
            {
                "role": "user",
                "content": f"Prospect: {company} — {industry}, recently raised {funding}. Write the outreach.",
            },
        ],
        max_tokens=320,
    )
