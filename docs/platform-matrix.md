# Platform capability research

_Reviewed: 2026-11-01; expanded to 79 platforms on 2026-11-03. This is a source-backed working matrix, not legal advice. “Unknown” means no primary source found that establishes the capability or permission; it does not mean the platform lacks the capability._

## Findings that affect implementation

- **Upwork:** the current GraphQL reference documents marketplace job search, proposal submission (`createJobProposal`, permission `Submit Proposal`), and room messaging. Room/story reading requires `Messaging - Read-Only Access` or `Messaging - Read and Write Access`; sending via `createRoomStoryV2` requires the latter. API docs do not state that Freelancer Plus is required for job search or proposal submission; proposals do require Connects, and Connects availability depends on the user's account/plan and purchase choices. API key approval and exact app scopes are required. Commercial API use requires prior written permission for selected partners. The API Terms also require express written permission/agreement to charge Upwork users for the Developer Application. Do not enable a commercial connector until permission covers the product and its pricing model. The docs state API data may not be cached longer than 24 hours; token lifetime and rate limits are subject to the current app/docs. [API reference](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html), [commercial API use](https://support.upwork.com/hc/en-us/articles/17995890765459--Commercial-API-use), [API Terms](https://www.upwork.com/legal#apiterms), [proposal help](https://support.upwork.com/hc/en-us/articles/211062998-How-to-submit-a-proposal-on-Upwork), [Freelancer Basic vs Plus](https://support.upwork.com/hc/en-us/articles/40444316172051--What-s-the-difference-between-Freelancer-Basic-and-Freelancer-Plus)
- **Freelancer.com:** the official SDK documents project search, bid creation, message/thread read and write, and sandbox testing. However, the User Agreement says automated access (including API access) requires express written permission. The API terms also say not to rely on the API in ordinary-course business and not to use it to replicate or compete with Freelancer's services. This product's marketplace aggregation and bid workflow need written scope approval before production calls. Existing API usage must remain off until approval is confirmed. [Developer portal](https://developers.freelancer.com/), [official SDK feature list](https://github.com/freelancer/freelancer-sdk-python), [User Agreement §33](https://www.freelancer.com/about/terms), [API Terms](https://www.freelancer.com/about/apiterms)
- **Fiverr:** notification delivery can be set to email, but public documentation does not establish whether message emails contain full text or a preview. Fiverr Terms §8.8 prohibit bots and automated retrieval/scraping. Keep all Fiverr actions manual; verify email contents with the seller test account before building an importer. Gig publishing requires email and phone verification and may require identity and tax information. [Terms §8.8](https://www.fiverr.com/legal-portal/legal-terms/terms-of-service), [notification settings](https://help.fiverr.com/hc/en-us/articles/37551956045201-Managing-your-account-settings), [create a Gig](https://help.fiverr.com/hc/en-us/articles/360010451397-Creating-a-Gig)
- **LinkedIn:** the User Agreement and Help Center prohibit unauthorized bots, scraping, automated messaging and activity; enforcement can include account restriction or shutdown. Do not use browser automation or scrape. Email alerts and manually supplied content remain the only candidate methods here, subject to data-use and email-content review. [User Agreement §8.2](https://www.linkedin.com/legal/user-agreement), [prohibited software](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions)
- **Contra:** Terms prohibit automated search/download, commercial or third-party-benefit use, and collecting or storing other users' personal information without permission; automated outreach can trigger restrictions or suspension. Do not build a connector or inbox importer without written approval. [Terms §§2, 3, 14](https://contra.com/policies/terms)
- **PeoplePerHour:** no API or feed (`/developers` and `/api` return 404; job pages carry no RSS link). The Terms of website use (Acceptable use, incorporated by §14) prohibit running "any form of auto-responder", crawling or spidering any page, and harvesting or scraping content. PPH emails project invites and notifications, but the sender address is undocumented. Inbox import stays off until a sample is reviewed; replies are drafts the user sends in WorkStream. [Terms of website use](https://www.peopleperhour.com/static/terms-of-website-use), [Terms](https://www.peopleperhour.com/static/terms)
- **Guru:** no API ("Guru API" results belong to getguru.com, a different company) and the site returns 403 to non-browser clients, including for robots.txt. The terms bar robots that interfere with the site, and the IP policy bars commercial use of site content without written permission. Job-match emails exist ([email settings](https://www.guru.com/help/freelancer/email-settings-freelancer/)); the sender is undocumented. [Terms](https://www.guru.com/terms-of-service/), [IP policy](https://www.guru.com/trademark-copyright-policy/)
- **Toptal:** Website Terms §General Conditions prohibit automated programs, robots, spiders and scrapers from accessing or monitoring site content, and restrict public materials to personal, non-commercial use. No official API for talent job search or inbox automation was found. Keep search and inbox manual; don't ingest or automate the site without written authorization. [Website Terms](https://www.toptal.com/tos)
- **RemoteOK and We Work Remotely:** both explicitly publish public job feeds and ask aggregators to credit and link the original job. Existing results retain the source and original link. [RemoteOK feeds FAQ](https://remoteok.com/faq), [WWR RSS feed](https://weworkremotely.com/remote-job-rss)
- **Reddit:** the Data API requires registered OAuth access; Reddit's terms prohibit unapproved collection and commercial API use needs Reddit approval. The current connector is now disabled unless both an OAuth token and `REDDIT_COMMERCIAL_APPROVED=true` are configured. [Data API Terms](https://redditinc.com/policies/data-api-terms), [User Agreement](https://redditinc.com/policies/user-agreement)
- **Hacker News:** an Algolia HN search integration reads both the monthly "Who is hiring?" thread and the "Freelancer? Seeking freelancer?" thread (posted by `jon_north` since Dec 2025, previously `whoishiring`; only `SEEKING FREELANCER` posts are kept, since `SEEKING WORK` posts are freelancers advertising). It is implemented, links to each original thread, and is disabled by default behind `HN_COMMERCIAL_REUSE_APPROVED`. This pass did not find a primary source granting commercial redisplay or specifying retention, so keep terms/reuse review open. [Hacker News FAQ](https://news.ycombinator.com/newsfaq.html), [Algolia HN API](https://hn.algolia.com/api)

## Capability matrix

“Method” describes a candidate workflow; “requirements / terms” records the known blocker or prerequisite. Unknown cells are not approved for implementation.

| Platform | Inbox / reply | Job finder | Bidding | Gig posting | Account setup | Test status |
|---|---|---|---|---|---|
| **Upwork** | Direct marketplace messaging API is not connected. User-forwarded email and optional read-only Outlook mailbox import are implemented behind sender/consent gates; replies stay manual drafts. Direct API read/send requires approved messaging scopes and written commercial permission. | Per-user OAuth via Nango, GraphQL `marketplaceJobPostingsSearch`, and `Read marketplace Job Postings`. No Freelancer Plus requirement found. Retain API data no longer than 24h. | `createJobProposal` with `Submit Proposal`; submission code is not implemented. Connects are required per user/job. Written commercial permission and user approval required. | Project Catalog API not verified; AI draft + user publishes. | Guided; user creates and verifies account. | Query shape aligned with current docs; live app/credential contract test pending. |
| **Freelancer.com** | Official SDK supports message/thread read/write; written permission and API scope review required. | Official project search exists; written permission required before automated API access. | SDK supports bid creation and sandbox; written permission required; human approval remains required by product policy. | Seller service/Gig publishing capability not verified; draft + manual publish only. | Guided; user creates and verifies account. | Unit-level rules only; sandbox account and live connector tests pending. |
| **Fiverr** | User-forwarded email and optional read-only Outlook mailbox import are implemented behind sender/consent gates; replies remain manual drafts. Real notification body and processing permission still need review. No bots or account retrieval. | Not applicable to seller workflow; no Briefs automation. | Not applicable. | AI draft saved locally; user publishes manually. | Guided; email/phone and possible identity/tax checks. | Parser code present; test mailbox sample verification pending. |
| **PeoplePerHour** | Notification email exists; message payload and ingestion permission unknown. Any reply must be pasted into WorkStream by user. | No official API/feed found in this pass; no scraping. | No official API found; manual submit only. | Offers are a documented feature; no publishing API established. Draft + paste candidate. | Guided; personal account and verification requirements apply. | Docs only; no account test. |
| **Guru** | Email + manual AI draft is unverified; account connection/API not verified. | API/feed not verified; no scraping. | API not verified; manual submit only if user chooses. | Not verified. | Guided. | Docs only; no account test. |
| **Contra** | Do not ingest or automate; Terms raise third-party data and PII concerns. Manual user-authored draft workflow requires further terms review. | Do not automate/search/download without written approval. | Do not automate. | Do not automate. | Guided; account creation and verification stay with user. | Terms reviewed; no integration test. |
| **LinkedIn** | Email + manual draft only as a candidate; never automate messaging or read account pages. | Email alerts/manual search candidate; no scraping. | Manual only; no bid API found. | Not applicable. | Guided; user creates and verifies account. | Terms reviewed; no account test. |
| **Toptal** | Manual only; site terms prohibit automated site access. Email content/processing permission unverified. | Manual only; no API found and automated site access is prohibited by website terms. | No capability established. | No capability established. | Guided; user applies and completes screening. | Terms reviewed; no account test. |
| **RemoteOK** | — | Public JSON/RSS feed; free, no auth; credit RemoteOK and link original listing. | — | — | — | Live connector; contract/live tests pending. |
| **We Work Remotely** | — | Public RSS feed; attribution and original link required. | — | — | — | Live connector; contract/live tests pending. |
| **Reddit r/forhire** | — | OAuth Data API only; registered access and commercial approval required. Disabled by default. | — | — | — | Disabled; no credential test. |
| **Hacker News** | — | Algolia HN API integration; disabled until commercial reuse review is complete. | — | — | — | Gated by `HN_COMMERCIAL_REUSE_APPROVED`; no credential required. |

Test status is specific to this repository. A documented API is not a live-tested integration. Live tests require approved credentials and written permissions where stated above.

## Expansion to 79 platforms (2026-11-03)

Every new platform was checked against primary sources: the operator's API docs, the notices inside API responses, terms of service, and robots.txt. Feeds were verified with one or two live requests each. Sites behind bot walls were not retried or worked around; where terms could only be read through a search-engine copy, the cell says so.

**How a platform is wired** depends on what its operator permits, in this order:

1. **On by default:** the operator publishes an API or feed for reuse and only asks for credit and a link. Results keep the source name and the unchanged original link.
2. **Gated (`JOB_SOURCES_APPROVED`):** the endpoint exists and the parser is built and tested, but reuse is not granted, or the terms or robots.txt conflict. It stays off until the review or written permission is recorded.
3. **Keyed:** an official API that switches on when its credentials are configured. Some also need approval, where the terms require a licence for revenue-generating products.
4. **Email + AI drafts / Guided:** no permitted automation. The user gets the official signup link, a setup checklist and AI drafts to paste, plus notification-email import where the sender domain is documented.

Fetches are shared across all users through a per-source cache (`backend/app/job_sources.py`), so adding sources does not multiply traffic per user or per saved search. Each cache TTL honours the operator's polling guidance.

### Coverage

| Category | Platforms | Live by default | Gated / keyed | Guided (email or manual) |
|---|---|---|---|---|
| Freelance marketplaces | 22 | — | Upwork (demo), Freelancer.com, Thumbtack | 19 |
| Talent networks | 15 | — | — | 15 |
| Creative & contests | 12 | — | Dribbble Jobs, ProBlogger, Topcoder | 9 |
| Remote job boards | 18 | RemoteOK, We Work Remotely, Jobicy, Arbeitnow, Himalayas, 4 Day Week | 12 | — |
| Job search APIs | 6 | — | 6 | — |
| Company career boards | 6 | — | 6 | — |
| **Total** | **79** | **6** | **30** | **43** |

### Job feeds and APIs

| Platform | Source id | State | Finding that sets the state |
|---|---|---|---|
| Jobicy | `jcy` | On | "Clearly credit Jobicy as the original source"; you can "store, cache, process, and redistribute job data"; at most one automated pass an hour. [docs](https://jobicy.com/jobs-rss-feed) |
| Arbeitnow | `arb` | On (remote/freelance only) | API `meta.terms`: "free public API… I would appreciate linking back"; ToS §11 asks for a link back and lets them revoke access. [blog](https://www.arbeitnow.com/blog/job-board-api), [terms](https://www.arbeitnow.com/terms) |
| Himalayas | `him` | On | "You can show Himalayas jobs on your own job board, website or app without asking us first." Keep `applicationLink` unchanged, link to Himalayas, don't pass jobs on to other boards or aggregators, and remove expired jobs (done via `expiryDate`). [api](https://himalayas.app/api) |
| 4 Day Week | `fdw` | On | "A free, public, no-auth JSON API… a link back to 4dayweek.io is all we ask"; ToS §10 bars using results to populate a competing job board. Job Radar is a private, logged-in tool, not a public board. Salaries are reported in cents. [developers](https://4dayweek.io/developers), [terms](https://4dayweek.io/terms) |
| Remotive | `rmt` | Gated | In-API legal notice: "Displaying our jobs in order to collect signups/email addresses to show a listing constitutes a breach." Job Radar requires login, so it needs written permission or Remotive's paid API. Max 4 calls a day (cache 6h). [docs](https://remotive.com/api-documentation) |
| Working Nomads | `wn` | Gated | No API terms; site ToS §3.1 bars commercially exploiting the service or building a competitive product. [terms](https://www.workingnomads.com/terms-and-conditions) |
| Crypto Jobs List | `cjl` | Gated | RSS channel says "All rights reserved"; ToS page sits behind a bot challenge. |
| Python.org Jobs | `pyj` | Gated | Official RSS, but no reuse terms for the jobs board; site legal page says "All rights reserved". [legal](https://www.python.org/about/legal/) |
| LaraJobs | `lara` | Gated | Public RSS, no terms page found. |
| Authentic Jobs | `auj` | Gated | robots.txt `Disallow: /*?` covers the feed URL; content is the "exclusive property of Authentic Jobs". [terms](https://authenticjobs.com/terms/) |
| NoDesk | `nod` | Gated | robots.txt Content-Signal `use=reference, ai-train=no` and blocks AI crawlers. |
| VueJobs | `vue` | Gated | robots.txt disallows `/` on app.vuejobs.com and `/feed` on vuejobs.com. |
| Real Work From Anywhere | `rwfa` | Gated | "Public RSS Feed… completely free" with no reuse terms; feed XML contains bare `&` (parser repairs it). [feeds](https://www.realworkfromanywhere.com/rss-feeds) |
| Dribbble Jobs | `drb` | Gated | Official `jobs.rss`, but the API Terms forbid using "the API, or any Dribbble data" for "a job advertising or job search service". [API terms](https://developer.dribbble.com/terms/) |
| ProBlogger Jobs | `pbl` | Gated | Official RSS of writing gigs; "All Rights Reserved", no reuse terms. |
| Topcoder | `tc` | Gated | `/v5/challenges` now 404; `/v6/challenges` is public. Site terms: "available to you for your information and personal use only". [terms](https://www.topcoder.com/community/how-it-works/terms) |
| Hacker News | `hn` | Gated | YC terms bar commercial redisplay unless authorized (see above). |
| Reddit r/forhire | `rdt` | Gated | Data API OAuth + commercial approval (see above). |
| The Muse | `muse` | Keyed | "Registration is required for any use beyond testing"; §3.4 content must link back; §3.3 bars cloning Muse content. [terms](https://www.themuse.com/developers/api/v2/terms) |
| USAJOBS | `usaj` | Keyed | "OPM provides Public Data under an open license… Prior OPM approval is not required." The User-Agent must be the registered email. [ToS](https://developer.usajobs.gov/guides/terms-of-service) |
| Jooble | `jbl` | Keyed | Free keys have a 500-request lifetime cap, so results are cached 12h. [help](https://jooblehelpcenter.freshdesk.com/en/support/solutions/articles/60001448238-rest-api-documentation) |
| Web3.career | `w3c` | Keyed | Free token; "Failure to provide follow links back to web3.career will result in API access suspension." Payload shape is documented but not live-verified (needs a token). |
| Adzuna | `adz` | Keyed + approval | "For any use in a product or service that generates revenue or leads, a licence agreement is required"; adverts must carry the Adzuna label. Predicted salaries are hidden. [ToS](https://developer.adzuna.com/docs/terms_of_service) |
| Reed.co.uk | `reed` | Keyed + approval | No API terms found; site T&C: "no copying for any commercial or business use is permitted". JSON key names are documented but not live-verified. [T&C](https://www.reed.co.uk/terms-and-conditions) |
| Findwork | `fw` | Keyed + approval | No terms page; republishes other boards (HN, RemoteOK, WWR), so the underlying rights are unclear. Shape not live-verified (docs behind login). |

### Company career boards

Users add companies on the Job Radar **Companies** tab (up to 25). Each provider's public job-board API is read for those companies only, cached for an hour, and every listing links to the company's own posting. None of these vendors grants a licence for showing listings in a third-party product, so each provider is gated. Enable one with its id in `JOB_SOURCES_APPROVED` after review.

| Provider | Id | Endpoint | Note |
|---|---|---|---|
| Greenhouse | `gh` | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | "Authentication is not required for any GET endpoints." `content` is entity-escaped HTML. [docs](https://developers.greenhouse.io/job-board.html) |
| Lever | `lev` | `api.lever.co/v0/postings/{site}?mode=json` | README: published postings "may be scraped by third parties". This warns customers; it is not a licence. [README](https://github.com/lever/postings-api) |
| Ashby | `ash` | `api.ashbyhq.com/posting-api/job-board/{name}` | Purpose: populating your own careers page. `isListed: false` postings are skipped. [docs](https://developers.ashbyhq.com/docs/public-job-posting-api) |
| SmartRecruiters | `smr` | `api.smartrecruiters.com/v1/companies/{id}/postings` | An invalid company returns 200 with an empty list. [docs](https://developers.smartrecruiters.com/docs/posting-api) |
| Workable | `wkb` | `apply.workable.com/api/v1/widget/accounts/{sub}?details=true` | Documented for building your own careers page. [help](https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page) |
| Recruitee | `rct` | `{company}.recruitee.com/api/offers/` | No reuse terms stated. The slug becomes a subdomain, so it is restricted to `[a-z0-9-]`. [docs](https://docs.recruitee.com/reference/offers) |

### Marketplaces, talent networks and creative platforms

None of these offers a freelancer-side API that this product could use, except Thumbtack's partner platform. Nearly all terms prohibit bots or scraping. They get guided setup, AI drafts the user pastes, and email import once the notification sender is documented and a sample has been reviewed. Signup links were opened once each; "search copy" means the site blocked our client and the link or quote comes from a search-engine copy of the official page.

| Platform | Hubs | Key finding | Source |
|---|---|---|---|
| Thumbtack | inbox, jobs, bidding, account | Official Partner Platform (OAuth; leads as "negotiations", messages, `NegotiationCreatedV4`/`MessageCreatedV4` webhooks). Terms ban bots without written approval, so it is planned pending partner approval. | [developers](https://developers.thumbtack.com), [terms](https://www.thumbtack.com/terms/) (search copy) |
| Malt | inbox, bidding, account | Official API covers invoices, payments, fee invoices and SCIM only; client requests arrive by notification email. | [api.malt.com](https://api.malt.com) |
| freelancermap | inbox, jobs, bidding, account | Advertised RSS (`/feeds/projects/int-international.xml`) returns 404; project alert emails exist. | [T&C](https://www.freelancermap.com/term-and-conditions.html) |
| Lancers | inbox, jobs, bidding, gigs, account | Sender `@lancers.jp` is documented, so it is mapped in the inbox (still behind `INBOUND_EMAIL_PLATFORMS`). | [FAQ](https://www.lancers.jp/faq/A1010/21) |
| CrowdWorks | inbox, jobs, bidding, account | No public API; terms Art. 2(1) include email delivery; robots.txt blocks AI crawlers. | [terms](https://crowdworks.jp/pages/agreement.html) |
| Truelancer | bidding, account | ToS §10 bars robots and expropriating data (search copy). | [terms](https://www.truelancer.com/legal/terms-service) |
| Workana | bidding, account | T&C ban robots, spiders, scraping and data mining (search copy). | [T&C](https://help.workana.com/hc/en-us/articles/360041499974-WORKANA-TERMS-AND-CONDITIONS) |
| Twine | bidding, account | No commercial extraction of data; AUP bars excessive follow-ups after applying. | [terms](https://www.twine.net/terms), [AUP](https://www.twine.net/aup) |
| Kwork | gigs, account | Bans bots and "any manual process" to collect information. | [ToS](https://kwork.com/terms_of_service) |
| Bark | inbox, jobs, bidding, account | §3.4.4: purchased contacts may not be made available to third parties, so lead alerts are imported but contact details are never stored. Sender `bark.com` is documented. | [terms](https://www.bark.com/en/us/terms/) |
| TaskRabbit | account only | AUP §2 bars submitting platform content "into any artificial intelligence technologies", so it gets no inbox or AI drafts. | [AUP](https://support.taskrabbit.com/hc/en-us/articles/46260475390107-Taskrabbit-Platform-Acceptable-Use-Policy) |
| FlexJobs | inbox, jobs, account | "Job applications must be completed personally by the applicant", so it gets no bidding hub. Sender `@flexjobs.com` is documented. | [terms](https://www.flexjobs.com/termsofuse.aspx) (search copy) |
| SolidGigs | jobs, bidding, account | Personal-use licence; leads arrive by email. | [terms](https://solidgigs.com/terms/) |
| Hubstaff Talent | account | Content may not be copied for commercial use or reposted. | [ToS](https://hubstaff.com/terms) |
| Wellfound | account | ToS bans scraping and using content for commercial activity. | [terms](https://wellfound.com/terms) |
| Kolabtree | inbox, bidding, account | Managed network (Cactus Communications); §10 bars access other than through its interface. | [terms](https://www.kolabtree.com/fl-user-agreement) |
| Codeable, Gun.io, Arc.dev, Braintrust, Lemon.io, Turing, YunoJuno, A.Team, Catalant, Expert360, Andela, Upstack, Proxify | inbox, account (+ bidding for Codeable; jobs and bidding for Braintrust) | No talent APIs. Gun.io and Arc ban monitoring. Arc §7.7(k) and Lemon.io §20(J) ban deep-linking, so only public pages are linked. Lemon.io §20(K) bans AI agents on its platform. Proxify's terms could not be read (Cloudflare). | per-row links in `lib/platforms.ts` |
| Behance, 99designs, DesignCrowd, crowdspring, Coroflot, Mediabistro, Reedsy, Contently, Editing.services | varies (see `lib/platforms.ts`) | Behance API keys unavailable since 2021. 99designs §8.3(g) bans automated queries. Mediabistro §10.2 bans bots. crowdspring's creative signup is a waitlist. ServiceScape is now Editing.services. | per-row links in `lib/platforms.ts` |

### Researched but not integrated

- **Closed or moved:**
  - Working Not Working closed in 2025.
  - Krop's job board is gone; the URL redirects to its portfolio builder.
  - Outsourcely's domain does not resolve.
  - Workhoppers has merged into freelance.jobs.
  - DevITjobs now redirects to JobCopilot signup.
  - Gitcoin bounties ended in 2023.
  - IssueHunt is now a Japanese security bug-bounty site.
- **No usable feed, or the endpoint is blocked:**
  - Algora: the documented API returns 404 and the legacy endpoint is a stub that always returns an empty list.
  - The freelancermap RSS feed returns 404.
  - Landing.jobs: an undocumented API that robots.txt blocks.
  - Golang Cafe and Jobgether block automated clients.
  - Jobspresso: personal, non-commercial use only.
  - EU Remote Jobs has switched its feed off (401).
  - Remote.co, JustRemote and Dynamite Jobs have no job feed.
- **Not suited to a shared, cached radar:**
  - Careerjet must receive each end user's IP address and user agent on every call.
  - Kaggle's terms allow non-commercial use only.
  - Remote Rocketship is a paid API whose terms bar building a competing job board.

## Open research / client actions

1. Obtain written scope confirmation from Freelancer.com before enabling its API in production, covering project search, bids, messages, multi-tenant credentials, caching/display, and this product's commercial use.
2. Obtain Upwork API app approval and written commercial partner permission. Confirm the approved app includes `Read marketplace Job Postings`, `Submit Proposal`, and the needed messaging permission (`Messaging - Read-Only Access` or `Messaging - Read and Write Access`). Also confirm commercial permission covers the product's pricing model and multi-user access. The current search request uses Upwork's documented `pagination_eq` filter and defaults to the OAuth user's default organization; selecting another tenant is not implemented. No evidence found that Freelancer Plus itself is required for API job search or proposal submission; users still need Connects for proposals. Observe the 24-hour cache limit.
3. Use the Fiverr seller test account to save representative message notification emails and inspect whether the full message, sender, and deep link are present. Do not ingest Fiverr account pages.
4. Finish the Hacker News content-reuse review (PPH and Guru reviews are complete above). Ask Reddit for commercial approval and verify the app's API access. Record current versions and re-check quarterly.
5. Gated feeds: email the operators of Python.org Jobs, LaraJobs, Real Work From Anywhere, ProBlogger, NoDesk, Crypto Jobs List, Working Nomads, Authentic Jobs, VueJobs, Dribbble and Topcoder for written reuse permission. Record each answer here, then add the source id to `JOB_SOURCES_APPROVED`.
6. Company boards: decide whether showing a watched company's public ATS postings, with links back to the company, is acceptable. If yes, add `gh,lev,ash,smr,wkb,rct` to `JOB_SOURCES_APPROVED`.
7. Keyed APIs: register free keys for USAJOBS, The Muse, Web3.career and Jooble. Adzuna, Reed and Findwork additionally need the licence or permission named above. The Reed, Findwork and Web3.career parsers follow the official docs but have not run against a live keyed response; run them once after the keys are added.
8. Thumbtack: apply to the Partner Platform for lead and message access.
9. Email inbox: Lancers, FlexJobs and Bark senders are mapped. Verify a sample notification for each, as was done for Fiverr, before listing them in `INBOUND_EMAIL_PLATFORMS`.
