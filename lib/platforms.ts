/**
 * Platform capability matrix — single source of truth for the UI.
 *
 * highon's model: platforms are separated by WHICH of the hubs they can do:
 *   1. inbox    — Unified Inbox (messages flow into one board)
 *   2. jobs     — Auto Job Finder (scan/match openings by skills)
 *   3. bidding  — Auto Bidding (personalized proposals/bids)
 *   4. gigs     — Gig Auto-Posting (publish/update gigs multi-platform)
 *   5. account  — Account Setup (guided setup of the user's OWN real account —
 *                 deep-link to the official signup and track a user-led setup
 *                 checklist. We do not create marketplace accounts or email inboxes.
 *
 * `caps` is the target per PLAN.md (§2); `status` is what works TODAY, and
 * `note` says which parts are real. Every cell is sourced in
 * docs/platform-matrix.md — update this file from that research.
 *
 * mode tells you HOW we automate it:
 *   api     — official API connector
 *   feed    — public/permitted feed we aggregate
 *   email   — notification emails into the inbox + AI drafts the user pastes
 *   manual  — no permitted automation: guided setup + AI drafts the user pastes
 *   browser — assistive automation on the user's own session (worker + approval)
 *
 * `sourceId` links a row to its Job Radar source in backend/app/job_sources.py;
 * PlatformMatrix replaces `status` for those rows with the backend's live
 * enabled/gated state (backend/tests/test_job_sources.py keeps the ids in sync).
 */

export type Hub = "inbox" | "jobs" | "bidding" | "gigs" | "account";
export type PlatformMode = "api" | "feed" | "email" | "manual" | "browser";
export type PlatformStatus = "live" | "gated" | "guided" | "demo" | "assist" | "planned";
export type PlatformCategory = "marketplace" | "network" | "creative" | "board" | "search" | "company";

export type PlatformSpec = {
  id: string;
  name: string;
  category: PlatformCategory;
  caps: Hub[];
  mode: PlatformMode;
  status: PlatformStatus;
  note?: string;
  /** Official site. */
  url?: string;
  /** Official freelancer/talent signup — required when caps include "account". */
  signupUrl?: string;
  /** Where the user publishes a gig draft by hand. */
  editorUrl?: string;
  /** Job Radar source id in backend/app/job_sources.py. */
  sourceId?: string;
};

