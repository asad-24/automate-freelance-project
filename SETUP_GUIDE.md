# Setup Guide: What We Need and How to Get It

_Last updated: 2026-11-01. Goes with [PLAN.md](PLAN.md)._

This lists every account, key and service the plan needs, who should get it, what it costs, and the steps to get it.

> **Before you start:** prices, limits and approval rules below come from public pages checked on 2026-10-31. Re-check them on each official page when you sign up.

---

## Quick checklist

Start the **long lead-time** items today. They depend on someone else approving us.

| # | What | Who | Cost | Lead time |
|---|---|---|---|---|
| 1 | Upwork commercial API permission | Client | Free | ⏳ Weeks, not guaranteed |
| 2 | Upwork API key | Client | Free | ⏳ Days–weeks (manual review) |
| 3 | Fiverr partnership inquiry | Client | Free | ⏳ Unknown |
| 4 | Freelancer.com production app | Dev | Free | ⏳ Needs approval |
| 5 | Freelancer.com sandbox account + app | Dev | Free | Same day |
| 6 | Fiverr seller test account | Client | Free | Same day |
| 7 | Dedicated test mailbox | Dev | Free | Same day |
| 8 | Nango, Composio, and Activepieces integration services | Dev | Depends on selected plans | Configure when OAuth providers and workflows are approved |
| 9 | Inbound email provider + verified domain | Client + Dev | Provider/domain dependent | 1–3 days |
| 10 | Custom domain | Client | ~$10–15/yr | Same day |
| 11 | Redis (job queue) | Dev | Free tier | Same day |
| 12 | Sentry (error tracking) | Dev | Free tier | Same day |
| 13 | Render Starter plan | Client | $7/mo per service | Same day |
| 14 | GitHub Actions (CI) | Dev | Free | Same day |
| 15 | Secret keys (JWT and service credentials) | Dev | Free | 5 minutes |
| — | Already have: MongoDB Atlas, Groq, Vercel | — | — | Just check them |

---

## Part A: Long lead-time items (start today)

### 1. Upwork commercial API permission ⚠️ most important
**Why:** Upwork's support pages say a normal API key is for **personal and internal use only**. Commercial use is limited to selected partners with **prior written permission**. Our product is commercial, so a normal key alone isn't enough to let our users connect their Upwork accounts.

**Who:** Client (company owner).

**Steps:**
1. Read Upwork's "Commercial API use" support article: https://support.upwork.com/hc/en-us/articles/17995890765459
2. Email **partnerships@upwork.com** from the company email address. Include:
   - the company name and website, and a one-line description of the product
   - exactly what we want to do: read the user's own job search results, draft proposals that **the user approves before sending**, and read and reply to messages in one inbox
   - that every action happens on the user's own account, with their consent through OAuth, and nothing is sent without human approval
   - expected number of users and API requests
   - a request for the commercial API terms and the application process
3. Follow up after 1–2 weeks if there's no reply.

**Done when:** we have written permission, or a clear no. **If it's a no,** Upwork stays as "AI draft + paste" in the matrix and the product still works.

### 2. Upwork API key
**Why:** needed to develop and test the connector, and for the commercial app once permission arrives.

**Who:** Client, or whoever owns the main Upwork account. The key belongs to the account that applies for it.

