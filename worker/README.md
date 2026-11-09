# Autopilot Automation Worker

Separate browser-automation service. Runs the user's own-account tasks
(auto-apply, post gig, send message) in a real browser via `browser-use` +
Playwright, pausing before any outbound step so the main app can require
human approval.

## Why separate
Playwright needs a real browser — it can't run on Vercel or a plain web dyno.
This is its own service.

## Deploy (Render — new Web Service)
- Root directory: `worker`
- Build command: `pip install -r requirements.txt && playwright install --with-deps chromium`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars:
  - `WORKER_KEY` — shared secret; set the same value as `WORKER_KEY` on the main API.
  - `OPENAI_API_KEY` (or configure another provider browser-use supports) — for the agent LLM.
  - `WORKER_MODEL` (optional, default `gpt-4o-mini`), `WORKER_MAX_STEPS` (optional, default 25).

Then on the **main backend** set `WORKER_URL=https://<this-worker>.onrender.com`.

## Local dev
Without `browser-use`/`playwright` installed it runs in **simulation mode** —
returns a realistic step log so the queue + approval UI works end-to-end.

```
pip install fastapi uvicorn pydantic
WORKER_KEY=dev-worker-key uvicorn main:app --port 9000
```

Set the same `WORKER_KEY` (and `WORKER_URL=http://localhost:9000`) in
`backend/.env`. Only platform owners' jobs (`OWNER_EMAILS`) use the worker;
everyone else's jobs are simulated until per-user account connections exist.

## Contract
`POST /run { job_id, kind, platform, url, instructions, fields, dry_run }`
(header `X-Worker-Key: <WORKER_KEY>` required — without `WORKER_KEY` set, `/run` refuses every call)
→ `{ status: "needs_approval" | "completed" | "failed", steps: [...] }`

`dry_run=true` stops before the final submit/send/publish/pay step.
The main API only sends `dry_run=false` after a human approves.
