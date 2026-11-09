# Capital workspace: sandbox implementation

This increment implements the founder's funding/protection/investment workflows
as an explicitly labelled sandbox. The chain, token, custody provider, capital
source, financial instruments and coverage terms have not been chosen. There
are no signing, checkout, transfer, wallet-key or blockchain calls in this module.
Changing an environment flag cannot turn these workflows into live payments.

## Implemented journeys

- Freelancer/agency professional-profile submission → independent sandbox review.
- Awarded project evidence → independent review → funding request → approval →
  simulated advance → simulated settlement.
- Reviewed project → protection application → approval → simulated activation →
  evidence-based claim → approval/rejection → simulated payout.
- Reviewed freelancer/agency → proposed listing → independent approval → public
  sandbox marketplace → private investor commitments → portfolio tracking.
- Platform listings can only be proposed by a provisioned platform owner and
  must be reviewed by a different provisioned owner.
- Wallet/token readiness page honestly reports missing infrastructure. Connection,
  purchases, balances and on-chain transactions are unavailable.

Routes: `/dashboard/{funding,protection,investments,wallet}` and the same routes
under `/freelancer`. Client accounts can browse `/client/investments` and
`/client/wallet`. Each uses the existing dashboard shell and visual tokens.
The reviewer console is a button in these screens, visible only after the
backend confirms owner access. No sample businesses or invented returns are seeded.

## Explicit illustrative assumptions

`backend/app/routers/finance.py::RULES` owns the versioned sandbox assumptions:

| Rule | Sandbox assumption |
| --- | --- |
| Display currency | USD; integer minor units, not crypto balances |
| Maximum advance | 80% of reviewed project value |
| Advance fee | 2.5% of requested principal, rounded upward to a cent |
| Net advance | Principal minus fee |
| Settlement | Principal; no interest schedule is implied |
| Protection service fee | Founder-specified 3% of project value, rounded upward to a cent; no minimum or risk surcharge |
| Illustrative coverage | 80% of project value |
| Minimum marketplace commitment | At least $10; each listing can raise its minimum |
| Amount limit | Positive integer cents, capped at $1,000,000 per input |

The protection service rate is the founder's specified **3%**. The other values
remain test assumptions, **not approved loan/investment terms, an insurance policy,
guarantees, or financial advice**. Every request explicitly
acknowledges the sandbox; fees and commitments never charge an account. Actual
verification, underwriting, funding capacity, reserve checks, settlement rights,
coverage eligibility, loss allocation and investment rights remain business decisions.

Pricing version `sandbox-v2-protection-3pct` applies to new protection applications.
Project estimates refresh using the current rules, including for older projects.
Previously saved funding/protection quote snapshots retain their original terms.
Examples: a $50 project previews a $1.50 fee; $100 previews $3; $1,000 previews $30.
The screenshot's suggested $3 minimum, caps and risk-based rates were not adopted.

## Setup and owner access

Use Node 22 and the documented Python 3.12 environment. Install the existing
dependencies; this feature adds no application dependency. The API reads its
existing `MONGODB_URI`/`MONGODB_DB` settings. Without MongoDB, its memory fallback
works locally and the UI explicitly warns that data is lost on restart. All
finance data is separate from browser-writeable workspace JSON and billing credits.

Run the backend from `backend/` and supply an exact frontend origin through
`CORS_ORIGINS`. Supply `NEXT_PUBLIC_API_URL` when building/running the frontend.
Do not enable the auth bypass to test authorization; create actual local accounts.

**Owner provisioning changed for security.** `OWNER_EMAILS` alone does not grant
access. Public signup always creates an unprivileged account. After independently
checking the operator's identity and control of their address, add that address
to `OWNER_EMAILS`, create its account, and run this from a trusted environment
with the same MongoDB configuration as the API:

```sh
python -m app.owner_access reviewed-operator@example.com --grant --identity-checked
```

To revoke:

```sh
python -m app.owner_access reviewed-operator@example.com --revoke
```

The CLI cannot provision a separately running memory-only API. Its explicit
`platform_owner` database field is never accepted from public signup, general
settings or finance forms. The API reloads account/role/ownership on each request,
so revocation and account disable/delete take effect for existing tokens too.
Reviewers cannot approve or progress their own cases. Use separate applicant,
reviewer and investor accounts; a platform-owner offering needs two reviewers.
Tests provision their fixture owners explicitly rather than relying on email claims.

Generic settings PATCH now rejects server-managed fields, including OAuth
connections, inbound routing hashes and dedicated bid-rule/profile-matching state.
Use the existing purpose-specific endpoints for those settings.

## API and persistence

All `/api/finance` operations require a current authenticated account.