**Requirements** (according to Upwork's support pages):
- a real name (not a company name)
- a profile photo
- an active, verified payment method
- identity verification completed

**Steps:**
1. Complete the profile requirements above.
2. Go to https://www.upwork.com/developer/keys/apply
3. Fill in the form:
   - **Use case:** describe the intended commercial multi-user product honestly and ask Upwork which app type and scopes apply.
   - Do not present this as an internal-only tool; a standard key does not grant commercial permission for this product.
   - **Role:** agency owner or developer.
   - Follow the current rate limits shown in the approved app and API documentation; don't rely on old third-party limit figures.
4. Wait for the approval email. If it's rejected, fix whatever they mention and apply again.
5. Once approved, confirm which exact scopes are granted: `Read public marketplace Job Postings` for search, `Submit Proposal` for proposals, and `Messaging - Read-Only Access` or `Messaging - Read and Write Access` for room stories. Sending messages requires `Messaging - Read and Write Access`. Confirm written commercial permission covers the product and its pricing model. The API documentation currently sets a 24-hour maximum cache window; follow the approved app's rate limits and current token rules. Send the **client ID and secret** to the developer **through a password manager**, not chat or email.

**Done when:** API access and written commercial permission cover this product, the required scopes are granted, and the key is securely stored. Live calls stay disabled before then.

### 3. Fiverr partnership inquiry
**Why:** no seller-side API capability was established in this research pass, and Fiverr's Terms prohibit bots and automated retrieval. Ask Fiverr what approved seller-side integrations, if any, are available. The product doesn't depend on API access.

**Who:** Client.

**Steps:**
1. Use the partnerships contact form: https://block.fiverr.com/partnerships/contact. Background on the API offer: https://block.fiverr.com/partnerships/platform-solutions
2. Ask specifically about **API access for sellers**: reading their own messages, managing their own gigs, and receiving order notifications. Explain the safety angle (no bots, user consent, human approval).

**Done when:** we get a reply. Until then, only manual copy/paste workflows are enabled; email notification content still needs testing.

### 4. Freelancer.com production app
**Why:** sandbox development only until Freelancer.com gives written permission covering automated API access for this commercial multi-user product. The current User Agreement and API Terms raise material restrictions on API access, competition, and business reliance.

**Who:** Developer, logged in with the company's Freelancer.com account.

**Steps:**
1. Read the docs: https://developers.freelancer.com
2. Create the app at https://accounts.freelancer.com/settings/create_app
   - **Redirect URI:** `https://<backend-domain>/api/freelancer/oauth/callback` (we'll build this endpoint).
   - **Scopes:** basic + advanced (needed to place bids and read messages).
3. Ask Freelancer.com in writing whether the proposed project search, bid, messaging, and multi-user workflows are permitted and what app approval/scopes apply. Do not enable production API calls until you receive and retain written approval.
4. Keep the **client ID and secret** in the password manager.

**Done when:** written product-scope permission and app approval are in hand. Set `FREELANCER_API_APPROVED=true` only then.

---

## Part B: Test accounts

### 5. Freelancer.com sandbox account and app
**Why:** test real bidding and messaging **with no risk to a real account**.

**Who:** Developer.

**Steps:**
1. Sign up at https://www.freelancer-sandbox.com, with **two** accounts: one freelancer and one employer. The employer posts test projects, and the freelancer bids on them.
2. Register a sandbox app at https://accounts.freelancer-sandbox.com (same steps as item 4, with redirect `http://localhost:8000/api/freelancer/oauth/callback`).
3. Set `FREELANCER_SANDBOX=true` in `backend/.env`.

**Done when:** we can post a project as the employer, bid on it as the freelancer through our API, and see the bid.

### 6. Fiverr seller test account
**Why:** to see what Fiverr notification emails actually contain (the full message or just a preview), and to test the copy-and-paste flows.

**Who:** Client. Use a real person's account, since Fiverr allows one account per person.

**Steps:**
1. Use an existing seller account, or sign up at https://www.fiverr.com and become a seller.
2. Turn on **email notifications** for messages and orders in Fiverr's notification settings.
3. Point the notifications to the **test mailbox** (item 7), or forward them there.
4. Send a few test messages from a second (buyer) account so we can collect real sample emails.

**Rule:** we only test email ingestion and manual pasting. **No automation runs against Fiverr.**

### 7. Dedicated test mailbox
**Why:** collects notification emails from Fiverr, Upwork and Freelancer.com for building and testing the parsers.

**Who:** Developer.

**Steps:**
1. Create a new Gmail or Outlook mailbox, for example `autopilot.test.inbox@…`.
2. Set it as the notification email (or a forwarding target) on the test accounts from items 5 and 6.
3. Save sample emails (with personal data removed) into `backend/tests/fixtures/emails/` for the automated tests.

---

## Part C: Integration services

### 8. Integration services: Nango, Composio, Activepieces
Use each service for a distinct job; do not connect the same user/provider through both Nango and Composio.

- **Nango — product OAuth connections.** The API mints short-lived Connect sessions at `/api/integrations/nango/session` for integration IDs explicitly listed in `NANGO_INTEGRATIONS`. The Accounts page opens Nango's official Connect UI SDK. After authorization, the backend verifies the connection belongs to the signed-in app user and stores only its connection ID; tokens stay in Nango. Create a Nango project, configure each integration with approved OAuth app credentials/scopes, and set `NANGO_SECRET_KEY`, `NANGO_BASE_URL` if self-hosted, and allowed integration IDs in Render. Configure `microsoft-outlook` for optional read-only inbox import and `upwork` for per-user Upwork OAuth/job search. The app hides those Connect flows until their approval gates are enabled. Proposal submission and other marketplace actions still require separate implementation and approval.
- **Composio — agent tool sessions.** `/api/integrations/composio/session` creates a per-user tool session, restricted by `COMPOSIO_ALLOWED_TOOLKITS`. Create a Composio project and a narrowly scoped project key, then set `COMPOSIO_API_KEY` and the toolkit allowlist. This currently prepares agent sessions; no marketplace actions are exposed or run automatically.
- **Activepieces — event-driven workflows.** Create a flow with a webhook trigger, protect it with a shared Bearer secret, and set both `ACTIVEPIECES_WEBHOOK_URL` and `ACTIVEPIECES_WEBHOOK_SECRET`. The app currently sends a minimal `inbox.message_received` event (user ID, platform, and internal message ID; no message body). Use flows for notifications or internal follow-up, not for bypassing marketplace controls.

These services do not grant platform permission. Keep Upwork, Freelancer.com, and Reddit integrations disabled until their required provider approvals and user OAuth apps are in place. For Upwork, configure a Nango integration whose ID is exactly `upwork`, with the approved OAuth client and `Read marketplace Job Postings` scope; set `UPWORK_COMMERCIAL_APPROVED=true` only after written approval. Live job search calls GraphQL through each signed-in user's own Nango connection. Fiverr remains a forwarded-email and manual-reply workflow.

### 9. Email ingestion route (option B selected first)

**Option B: Forward to our own address (recommended first)**

This avoids Google's restricted-scope review completely.

1. Get the domain (item 10). Create a subdomain for incoming mail, for example `in.<domain>`.
2. Client selects an inbound email provider (Postmark Inbound, Mailgun Routes or SendGrid Inbound Parse). Add the **MX record** for `in.<domain>` that the provider gives you.
3. Point the provider's webhook to `https://<backend-domain>/api/inbox/inbound`.
4. Set `INBOUND_EMAIL_DOMAIN=in.<domain>` and a randomly generated `INBOUND_EMAIL_WEBHOOK_SECRET` in Render. Configure the provider to send `Authorization: Bearer <secret>` and map the message fields to the endpoint schema (Postmark `From`, `To`, `Subject`, `TextBody`, `HtmlBody`, and `MessageID` are accepted). Leave `INBOUND_EMAIL_PLATFORMS` empty until each platform's forwarding contents and allowed use have been manually reviewed.
5. After verification, set `INBOUND_EMAIL_PLATFORMS` to only the reviewed comma-separated platforms (for example `Fiverr`). Each signed-in user can then generate a unique `u-<opaque-token>@in.<domain>` address in the Unified Inbox. They create a Gmail or Outlook filter for platform notification senders and forward to that address. The code deduplicates by Message-ID and only drafts replies for manual copy/paste.
6. Gmail may require forwarding-address verification. That verification code is not surfaced in this app yet, so complete verification through the mailbox/provider workflow before forwarding; test end-to-end with the dedicated test mailbox before enabling it for users.

**Option A1: Outlook / Microsoft 365 (Microsoft Graph)**
1. In Microsoft Entra, register an app that supports the account types you intend to serve. Add only the delegated **Mail.Read** and `offline_access` scopes needed for read-only mailbox import.
2. Configure the `microsoft-outlook` integration in Nango with the app credentials and delegated `Mail.Read` scope. Add `microsoft-outlook` to `NANGO_INTEGRATIONS`; the Accounts page will offer the connection only after the approval flag and sender allowlist are enabled.
3. Complete the required consent/publisher and privacy review. Keep `OUTLOOK_INBOX_READ_APPROVED=false` until that is complete.
4. Set `INBOUND_EMAIL_PLATFORMS` to only reviewed marketplace senders. A signed-in user connects Outlook on Accounts & Platforms; they can press **Sync now** in Unified Inbox, and the worker polls ready connections every 15 minutes. The importer searches for supported notification senders, stores a normalized copy, and never sends, marks read, moves, or deletes mailbox messages.

**Option A2: Gmail API (later, if needed)**
1. Create a Google Cloud project at https://console.cloud.google.com, enable the Gmail API, and set up the OAuth consent screen.
2. `gmail.readonly` is a **restricted scope**. In testing mode it allows at most 100 test users. To launch, it needs Google's OAuth verification plus a **yearly CASA security assessment** by an approved third-party assessor, and the cost is paid by us.
3. Start this only after option B has proven demand.

---

## Part D: Infrastructure

Step-by-step Vercel and Render deployment, every environment variable per service, smoke tests and rollback are in [docs/deployment.md](docs/deployment.md).

### 10. Custom domain
**Who:** Client. **Cost:** about $10–15/year.
1. Buy it at Cloudflare Registrar or Namecheap.
2. Point `app.<domain>` to Vercel (Vercel project → Settings → Domains) and `api.<domain>` to Render (service → Settings → Custom Domains).
3. Add both new URLs to the backend's `CORS_ORIGINS`.
4. Needed for: email ingestion (option B), OAuth redirect URIs, and to look credible to Upwork and Fiverr.

### 11. Redis (for the job queue and scheduler)
> **Free demo deployment:** `render.yaml` currently uses Render's free plan and leaves Redis and the queue switched off (Render has no free background workers). Re-enable them with [docs/deployment.md → After the demo](docs/deployment.md#after-the-demo-upgrading-to-production).

**Who:** Developer. **Cost:** Render Key Value plan selected in `render.yaml`.
1. The Blueprint provisions `autopilot-redis` and injects its private connection URL into the API and queue worker as `REDIS_URL`.
2. The Arq worker refreshes public job feeds every 15 minutes. The email-sync schedule is ready, but stays inactive until email connections are implemented in Phase 3.

### 12. Sentry (error tracking)
**Who:** Developer. **Cost:** free Developer plan.
1. Sign up at https://sentry.io and create two projects: `autopilot-web` (Next.js) and `autopilot-api` (FastAPI).
2. Copy the web DSN into the frontend's `NEXT_PUBLIC_SENTRY_DSN`, and the API DSN into `SENTRY_DSN` on Render. Event capture is disabled until those values are set.

### 13. Render Starter plan
> **Free demo deployment:** the API is on the free plan for the client demo; it sleeps after 15 idle minutes. Switch back to Starter when upgrading (see [docs/deployment.md](docs/deployment.md#after-the-demo-upgrading-to-production)).

**Who:** Client. **Cost:** $7/month per service.
1. Sync the updated `render.yaml` Blueprint. It sets `autopilot-api` to the Starter-equivalent `0.5c-512mb` plan so it stays awake for scheduled work.
2. The browser automation worker remains on the free plan unless it is still used and needs an upgrade.

### 14. Secret keys
**Who:** Developer. **Cost:** free.
```bash
# JWT signing key
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
# Encryption key for stored platform tokens (needs: pip install cryptography)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Set `SECRET_KEY` with **different values for dev and prod**. `TOKEN_ENCRYPTION_KEY` will be added before OAuth tokens are stored; do not place platform tokens in workspace settings. If a key is ever exposed, generate a new one and replace it.

---

## Part E: Already have (just check them)
- **MongoDB Atlas:** confirm the database user has a strong password and that network access isn't open to `0.0.0.0/0` if it can be avoided. Turn on backups when moving to a paid tier.
- **Groq:** confirm the key works and check its usage limits.
- **Vercel:** confirm `NEXT_PUBLIC_API_URL` is set, and set `NEXT_PUBLIC_DEV_BYPASS_AUTH=false` in **production**.

---

## Part F: Where each value goes

Never commit these values. Locally they go in `backend/.env` (already git-ignored). In production they go in the Render or Vercel dashboard. Share them only through a password manager such as 1Password or Bitwarden.

| Variable | Where | From item |
|---|---|---|
| `SECRET_KEY` | Render | 15 |
| Upwork OAuth client ID/secret | Nango `upwork` integration (only after approval) | 2 |
| Freelancer OAuth client ID/secret | Nango console (only after written permission) | 4, 5 |
| `FREELANCER_SANDBOX` | Render | 4, 5 |
| `NANGO_SECRET_KEY`, `NANGO_INTEGRATIONS` | Render | 8 |
| `OUTLOOK_INBOX_READ_APPROVED=false` | Render; keep false until Mail.Read consent and privacy review are complete | 8 |
| `INBOUND_EMAIL_PLATFORMS` | Render; reviewed sender allowlist required for inbox imports | 9 |
| `COMPOSIO_API_KEY`, `COMPOSIO_ALLOWED_TOOLKITS` | Render | 8 |
| `ACTIVEPIECES_WEBHOOK_URL`, `ACTIVEPIECES_WEBHOOK_SECRET` | Render | 8 |
| `INBOUND_WEBHOOK_SECRET` | Render | 9 |
| `REDIS_URL` | Render | 11 |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Render / Vercel | 12 |
| `MONGODB_URI`, `GROQ_API_KEY` | Render (already set) | E |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH=false` | Vercel (production) | E |

Marketplace tokens remain provider-approved credentials. Do not put provider tokens into workspace settings; use Nango's managed connections once each approved OAuth flow is configured.

---

## Sources
- Upwork: [Request an API key](https://support.upwork.com/hc/en-us/articles/115015857647-Request-an-API-Key) · [Commercial API use](https://support.upwork.com/hc/en-us/articles/17995890765459--Commercial-API-use) · [Developer portal](https://www.upwork.com/developer)
- Freelancer.com: [Official OAuth demo app](https://awesome.ecosyste.ms/projects/github.com%2Ffreelancer%2Ffreelancer-oauth-demo-app) · [OAuth2 client (app approval note)](https://packagist.org/packages/serg-php/freelancer-oauth2-client) · [Python SDK (sandbox URL)](https://pypi.org/project/freelancersdk/0.1.5/)
- Fiverr: [Partnerships contact](https://block.fiverr.com/partnerships/contact) · [Platform solutions](https://block.fiverr.com/partnerships/platform-solutions)
- Gmail: [Gmail API scopes](https://developers.google.com/gmail/api/auth/scopes) · [Nango: Google security review](https://nango.dev/docs/api-integrations/google-shared/google-security-review)
- Nango and Composio: [What is Nango](https://docs.nango.dev/what-is-nango) · [Composio pricing](https://composio.dev/pricing.md) · [Nango pricing comparison (third-party)](https://toolradar.com/tools/nango/pricing)
