# Launch readiness checklist

The go/no-go list to run before each release or client demo. It was adapted from the separate "launch pass" build (`Autopilot-launch/`), whose improvements were merged into this app on 2026-11-05. Each item is **PASS**, **WARN** or **BLOCKER**.

## How to run the checks

```bash
npm run qa                       # static gap-check, instant; writes docs/gapcheck-report.md
```

To also run the browser checks, set up once:

```bash
npm i --no-save playwright && npx playwright install chromium
```

Then, in two terminals:

```bash
# Terminal 1: build the frontend-only demo so every page opens without login
NEXT_PUBLIC_DEV_BYPASS_AUTH=true npm run build && npm start -- -p 3100

# Terminal 2: visit all ~80 routes and report errors and broken links
BASE_URL=http://localhost:3100 npm run qa:crawl
```

The **auth guard** check needs a separate build *without* the bypass and pointed at a backend, served on port 3200. It confirms that logged-out visitors are sent to the login page:

```bash
BASE_URL=http://localhost:3200 npm run qa:auth
```

Playwright is installed on demand rather than listed in `package.json`, so Vercel builds don't download a browser.

## Status (2026-11-05)

| Area | Status | Notes |
|---|---|---|
| Server-side auth and per-user data | PASS | JWT sessions on every data route; each user's workspace, ledger and calendar are stored per account. |
| Auth bypass off in production | PASS | Only `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` enables it. |
| Fake "success" messages | PASS | "Redirecting to Stripe", "Funds released from escrow" and the simulated card checkout now say plainly that payments aren't connected. |
| Invented numbers | PASS | Profile and freelancer earnings/bid stats show "—" until real data exists. |
| Dead buttons | PASS | Receipt download, file open, profile photo, persona form and portfolio match all work. |
| Payments | PASS (honest) | Checkout is closed until `NEXT_PUBLIC_PAYMENTS_LIVE=true`. Set that only once Stripe is integrated. Free-plan profile limits aren't enforced while payments are closed. |
| **Terms promise escrow via Stripe** | **BLOCKER** | `app/(marketing)/legal/terms/page.tsx` says client funds are held in escrow via Stripe. That isn't built. Reword before taking real customers (needs a legal review). |
| Reliability | PASS | 75 s request timeout (allows a free Render instance to wake); `error.tsx`, `dashboard/error.tsx`, `global-error.tsx` and `not-found.tsx`. |
| SEO | PASS | `robots.txt`, `sitemap.xml`, icon, Open Graph and Twitter metadata (`NEXT_PUBLIC_SITE_URL`). |
| og:image | WARN | Add `app/opengraph-image.png` (1200×630) for link previews. |
| Accessibility | PASS (static check) | Tabs carry ARIA roles; icon-only buttons are labelled; `Badge` renders a `<span>`, which also fixes a hydration error. |
| Error monitoring | PASS | Sentry is wired on frontend and backend; it reports once DSNs are set. |
| Cookie notice | WARN | Needed if you serve EU visitors and add analytics. |
| Uptime and backups | TODO | On Render's free plan the API sleeps after 15 idle minutes, and Atlas M0 has no backups. Add an uptime check and backups before real customers. |

## What to check for anything missing

Walk each lens. For every row ask: does it exist, does it work, is it honest, is it measured?

1. **Journeys** (per role: admin, freelancer, client): land, sign up, onboard, first value, repeat use, pay, get support, leave. Any step without a screen is a gap.
2. **Every button has an outcome:** it navigates, changes visible state, opens a dialog, or says plainly "not available yet". `npm run qa` flags silent buttons.
3. **Every number has a source:** real data or "—". Never an invented figure.
4. **Every list has four states:** loading, empty, error, populated.
5. **Every form:** validation, disabled while submitting, success and failure feedback.
6. **Trust and money:** Terms and Privacy match what is built; refund policy; what happens when a payment fails.
7. **Security:** authentication, who can see whose data, rate limits, secrets, CORS, input validation, audit log.
8. **Reliability:** timeouts, retries, error boundaries, 404/500, behaviour when the API is down.
9. **Performance:** first-load JS, image sizes, Lighthouse ≥ 90 on marketing pages.
10. **Accessibility:** keyboard path, focus rings, labels, contrast, reduced motion.
11. **Observability:** errors, funnels (signup → first scan → first proposal), uptime.
12. **Operations:** environment variables documented, deploy and rollback steps, backups, who is on call.
13. **Support:** where a stuck user goes (email link, help page, in-app feedback).

## 10-minute manual smoke test

1. Open `/` on a phone and a desktop. The call-to-action works.
2. Sign up as an admin, then reload: the session persists. Log out: you are redirected.
3. **Job Radar → Scan now** returns live listings. Open one and click **AI Draft**.
4. **Money:** record an income and an expense, create an invoice, mark it paid, export CSV. Reload from another browser: the data is still there, because it's saved to the account.
5. **Calendar:** add an event, edit it, hide a layer, export `.ics`. The invoice due date appears automatically.
6. **Profile:** change the photo; stats show "—".
7. Any **Upgrade** button says payments open soon and asks for no card details.
8. Visit a nonsense URL to see the friendly 404. Stop the API: pages still render, with a "can't reach the server" notice.

## Post-launch backlog

1. Stripe Checkout and webhooks, then set `NEXT_PUBLIC_PAYMENTS_LIVE=true`. Reword the escrow claim in the Terms, or build escrow.
2. Store profile photos server-side; today a photo is kept in the browser that uploaded it.
3. An Open Graph image, a cookie notice if analytics are added, and an uptime check.