| Endpoint | Purpose |
| --- | --- |
| `GET /overview` | Own cases, own commitments, rules and infrastructure readiness |
| `GET /marketplace` | Approved/open listing projection, no applicant/investor private records |
| `POST /verifications` | Freelancer/agency professional-profile review request |
| `POST /projects` | Project evidence; requires a reviewed profile |
| `POST /funding` | Advance request for the caller's reviewed, non-overdue project |
| `POST /protection` | Protection application for the caller's reviewed project |
| `POST /claims` | One claim for the caller's active sandbox protection, bounded by its quote |
| `POST /offerings` | Listing proposal; profile type must match, or explicit platform-owner access |
| `POST /offerings/{id}/commitments` | Replay-safe simulated investor commitment within remaining capacity |
| `GET /reviews` | Provisioned-owner review queue, limited to finance cases |
| `POST /reviews/{id}` | Versioned, reasoned status transition by an independent reviewer |

Creation bodies include `request_id` (UUID) and `acknowledged_sandbox: true`.
Schemas forbid extra fields and use strict bounded integers for money. Caller
supplied quotes, approvals, balances and financial statuses are rejected. Finance
queries never use data from manually marked-paid bookkeeping records as proof.
HTTPS evidence links are recorded and displayed; the backend never fetches them.
They do not prove control of an external marketplace account or receivable.

MongoDB collection `finance_sandbox` stores one atomic aggregate per case/listing.
Each has caller ownership, status, version, timestamps, request fingerprint and
embedded decision history. There is no TTL. The store uses deterministic IDs for
idempotent creation/business keys and compare-and-set replacement for changes.
For listings, commitments, total capacity and history change in the **same atomic
document write**; concurrent requests cannot overfill the sandbox target or consume
the same request twice. A changed replay payload returns 409. Closing a listing
blocks new commitments while preserving previously accepted replay results.

Conservative prototype bounds: 500 cases per account, 500 commitments per listing,
200 open listings returned, and 500 review records returned. A case has at most
one funding request, protection application and claim per relevant project/policy;
rejected cases are retained rather than silently edited or retried as a new advance.
Reviewer/API pagination, withdrawal/reapplication/appeals, provider-backed identity
verification, treasury accounting and long-term operational retention are future work.
This bounded sandbox aggregate design is **not a production financial ledger**.

## Verification

Run `pytest` from `backend/`. `tests/test_finance.py` covers authentication, owner
pre-registration, owner revocation/deleted users, protected setting writes,
tenant isolation, review eligibility, positive integer amounts, advance/claim
caps, quote precision, immutable transitions, self-review rejection, idempotency,
listing privacy, closed-listing behavior and concurrent target capacity.

For a **dedicated disposable MongoDB only**, use:

```sh
TEST_MONGODB_URI=mongodb://127.0.0.1:27028 pytest
```

The existing test harness drops `autopilot_test` before tests. Never point it at
a real customer database. The normal memory suite and real MongoDB suite should
both pass. Run frontend typecheck, lint and production build, then browser-test
applicant/reviewer/investor journeys, reload persistence, mobile layouts, failed
requests, modal keyboard interaction and cross-account access.

## Required before any live financial launch

Select the chain/assets/token rights and custody provider; define and fund advance
capital and claims reserves; establish verification and underwriting; approve actual
coverage and investment instruments; implement a precise monetary ledger, holds,
provider/webhook/chain reconciliation, replay/finality handling, secure signing and
treasury approvals. Obtain appropriate business/legal and independent security
review. The earlier project audit's unrelated dependency, billing, password-recovery,
portal and operational launch blockers are not resolved by this sandbox increment.
No deployment is part of this change.

## Verification recorded for this increment

- Memory-mode backend suite: **144 passed, 2 MongoDB-only tests skipped**.
- Disposable MongoDB suite: **146 passed** (MongoDB 8.0.5 on localhost).
- Type checking and production build passed. Lint has only the existing inbox
  effect-dependency warning; there are no new finance lint warnings.
- Browser applicant/reviewer/investor walkthrough passed: profile review, project
  review, quote precision, simulated advance, protection activation, claim review,
  simulated payout, agency listing, commitment and portfolio reload.
- The ten new routes passed a production-build browser smoke test without page
  errors. Four 390px mobile views fit their viewport; native modal Escape worked.
- Restarting the API retained all six sandbox case/listing records and the
  investor commitment in MongoDB. No external financial provider was called.
- The repository-wide static QA check still reports its existing Stripe/escrow
  Terms failure (22 pass, 3 warn, 1 fail). This increment does not certify launch.

Local execution used the available Python 3.14 interpreter; CI remains configured
for the project's Python 3.12 target. Existing Python/FastAPI deprecation warnings
remain. CI configuration now includes a frontend production build and both memory
and disposable-MongoDB backend runs; the remote CI workflow was not invoked here.