export const PLATFORM_MATRIX: PlatformSpec[] = [
  // ---- Freelance marketplaces -------------------------------------------
  { id: "upwork", name: "Upwork", category: "marketplace", caps: ["inbox", "jobs", "bidding", "gigs", "account"], mode: "api", status: "demo",
    url: "https://www.upwork.com", signupUrl: "https://www.upwork.com/signup", editorUrl: "https://www.upwork.com/nx/project-catalog/",
    note: "Official API documents job search, proposal submission, and messaging. Commercial use needs API approval and prior written permission; live API calls stay off until approved." },
  { id: "freelancer", name: "Freelancer.com", category: "marketplace", caps: ["inbox", "jobs", "bidding", "gigs", "account"], mode: "api", status: "planned", sourceId: "flx",
    url: "https://www.freelancer.com", signupUrl: "https://www.freelancer.com/signup",
    note: "Official SDK documents project search, bids, and messages, but written permission is required for automated API access. Production calls are disabled pending approval; sandbox/demo only." },
  { id: "fiverr", name: "Fiverr", category: "marketplace", caps: ["inbox", "gigs", "account"], mode: "email", status: "guided",
    url: "https://www.fiverr.com", signupUrl: "https://www.fiverr.com/join", editorUrl: "https://www.fiverr.com/users/seller_dashboard/gigs",
    note: "Fiverr prohibits bots and automated retrieval. Gig drafts are copied and published manually; email notification contents need verification before inbox work." },
  { id: "linkedin", name: "LinkedIn", category: "marketplace", caps: ["inbox", "jobs", "account"], mode: "email", status: "guided",
    url: "https://www.linkedin.com", signupUrl: "https://www.linkedin.com/signup",
    note: "Unauthorized bots, scraping, and automated messaging are prohibited. Keep search and messaging manual; email alerts are still under review." },
  { id: "peopleperhour", name: "PeoplePerHour", category: "marketplace", caps: ["inbox", "jobs", "bidding", "gigs", "account"], mode: "email", status: "guided",
    url: "https://www.peopleperhour.com", signupUrl: "https://www.peopleperhour.com/site/register?hasFreelancerMemberPreselected=1",
    note: "No public API or feed; terms ban crawling, scraping, and auto-responders. Alerts come from your PPH emails; you review and send AI drafts yourself." },
  { id: "guru", name: "Guru", category: "marketplace", caps: ["inbox", "jobs", "bidding", "gigs", "account"], mode: "email", status: "guided",
    url: "https://www.guru.com", signupUrl: "https://www.guru.com/registeraccount.aspx",
    note: "No public API and the site blocks automated access. Job matches come from your Guru alert emails; you paste drafts yourself." },
  { id: "contra", name: "Contra", category: "marketplace", caps: ["inbox", "jobs", "gigs", "account"], mode: "manual", status: "guided",
    url: "https://contra.com", signupUrl: "https://contra.com/signup",
    note: "Terms prohibit automated search/download and third-party data collection. Guided setup and drafts you paste; no connector without written approval." },

  { id: "thumbtack", name: "Thumbtack", category: "marketplace", caps: ["inbox", "jobs", "bidding", "account"], mode: "api", status: "planned",
    url: "https://www.thumbtack.com", signupUrl: "https://www.thumbtack.com/pro",
    note: "Official Partner API and webhooks cover leads and messages; needs Thumbtack partner approval before we connect. Terms ban bots without written approval." },
  { id: "malt", name: "Malt", category: "marketplace", caps: ["inbox", "bidding", "account"], mode: "email", status: "guided",
    url: "https://www.malt.com", signupUrl: "https://www.malt.com/signup",
    note: "Malt's official API covers invoices and payments only. Client requests come from notification emails; you send quotes yourself." },
  { id: "freelancermap", name: "freelancermap", category: "marketplace", caps: ["inbox", "jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://www.freelancermap.com", signupUrl: "https://www.freelancermap.com/registration",
    note: "IT project board with no API; its advertised RSS feed is offline. Matching projects come from your freelancermap alert emails." },
  { id: "lancers", name: "Lancers", category: "marketplace", caps: ["inbox", "jobs", "bidding", "gigs", "account"], mode: "email", status: "guided",
    url: "https://www.lancers.jp", signupUrl: "https://www.lancers.jp/user/sign_up",
    note: "Japanese marketplace with no public API. Alerts come from documented @lancers.jp emails; drafts you paste." },
  { id: "crowdworks", name: "CrowdWorks", category: "marketplace", caps: ["inbox", "jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://crowdworks.jp", signupUrl: "https://crowdworks.jp/user/new",
    note: "Japanese marketplace with no public API. Job and message alerts come from your CrowdWorks emails; you submit proposals yourself." },
  { id: "truelancer", name: "Truelancer", category: "marketplace", caps: ["bidding", "account"], mode: "manual", status: "guided",
    url: "https://www.truelancer.com", signupUrl: "https://www.truelancer.com/signup",
    note: "No public API; terms bar robots and taking data from the site. Guided setup and proposal drafts you paste." },
  { id: "workana", name: "Workana", category: "marketplace", caps: ["bidding", "account"], mode: "manual", status: "guided",
    url: "https://www.workana.com", signupUrl: "https://www.workana.com/signup",
    note: "Latin American marketplace; terms ban bots, scraping, and data mining. Guided setup and proposal drafts you paste." },
  { id: "twine", name: "Twine", category: "marketplace", caps: ["bidding", "account"], mode: "manual", status: "guided",
    url: "https://www.twine.net", signupUrl: "https://www.twine.net/signup",
    note: "No API; terms forbid data extraction and excessive follow-ups after applying. Pitch drafts you paste." },
  { id: "kwork", name: "Kwork", category: "marketplace", caps: ["gigs", "account"], mode: "manual", status: "guided",
    url: "https://kwork.com", signupUrl: "https://kwork.com/signup",
    note: "Gig marketplace; terms ban bots and even manual data collection. You write listing drafts and publish them yourself." },
  { id: "bark", name: "Bark", category: "marketplace", caps: ["inbox", "jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://www.bark.com", signupUrl: "https://www.bark.com/en/us/sellers/create/",
    note: "Lead marketplace with no API. Lead alerts arrive from bark.com emails; purchased contact details are never stored or shared." },
  { id: "taskrabbit", name: "TaskRabbit", category: "marketplace", caps: ["account"], mode: "manual", status: "guided",
    url: "https://www.taskrabbit.com", signupUrl: "https://www.taskrabbit.com/become-a-tasker",
    note: "Guided signup only: TaskRabbit bars bots and putting platform content into AI tools, so no inbox or AI drafts." },
  { id: "hubstafftalent", name: "Hubstaff Talent", category: "marketplace", caps: ["account"], mode: "manual", status: "guided",
    url: "https://hubstafftalent.net", signupUrl: "https://hubstafftalent.net/signup",
    note: "Free job board and freelancer directory with no Talent API; content may not be reused. Browse jobs there; guided profile setup here." },
  { id: "wellfound", name: "Wellfound", category: "marketplace", caps: ["account"], mode: "manual", status: "guided",
    url: "https://wellfound.com", signupUrl: "https://wellfound.com/jobs/signup",
    note: "Startup jobs (formerly AngelList Talent); no API and terms ban scraping and commercial reuse. Guided setup only." },
  { id: "flexjobs", name: "FlexJobs", category: "marketplace", caps: ["inbox", "jobs", "account"], mode: "email", status: "guided",
    url: "https://www.flexjobs.com", signupUrl: "https://www.flexjobs.com/registration/signup",
    note: "Paid screened job board. Job alerts arrive from @flexjobs.com; FlexJobs requires applications be completed personally, so no AI-written applications." },
  { id: "solidgigs", name: "SolidGigs", category: "marketplace", caps: ["jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://solidgigs.com", signupUrl: "https://solidgigs.com/signup/",
    note: "Paid lead service with no API. Leads come from your SolidGigs emails; you pitch on the original job site." },

  // ---- Talent networks ----------------------------------------------------
  { id: "kolabtree", name: "Kolabtree", category: "network", caps: ["inbox", "bidding", "account"], mode: "manual", status: "guided",
    url: "https://www.kolabtree.com", signupUrl: "https://www.kolabtree.com/",
    note: "Managed expert network (Cactus Communications); terms bar access other than its interface. Use “Join as expert” on the homepage; scope-of-work drafts you submit yourself." },
  // No public APIs; most terms bar bots/scraping. Inbox import needs each
  // platform's notification sender verified first (docs/platform-matrix.md).
  { id: "toptal", name: "Toptal", category: "network", caps: ["inbox", "account"], mode: "manual", status: "guided",
    url: "https://www.toptal.com", signupUrl: "https://www.toptal.com/talent/apply",
    note: "Website terms prohibit automated access and limit public content to personal, non-commercial use. Keep site interaction manual unless Toptal authorizes an integration." },
  { id: "codeable", name: "Codeable", category: "network", caps: ["inbox", "bidding", "account"], mode: "email", status: "guided",
    url: "https://www.codeable.io", signupUrl: "https://www.codeable.io/freelance-wordpress-developer-jobs/",
    note: "Vetted WordPress experts; no API. Estimate notes are drafts you submit in Codeable yourself." },
  { id: "gunio", name: "Gun.io", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://gun.io", signupUrl: "https://app.gun.io/sign-up/",
    note: "Terms ban robots, scraping, and monitoring the site. Only your Gun.io emails are used." },
  { id: "arc", name: "Arc.dev", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://arc.dev", signupUrl: "https://arc.dev/signup?userType=developer",
    note: "Terms ban scraping, monitoring, and deep-linking into the platform. Public signup link and your Arc emails only." },
  { id: "braintrust", name: "Braintrust", category: "network", caps: ["inbox", "jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://www.usebraintrust.com", signupUrl: "https://app.usebraintrust.com/auth/sign_up/goals/",
    note: "No API; terms bar unauthorized tools. Job matches come from your Braintrust emails; applications are drafts you paste." },
  { id: "lemonio", name: "Lemon.io", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://lemon.io", signupUrl: "https://lemon.io/for-developers/",
    note: "Terms ban deep links and AI agents on the platform. We link only to its public developer page." },
  { id: "turing", name: "Turing", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://www.turing.com", signupUrl: "https://work.turing.com/signup",
    note: "Terms bar scraping without written authorization. Work is assigned inside Turing; we only track the emails." },
  { id: "yunojuno", name: "YunoJuno", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://www.yunojuno.com", signupUrl: "https://app.yunojuno.com/profile/onboarding/sign-up/",
    note: "UK freelancer network; terms ban data-mining tools. Bookings come from clients inside YunoJuno." },
  { id: "ateam", name: "A.Team", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://www.a.team", signupUrl: "https://www.a.team/join",
    note: "Invite-only missions; terms bar harvesting user data. We track A.Team emails." },
  { id: "catalant", name: "Catalant", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://catalant.com", signupUrl: "https://app.gocatalant.com/c/_/auth/signup/",
    note: "Expert terms bar scraping. Projects stay on Catalant; emails only." },
  { id: "expert360", name: "Expert360", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://expert360.com", signupUrl: "https://expert360.com/community",
    note: "Australia/NZ consultants (ABN/ACN needed for AU work); terms bar bulk harvesting. Emails only." },
  { id: "andela", name: "Andela", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://www.andela.com", signupUrl: "https://www.andela.com/for-talent#join-the-network",
    note: "Matching happens inside Andela; terms bar API integrations without written approval. Emails only." },
  { id: "upstack", name: "Upstack", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://upstackhq.com", signupUrl: "https://developer.upstackhq.com/",
    note: "Vetted developer network with no API. Emails only." },
  { id: "proxify", name: "Proxify", category: "network", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://proxify.io", signupUrl: "https://career.proxify.io/",
    note: "Vetted developer network; terms could not be read from the server (Cloudflare). Emails only." },

  // ---- Creative & contests ------------------------------------------------
  { id: "dribbble", name: "Dribbble", category: "creative", caps: ["inbox", "jobs", "gigs", "account"], mode: "feed", status: "gated", sourceId: "drb",
    url: "https://dribbble.com", signupUrl: "https://dribbble.com/signup",
    note: "Official jobs RSS is built in, but Dribbble's API terms bar job search services, so it stays off until Dribbble permits it. Services are drafts you paste." },
  { id: "behance", name: "Behance", category: "creative", caps: ["inbox", "gigs", "account"], mode: "email", status: "guided",
    url: "https://www.behance.net", signupUrl: "https://www.behance.net/signup",
    note: "No API keys since 2021; Adobe terms bar scraping. Uses your Behance emails plus drafts you paste." },
  { id: "99designs", name: "99designs", category: "creative", caps: ["inbox", "jobs", "account"], mode: "email", status: "guided",
    url: "https://99designs.com", signupUrl: "https://99designs.com/signup/designer",
    note: "Design contests by Vista. Partner API is client-side only and terms ban automated queries. Built from your contest alert emails." },
  { id: "designcrowd", name: "DesignCrowd", category: "creative", caps: ["inbox", "jobs", "account"], mode: "email", status: "guided",
    url: "https://www.designcrowd.com", signupUrl: "https://www.designcrowd.com/registration",
    note: "Design contests with no API or feed. Contest alerts come from your DesignCrowd emails." },
  { id: "crowdspring", name: "crowdspring", category: "creative", caps: ["inbox", "jobs"], mode: "email", status: "guided",
    url: "https://www.crowdspring.com",
    note: "Design and naming contests; creative signup is a waitlist that opens periodically. Terms could not be read from the server." },
  { id: "coroflot", name: "Coroflot", category: "creative", caps: ["jobs"], mode: "email", status: "guided",
    url: "https://www.coroflot.com",
    note: "Design job board with no confirmed feed; robots.txt opts out of AI use. Use Coroflot job-alert emails or open it directly." },
  { id: "mediabistro", name: "Mediabistro", category: "creative", caps: ["jobs", "account"], mode: "email", status: "guided",
    url: "https://www.mediabistro.com", signupUrl: "https://www.mediabistro.com/create-alert",
    note: "Media job board; terms ban bots. Set up its official job alerts and they flow in by email." },
  { id: "problogger", name: "ProBlogger Jobs", category: "creative", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "pbl",
    url: "https://problogger.com/jobs/", note: "Official RSS of writing gigs is built in; off until ProBlogger confirms reuse (\"All Rights Reserved\")." },
  { id: "reedsy", name: "Reedsy", category: "creative", caps: ["inbox", "jobs", "bidding", "account"], mode: "email", status: "guided",
    url: "https://reedsy.com", signupUrl: "https://reedsy.com/join-our-community",
    note: "Curated publishing professionals. Author requests arrive by email; quotes are drafts you send in Reedsy." },
  { id: "editingservices", name: "Editing.services", category: "creative", caps: ["inbox", "account"], mode: "manual", status: "guided",
    url: "https://editing.services", signupUrl: "https://editing.services/how-it-works/professionals",
    note: "Formerly ServiceScape: editing, writing, and translation pros. No API; guided setup and drafts you paste." },
  { id: "contently", name: "Contently", category: "creative", caps: ["inbox", "account"], mode: "email", status: "guided",
    url: "https://contently.com", signupUrl: "https://contently.com/register",
    note: "Managed freelance writing network; its Talent API serves brands, not writers. Emails only." },
  { id: "topcoder", name: "Topcoder", category: "creative", caps: ["jobs", "account"], mode: "api", status: "gated", sourceId: "tc",
    url: "https://www.topcoder.com", signupUrl: "https://accounts-auth0.topcoder.com/?mode=signUp",
    note: "Public challenges API (v6) is built in; site terms limit use to personal use, so it's off until Topcoder permits it." },

  // ---- Remote job boards (public feeds) ----------------------------------
  { id: "remoteok", name: "RemoteOK", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "rok",
    url: "https://remoteok.com", note: "Public JSON feed; listings credit RemoteOK and link the original." },
  { id: "weworkremotely", name: "We Work Remotely", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "wwr",
    url: "https://weworkremotely.com", note: "Public RSS feeds; listings link the original." },
  { id: "jobicy", name: "Jobicy", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "jcy",
    url: "https://jobicy.com", note: "Public API; Jobicy credited and every listing links to its page. At most one pass an hour." },
  { id: "arbeitnow", name: "Arbeitnow", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "arb",
    url: "https://www.arbeitnow.com", note: "Free public API; remote and freelance roles only, linked back to Arbeitnow." },
  { id: "himalayas", name: "Himalayas", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "him",
    url: "https://himalayas.app", note: "Himalayas allows showing its jobs in your own app; links stay unchanged and expired jobs drop off." },
  { id: "fourdayweek", name: "4 Day Week", category: "board", caps: ["jobs"], mode: "feed", status: "live", sourceId: "fdw",
    url: "https://4dayweek.io", note: "Free public API for reduced-hours roles; credited and linked to 4dayweek.io." },
  { id: "remotive", name: "Remotive", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "rmt",
    url: "https://remotive.com", note: "API terms bar showing Remotive jobs behind a signup, which Job Radar requires. Needs written permission or the paid API." },
  { id: "workingnomads", name: "Working Nomads", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "wn",
    url: "https://www.workingnomads.com", note: "Public endpoint, but terms bar commercial exploitation; off until permitted." },
  { id: "cryptojobslist", name: "Crypto Jobs List", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "cjl",
    url: "https://cryptojobslist.com", note: "Public RSS marked \"All rights reserved\"; off until the operator confirms reuse." },
  { id: "pythonjobs", name: "Python.org Jobs", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "pyj",
    url: "https://www.python.org/jobs/", note: "Official RSS with no reuse terms; off until the PSF confirms." },
  { id: "larajobs", name: "LaraJobs", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "lara",
    url: "https://larajobs.com", note: "Public Laravel jobs RSS with no published terms; off until the operator confirms." },
  { id: "vuejobs", name: "VueJobs", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "vue",
    url: "https://vuejobs.com", note: "RSS exists but robots.txt disallows it; needs written permission." },
  { id: "authenticjobs", name: "Authentic Jobs", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "auj",
    url: "https://authenticjobs.com", note: "RSS exists but robots.txt disallows the feed path; needs written permission." },
  { id: "nodesk", name: "NoDesk", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "nod",
    url: "https://nodesk.co", note: "Public RSS; robots.txt allows reference use only and opts out of AI crawlers. Off until permitted." },
  { id: "realworkfromanywhere", name: "Real Work From Anywhere", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "rwfa",
    url: "https://www.realworkfromanywhere.com", note: "Free public RSS with no reuse terms; off until the operator confirms." },
  { id: "web3career", name: "Web3.career", category: "board", caps: ["jobs"], mode: "api", status: "gated", sourceId: "w3c",
    url: "https://web3.career", note: "Free API token (WEB3_CAREER_TOKEN); listings keep the unchanged apply link." },
  { id: "reddit", name: "Reddit r/forhire", category: "board", caps: ["jobs"], mode: "api", status: "gated", sourceId: "rdt",
    url: "https://www.reddit.com/r/forhire", note: "Needs Reddit Data API OAuth and commercial approval; disabled until approved." },
  { id: "hackernews", name: "Hacker News", category: "board", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "hn",
    url: "https://news.ycombinator.com", note: "\"Who is hiring?\" and \"Seeking freelancer\" threads via the Algolia HN API; off until the commercial reuse review is complete." },

  // ---- Job search APIs (credentials) --------------------------------------
  { id: "themuse", name: "The Muse", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "muse",
    url: "https://www.themuse.com", note: "Remote roles via the public API once registered (THE_MUSE_API_KEY); listings link back to The Muse." },
  { id: "usajobs", name: "USAJOBS", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "usaj",
    url: "https://www.usajobs.gov", note: "Open-licence federal jobs API; switches on with a free key (USAJOBS_API_KEY + USAJOBS_USER_AGENT)." },
  { id: "jooble", name: "Jooble", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "jbl",
    url: "https://jooble.org", note: "Partner API key (JOOBLE_API_KEY); free keys allow 500 requests in total, so results are cached 12 hours." },
  { id: "adzuna", name: "Adzuna", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "adz",
    url: "https://www.adzuna.com", note: "Needs an API key and, for a paid product, an Adzuna licence; adverts carry the Adzuna label." },
  { id: "reed", name: "Reed.co.uk", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "reed",
    url: "https://www.reed.co.uk", note: "UK jobs API; needs a key and written permission because its terms bar commercial copying." },
  { id: "findwork", name: "Findwork", category: "search", caps: ["jobs"], mode: "api", status: "gated", sourceId: "fw",
    url: "https://findwork.dev", note: "Developer jobs API (free token) that republishes other boards; off until its rights are reviewed." },

  // ---- Company career boards (ATS job-board APIs) -------------------------
  { id: "greenhouse", name: "Greenhouse", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "gh",
    url: "https://www.greenhouse.com", note: "Reads the public boards of companies you watch (Job Radar → Companies). Off until the reuse review." },
  { id: "lever", name: "Lever", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "lev",
    url: "https://www.lever.co", note: "Public postings API for companies you watch. Off until the reuse review." },
  { id: "ashby", name: "Ashby", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "ash",
    url: "https://www.ashbyhq.com", note: "Public job-posting API for companies you watch; unlisted postings are skipped. Off until the reuse review." },
  { id: "smartrecruiters", name: "SmartRecruiters", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "smr",
    url: "https://www.smartrecruiters.com", note: "Public posting API for companies you watch. Off until the reuse review." },
  { id: "workable", name: "Workable", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "wkb",
    url: "https://www.workable.com", note: "Public careers-page API for companies you watch. Off until the reuse review." },
  { id: "recruitee", name: "Recruitee", category: "company", caps: ["jobs"], mode: "feed", status: "gated", sourceId: "rct",
    url: "https://recruitee.com", note: "Public offers API for companies you watch. Off until the reuse review." },
];

export const CATEGORY_LABELS: Record<PlatformCategory, { label: string; description: string }> = {
  marketplace: { label: "Freelance marketplaces", description: "Bid on projects or sell services; guided setup, drafts, and email or API where permitted." },
  network: { label: "Talent networks", description: "Vetted or curated networks; you apply once and they match you." },
  creative: { label: "Creative & contests", description: "Design, writing, and challenge platforms." },
  board: { label: "Remote job boards", description: "Public feeds read by Job Radar, credited and linked to the original." },
  search: { label: "Job search APIs", description: "Official search APIs that switch on when their API key is configured." },
  company: { label: "Company career boards", description: "Public ATS job-board APIs for the companies you choose to watch." },
};

export const HUB_LABELS: Record<Hub, { label: string; href: string }> = {
  inbox: { label: "Unified Inbox", href: "/dashboard/conversations" },
  jobs: { label: "Job Finder", href: "/dashboard/job-radar" },
  bidding: { label: "Auto Bidding", href: "/dashboard/bidding" },
  gigs: { label: "Gig Posting", href: "/dashboard/accounts" },
  account: { label: "Account Setup", href: "/dashboard/accounts" },
};

export const MODE_LABELS: Record<PlatformMode, string> = {
  api: "Official API",
  feed: "Public feed",
  email: "Email + AI drafts",
  manual: "Guided + AI drafts",
  browser: "Browser assist",
};

/** Platforms with a guided-setup checklist on the Accounts page. */
export const SETUP_PLATFORMS = PLATFORM_MATRIX.filter(
  (p): p is PlatformSpec & { signupUrl: string } => p.caps.includes("account") && !!p.signupUrl,
);

/** Platforms the gig builder can write a listing draft for. */
export const GIG_DRAFT_TARGETS = PLATFORM_MATRIX.filter((p) => p.caps.includes("gigs")).map((p) => p.name);

export const gigEditorUrl = (platformName: string) =>
  PLATFORM_MATRIX.find((p) => p.name === platformName)?.editorUrl ?? null;
