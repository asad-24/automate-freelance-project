"""Seed data — mirrors frontend lib/mock-data.ts exactly.

The in-memory store serves these collections so the frontend receives the
same shapes it already renders. Swap to real Postgres repositories later.
"""

KPIS = {
    "liveMargin": 48250,
    "marginTrend": 12.4,
    "activeContracts": 18,
    "contractsTrend": 3,
    "winRate": 34,
    "winRateTrend": 5.2,
    "jobsApplied": 142,
    "jobsTrend": 10,
    "freelancersActive": 63,
    "hitlOpen": 4,
    "apiOverheadMonth": 1180,
    "revenueMonth": 96400,
}

MARGIN_TIMESERIES = [
    {"month": "Apr", "revenue": 42000, "cost": 22000, "margin": 20000},
    {"month": "May", "revenue": 51000, "cost": 26000, "margin": 25000},
    {"month": "Jun", "revenue": 63000, "cost": 31000, "margin": 32000},
    {"month": "Jul", "revenue": 58000, "cost": 27000, "margin": 31000},
    {"month": "Aug", "revenue": 79000, "cost": 36000, "margin": 43000},
    {"month": "Sep", "revenue": 96400, "cost": 48150, "margin": 48250},
]

FUNNEL_DATA = [
    {"stage": "Leads Scraped", "value": 1240},
    {"stage": "Bids Submitted", "value": 480},
    {"stage": "Replies", "value": 190},
    {"stage": "Contracts Won", "value": 62},
    {"stage": "Delivered", "value": 51},
    {"stage": "Paid", "value": 48},
]

CHANNEL_MIX = [
    {"name": "Upwork", "value": 46},
    {"name": "B2B Direct", "value": 28},
    {"name": "Reddit", "value": 14},
    {"name": "Fiverr", "value": 12},
]

MARGIN_BY_PROJECT = [
    {"project": "Ticketing Platform", "client": "Bright Startup", "payment": 8500, "freelancerCost": 3200, "apiOverhead": 140, "margin": 5160},
    {"project": "AI Chatbot Widget", "client": "NovaLabs", "payment": 6200, "freelancerCost": 2400, "apiOverhead": 110, "margin": 3690},
    {"project": "Shopify Migration", "client": "Craft & Co", "payment": 4400, "freelancerCost": 1900, "apiOverhead": 60, "margin": 2440},
    {"project": "Fintech Dashboard", "client": "LedgerPay", "payment": 12800, "freelancerCost": 5200, "apiOverhead": 220, "margin": 7380},
    {"project": "Mobile MVP", "client": "FitPulse", "payment": 9600, "freelancerCost": 4100, "apiOverhead": 180, "margin": 5320},
]

AGENTS = [
    {"id": "agent-1", "name": "Job Hunter", "subtitle": "Direct Employment", "description": "Finds & applies to LA/Remote Software/AI roles on autopilot via JobSpy + Playwright.", "status": "running", "lastRun": "2026-09-16T08:12:00Z", "schedule": "Daily @ 06:00", "runsToday": 8, "successRate": 92, "icon": "briefcase"},
    {"id": "agent-2", "name": "Marketing & Sales", "subtitle": "B2B Direct", "description": "Scrapes Clutch.co/LinkedIn for funded startups, runs cold email via n8n, builds micro-sites.", "status": "running", "lastRun": "2026-09-16T09:00:00Z", "schedule": "Every 6h", "runsToday": 4, "successRate": 71, "icon": "megaphone"},
    {"id": "agent-3", "name": "Bidding & Acquisition", "subtitle": "Freelance Job Finder", "description": "Scrapes Upwork/Fiverr/Reddit every 2h, analyses margin, writes RAG proposals, submits bids.", "status": "running", "lastRun": "2026-09-16T10:00:00Z", "schedule": "Every 2h", "runsToday": 5, "successRate": 34, "icon": "gavel"},
    {"id": "agent-4", "name": "Stealth Client Manager", "subtitle": "Comms & Upsell", "description": "Human-persona client comms via Rocket.Chat + Claude, upsell engine, voice fallback.", "status": "paused", "lastRun": "2026-09-16T07:30:00Z", "schedule": "Realtime", "runsToday": 23, "successRate": 88, "icon": "messages-square"},
    {"id": "agent-5", "name": "Arbitrage Dispatcher", "subtitle": "Freelancer Finder", "description": "Broadcasts specs to 10-20 vetted freelancers, runs blind auction, auto-awards by ROI score.", "status": "running", "lastRun": "2026-09-16T09:45:00Z", "schedule": "On contract win", "runsToday": 3, "successRate": 79, "icon": "network"},
    {"id": "agent-6", "name": "QA & Delivery", "subtitle": "Quality Gate", "description": "Runs ESLint/Black/Pytest/Jest + SonarQube on freelancer PRs, delivers on pass.", "status": "error", "lastRun": "2026-09-16T06:50:00Z", "schedule": "On PR push", "runsToday": 11, "successRate": 95, "icon": "shield-check"},
]

APPLIED_JOBS = [
    {"id": "j1", "title": "Senior Full-Stack Engineer", "company": "Rippling", "source": "Greenhouse", "location": "Remote (US)", "match": 92, "status": "Applied", "date": "2026-09-16"},
    {"id": "j2", "title": "AI/ML Engineer", "company": "Anthropic", "source": "Lever", "location": "San Francisco", "match": 88, "status": "Applied", "date": "2026-09-16"},
    {"id": "j3", "title": "Frontend Engineer (React)", "company": "Vercel", "source": "Greenhouse", "location": "Remote", "match": 85, "status": "Screening", "date": "2026-09-15"},
    {"id": "j4", "title": "Backend Engineer (Python)", "company": "Stripe", "source": "Greenhouse", "location": "Los Angeles", "match": 83, "status": "Applied", "date": "2026-09-15"},
    {"id": "j5", "title": "Platform Engineer", "company": "Datadog", "source": "Lever", "location": "Remote", "match": 79, "status": "Skipped (<80%)", "date": "2026-09-14"},
    {"id": "j6", "title": "LLM Applications Engineer", "company": "OpenAI", "source": "Ashby", "location": "Remote", "match": 90, "status": "Applied", "date": "2026-09-14"},
]

FREELANCE_LEADS = [
    {"id": "l1", "title": "Build a SaaS analytics dashboard (Next.js)", "platform": "Upwork", "budget": 3500, "margin": 61, "matchScore": 88, "status": "Proposal Sent", "posted": "2h ago"},
    {"id": "l2", "title": "AI chatbot for e-commerce store", "platform": "Upwork", "budget": 1200, "margin": 54, "matchScore": 82, "status": "Bidding", "posted": "3h ago"},
    {"id": "l3", "title": "Fix WordPress performance issues", "platform": "Fiverr", "budget": 450, "margin": 12, "matchScore": 40, "status": "Skipped (<$500)", "posted": "5h ago"},
    {"id": "l4", "title": "React Native app MVP", "platform": "Reddit r/forhire", "budget": 6000, "margin": 58, "matchScore": 91, "status": "Proposal Sent", "posted": "6h ago"},
    {"id": "l5", "title": "Shopify Plus theme customization", "platform": "Upwork", "budget": 2200, "margin": 49, "matchScore": 76, "status": "Under Review", "posted": "8h ago"},
    {"id": "l6", "title": "Python data pipeline (ETL)", "platform": "Upwork", "budget": 5400, "margin": 63, "matchScore": 87, "status": "Won", "posted": "1d ago"},
]

PROPOSALS = [
    {"id": "p1", "leadTitle": "Build a SaaS analytics dashboard (Next.js)", "platform": "Upwork", "words": 148, "status": "Sent", "quality": 94, "submitted": "2026-09-16T09:40:00Z"},
    {"id": "p2", "leadTitle": "React Native app MVP", "platform": "Reddit", "words": 152, "status": "Sent", "quality": 91, "submitted": "2026-09-16T08:10:00Z"},
    {"id": "p3", "leadTitle": "AI chatbot for e-commerce store", "platform": "Upwork", "words": 139, "status": "Drafting", "quality": 0, "submitted": ""},
    {"id": "p4", "leadTitle": "Python data pipeline (ETL)", "platform": "Upwork", "words": 150, "status": "Accepted", "quality": 96, "submitted": "2026-09-15T14:00:00Z"},
]

SALES_LEADS = [
    {"id": "s1", "company": "NovaLabs", "industry": "AI Infrastructure", "funding": "Series A ($12M)", "source": "Clutch.co", "stage": "Email Opened", "contact": "cto@novalabs.io", "microsite": "novalabs.ouragency.com"},
    {"id": "s2", "company": "FitPulse", "industry": "HealthTech", "funding": "Seed ($3M)", "source": "LinkedIn", "stage": "Reply Received", "contact": "founder@fitpulse.app", "microsite": "fitpulse.ouragency.com"},
    {"id": "s3", "company": "LedgerPay", "industry": "Fintech", "funding": "Series B ($40M)", "source": "Clutch.co", "stage": "Call Booked", "contact": "vp@ledgerpay.com", "microsite": "ledgerpay.ouragency.com"},
    {"id": "s4", "company": "Craft & Co", "industry": "E-commerce", "funding": "Bootstrapped", "source": "LinkedIn", "stage": "Sequence 2/4", "contact": "ops@craftco.com", "microsite": "craftco.ouragency.com"},
]

EMAIL_SEQUENCES = [
    {"id": "seq1", "name": "Funded Startup Outreach", "steps": 4, "active": 128, "openRate": 42, "replyRate": 9},
    {"id": "seq2", "name": "AI Services Cold Pitch", "steps": 3, "active": 86, "openRate": 38, "replyRate": 7},
    {"id": "seq3", "name": "Re-engagement", "steps": 2, "active": 54, "openRate": 51, "replyRate": 12},
]

CLIENTS = [
    {"id": "c1", "name": "Jordan Blake", "company": "Bright Startup Inc.", "source": "Upwork", "ltv": 21500, "sentiment": "positive", "contracts": 3, "status": "Active"},
    {"id": "c2", "name": "Dana Wu", "company": "NovaLabs", "source": "B2B Direct", "ltv": 18200, "sentiment": "neutral", "contracts": 2, "status": "Active"},
    {"id": "c3", "name": "Marco Reyes", "company": "LedgerPay", "source": "Upwork", "ltv": 42800, "sentiment": "positive", "contracts": 4, "status": "Active"},
    {"id": "c4", "name": "Sofia Klein", "company": "Craft & Co", "source": "B2B Direct", "ltv": 8600, "sentiment": "at-risk", "contracts": 1, "status": "Escalated"},
    {"id": "c5", "name": "Tom Fisher", "company": "FitPulse", "source": "Reddit", "ltv": 12400, "sentiment": "neutral", "contracts": 2, "status": "Active"},
    {"id": "c6", "name": "Marcus Reed", "company": "Platinum Sound Records", "source": "Referral", "ltv": 24000, "sentiment": "positive", "contracts": 1, "status": "Onboarding"},
]

CONTRACTS = [
    {"id": "ct1", "title": "Ticketing Platform", "client": "Bright Startup Inc.", "value": 8500, "status": "In Progress", "milestonesDone": 2, "milestonesTotal": 4, "freelancer": "FL-3821", "qa": "Passing", "due": "2026-10-02"},
    {"id": "ct2", "title": "AI Chatbot Widget", "client": "NovaLabs", "value": 6200, "status": "In Progress", "milestonesDone": 1, "milestonesTotal": 3, "freelancer": "FL-1190", "qa": "Pending", "due": "2026-09-28"},
    {"id": "ct3", "title": "Fintech Dashboard", "client": "LedgerPay", "value": 12800, "status": "In Progress", "milestonesDone": 3, "milestonesTotal": 5, "freelancer": "FL-2077", "qa": "Passing", "due": "2026-10-15"},
    {"id": "ct4", "title": "Shopify Migration", "client": "Craft & Co", "value": 4400, "status": "Review", "milestonesDone": 3, "milestonesTotal": 3, "freelancer": "FL-0456", "qa": "Failing", "due": "2026-09-20"},
    {"id": "ct5", "title": "Mobile MVP", "client": "FitPulse", "value": 9600, "status": "Delivered", "milestonesDone": 4, "milestonesTotal": 4, "freelancer": "FL-3821", "qa": "Passing", "due": "2026-09-10"},
    {"id": "ct6", "title": "AI Music Production Hub (MVP)", "client": "Platinum Sound Records", "value": 24000, "status": "Onboarding", "milestonesDone": 0, "milestonesTotal": 4, "freelancer": "TBD", "qa": "Pending", "due": "2026-11-15"},
]

MILESTONES = [
    {"id": "m1", "contract": "Ticketing Platform", "title": "Design & Architecture", "amount": 2000, "status": "Approved", "due": "2026-09-12"},
    {"id": "m2", "contract": "Ticketing Platform", "title": "Backend API", "amount": 2500, "status": "Approved", "due": "2026-09-22"},
    {"id": "m3", "contract": "Ticketing Platform", "title": "Frontend UI", "amount": 2500, "status": "In Progress", "due": "2026-09-29"},
    {"id": "m4", "contract": "Ticketing Platform", "title": "QA & Launch", "amount": 1500, "status": "Pending", "due": "2026-10-02"},
    {"id": "m5", "contract": "Fintech Dashboard", "title": "Data layer", "amount": 3000, "status": "Approved", "due": "2026-09-18"},
    {"id": "m6", "contract": "Fintech Dashboard", "title": "Charts & Reports", "amount": 3500, "status": "In Progress", "due": "2026-10-05"},
    {"id": "m7", "contract": "AI Music Production Hub (MVP)", "title": "P1 — Unified Library Scanner & Index", "amount": 6000, "status": "Pending", "due": "2026-10-03"},
    {"id": "m8", "contract": "AI Music Production Hub (MVP)", "title": "P2 — AI Natural-Language Search & Sound Metadata", "amount": 6000, "status": "Pending", "due": "2026-10-17"},
    {"id": "m9", "contract": "AI Music Production Hub (MVP)", "title": "P3 — AI Chain Builder & Recommendations", "amount": 7000, "status": "Pending", "due": "2026-10-31"},
    {"id": "m10", "contract": "AI Music Production Hub (MVP)", "title": "P4 — DAW Integration (beta)", "amount": 5000, "status": "Pending", "due": "2026-11-15"},
]

FREELANCERS = [
    {"id": "FL-3821", "name": "Priya Sharma", "region": "India", "skills": ["React", "Next.js", "Node"], "quality": 96, "avgDelivery": 4.2, "activeJobs": 2, "rate": 28, "status": "Active"},
    {"id": "FL-1190", "name": "Diego Alvarez", "region": "Argentina", "skills": ["Python", "FastAPI", "LLM"], "quality": 92, "avgDelivery": 5.1, "activeJobs": 1, "rate": 32, "status": "Active"},
    {"id": "FL-2077", "name": "Olena Kovar", "region": "Ukraine", "skills": ["React", "TypeScript", "D3"], "quality": 94, "avgDelivery": 3.8, "activeJobs": 1, "rate": 35, "status": "Active"},
    {"id": "FL-0456", "name": "Ahmed Nasser", "region": "Egypt", "skills": ["Shopify", "Liquid", "CSS"], "quality": 81, "avgDelivery": 6.4, "activeJobs": 1, "rate": 22, "status": "Under Review"},
    {"id": "FL-5521", "name": "Linh Tran", "region": "Vietnam", "skills": ["Flutter", "Firebase"], "quality": 89, "avgDelivery": 4.9, "activeJobs": 0, "rate": 26, "status": "Available"},
]

BLIND_BIDS = [
    {"id": "b1", "freelancer": "FL-3821", "hours": 60, "rate": 28, "total": 1680, "delivery": 5, "quality": 96, "roi": 91, "awarded": True},
    {"id": "b2", "freelancer": "FL-1190", "hours": 72, "rate": 32, "total": 2304, "delivery": 7, "quality": 92, "roi": 74, "awarded": False},
    {"id": "b3", "freelancer": "FL-5521", "hours": 80, "rate": 26, "total": 2080, "delivery": 8, "quality": 89, "roi": 70, "awarded": False},
    {"id": "b4", "freelancer": "FL-0456", "hours": 90, "rate": 22, "total": 1980, "delivery": 10, "quality": 81, "roi": 58, "awarded": False},
]

CONVERSATIONS = [
    {"id": "cv1", "contact": "Jordan Blake", "channel": "Web", "persona": "Sarah (PM)", "last": "Sounds great, let's proceed with the milestone.", "unread": 2, "sentiment": "positive", "time": "2026-09-16T10:05:00Z"},
    {"id": "cv2", "contact": "Dana Wu", "channel": "Email", "persona": "Mike (Senior Dev)", "last": "Can you clarify the API rate limits?", "unread": 0, "sentiment": "neutral", "time": "2026-09-16T09:20:00Z"},
    {"id": "cv3", "contact": "Sofia Klein", "channel": "WhatsApp", "persona": "Sarah (PM)", "last": "This is taking longer than promised.", "unread": 3, "sentiment": "at-risk", "time": "2026-09-16T08:40:00Z"},
    {"id": "cv4", "contact": "FL-3821 (Freelancer)", "channel": "Discord", "persona": "Dispatcher Bot", "last": "Spec received, submitting my bid now.", "unread": 0, "sentiment": "neutral", "time": "2026-09-16T07:55:00Z"},
]

CHAT_MESSAGES = [
    {"id": "msg1", "from": "client", "author": "Jordan Blake", "text": "Hi! Any update on the ticketing platform?", "time": "10:01"},
    {"id": "msg2", "from": "ai", "author": "Sarah (PM)", "text": "Hey Jordan! Yep — backend API milestone just wrapped. Frontend is ~60% done.", "time": "10:03", "delay": 22},
    {"id": "msg3", "from": "client", "author": "Jordan Blake", "text": "Awesome. When can we review?", "time": "10:04"},
    {"id": "msg4", "from": "ai", "author": "Sarah (PM)", "text": "I'll have a staging link for you by Thursday. Also — while we're in here, I'd recommend adding a CI/CD pipeline with GitHub Actions ($800). Want me to add it to the milestone?", "time": "10:05", "delay": 31, "upsell": True},
]

VOICE_CALLS = [
    {"id": "vc1", "client": "LedgerPay", "duration": "18:42", "date": "2026-09-15", "status": "Completed", "requirements": 7, "transcript": True},
    {"id": "vc2", "client": "NovaLabs", "duration": "12:05", "date": "2026-09-14", "status": "Completed", "requirements": 4, "transcript": True},
    {"id": "vc3", "client": "FitPulse", "duration": "09:33", "date": "2026-09-13", "status": "Notes Extracted", "requirements": 5, "transcript": True},
]

QA_RUNS = [
    {"id": "qa1", "contract": "Ticketing Platform", "pr": "#142", "lint": "pass", "tests": "pass", "sonar": 88, "status": "Passed", "freelancer": "FL-3821", "time": "2026-09-16T06:00:00Z"},
    {"id": "qa2", "contract": "AI Chatbot Widget", "pr": "#98", "lint": "pass", "tests": "fail", "sonar": 72, "status": "Failed", "freelancer": "FL-1190", "time": "2026-09-16T05:20:00Z"},
    {"id": "qa3", "contract": "Shopify Migration", "pr": "#57", "lint": "fail", "tests": "pass", "sonar": 64, "status": "Failed", "freelancer": "FL-0456", "time": "2026-09-15T22:10:00Z"},
    {"id": "qa4", "contract": "Fintech Dashboard", "pr": "#201", "lint": "pass", "tests": "pass", "sonar": 91, "status": "Passed", "freelancer": "FL-2077", "time": "2026-09-15T18:00:00Z"},
]

DELIVERABLES = [
    {"id": "d1", "contract": "Mobile MVP", "client": "FitPulse", "rebranded": True, "releaseNotes": True, "deliveredAt": "2026-09-10", "artifact": "fitpulse-mvp-v1.0.zip"},
    {"id": "d2", "contract": "Fintech Dashboard", "client": "LedgerPay", "rebranded": True, "releaseNotes": True, "deliveredAt": "2026-09-06", "artifact": "ledgerpay-dash-v0.9.zip"},
]

HITL_QUEUE = [
    {"id": "h1", "type": "Sentiment Escalation", "entity": "Sofia Klein (Craft & Co)", "reason": "Frustration detected in 3 consecutive messages", "priority": "High", "status": "Open", "created": "2026-09-16T08:41:00Z"},
    {"id": "h2", "type": "Hallucination Flag", "entity": "Proposal p3", "reason": "Referenced a portfolio item not in RAG context", "priority": "Medium", "status": "Open", "created": "2026-09-16T07:15:00Z"},
    {"id": "h3", "type": "Payout Approval", "entity": "FL-2077 · $3,500", "reason": "Milestone marked complete, awaiting human sign-off", "priority": "Medium", "status": "Open", "created": "2026-09-16T06:30:00Z"},
    {"id": "h4", "type": "Timeline Promise", "entity": "Dana Wu (NovaLabs)", "reason": "Client requested delivery date confirmation", "priority": "Low", "status": "Open", "created": "2026-09-15T20:00:00Z"},
]

INVOICES = [
    {"id": "inv1", "contract": "Ticketing Platform", "client": "Bright Startup Inc.", "amount": 2500, "status": "Paid", "due": "2026-09-14", "remindersSent": 0},
    {"id": "inv2", "contract": "Fintech Dashboard", "client": "LedgerPay", "amount": 3500, "status": "Sent", "due": "2026-09-25", "remindersSent": 0},
    {"id": "inv3", "contract": "Shopify Migration", "client": "Craft & Co", "amount": 4400, "status": "Overdue", "due": "2026-09-08", "remindersSent": 2},
    {"id": "inv4", "contract": "AI Chatbot Widget", "client": "NovaLabs", "amount": 2000, "status": "Draft", "due": "2026-09-30", "remindersSent": 0},
]

PAYOUTS = [
    {"id": "po1", "freelancer": "FL-3821", "contract": "Ticketing Platform", "amount": 1680, "status": "Completed", "transferId": "tr_1PQx...", "date": "2026-09-13"},
    {"id": "po2", "freelancer": "FL-2077", "contract": "Fintech Dashboard", "amount": 3000, "status": "Pending Approval", "transferId": "—", "date": "2026-09-16"},
    {"id": "po3", "freelancer": "FL-1190", "contract": "AI Chatbot Widget", "amount": 2400, "status": "Scheduled", "transferId": "tr_1PQy...", "date": "2026-09-18"},
]

MARKET_ARBITRAGE = [
    {"skill": "React / Next.js", "upworkRate": 65, "offshoreRate": 28, "margin": 57, "alert": False},
    {"skill": "Python / FastAPI", "upworkRate": 72, "offshoreRate": 30, "margin": 58, "alert": False},
    {"skill": "LLM / RAG", "upworkRate": 110, "offshoreRate": 38, "margin": 65, "alert": True},
    {"skill": "Shopify", "upworkRate": 55, "offshoreRate": 22, "margin": 60, "alert": True},
    {"skill": "Mobile (Flutter)", "upworkRate": 70, "offshoreRate": 26, "margin": 63, "alert": True},
]

COMPETITORS = [
    {"id": "cp1", "name": "PixelForge Agency", "activeBids": 12, "avgBid": 4200, "ourAction": "Undercut 5% + faster delivery", "winsAgainst": 8},
    {"id": "cp2", "name": "CodeCraft Studio", "activeBids": 7, "avgBid": 6800, "ourAction": "Monitoring", "winsAgainst": 3},
    {"id": "cp3", "name": "NextGen Devs", "activeBids": 15, "avgBid": 3100, "ourAction": "Undercut 5% + faster delivery", "winsAgainst": 11},
]

PORTFOLIO_ITEMS = [
    {"id": "pf1", "title": "Event Ticketing System", "tags": ["Next.js", "Stripe", "Postgres"], "semantic": ["booking", "reservation", "payments"], "image": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600"},
    {"id": "pf2", "title": "AI Support Chatbot", "tags": ["LLM", "RAG", "FastAPI"], "semantic": ["chatbot", "assistant", "automation"], "image": "https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=600"},
    {"id": "pf3", "title": "Fintech Analytics Dashboard", "tags": ["React", "D3", "WebSockets"], "semantic": ["analytics", "charts", "finance"], "image": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600"},
    {"id": "pf4", "title": "E-commerce Replatform", "tags": ["Shopify", "Liquid", "SEO"], "semantic": ["store", "commerce", "checkout"], "image": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600"},
    {"id": "pf5", "title": "HealthTech Mobile MVP", "tags": ["Flutter", "Firebase"], "semantic": ["mobile", "health", "tracking"], "image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600"},
    {"id": "pf6", "title": "Logistics ETL Pipeline", "tags": ["Python", "Airflow", "ETL"], "semantic": ["pipeline", "data", "integration"], "image": "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=600"},
]

PERSONAS = [
    {"id": "pr1", "name": "Sarah", "role": "Project Manager", "style": "Warm, organized, reassuring", "active": True, "conversations": 42},
    {"id": "pr2", "name": "Mike", "role": "Senior Developer", "style": "Technical, concise, confident", "active": True, "conversations": 28},
    {"id": "pr3", "name": "Elena", "role": "Account Executive", "style": "Persuasive, friendly, sales-focused", "active": True, "conversations": 19},
    {"id": "pr4", "name": "David", "role": "QA Lead", "style": "Detail-oriented, methodical", "active": False, "conversations": 6},
]

INTEGRATIONS = [
    {"id": "int-stripe", "name": "Stripe", "category": "Payments", "status": "Connected", "desc": "Escrow, Checkout & Connect mass payouts."},
    {"id": "int-github", "name": "GitHub", "category": "Code/QA", "status": "Connected", "desc": "PRs, GitHub Actions CI/CD gate."},
    {"id": "int-rocket", "name": "Rocket.Chat", "category": "Comms", "status": "Connected", "desc": "Omnichannel messaging routed through AI."},
    {"id": "int-whatsapp", "name": "WhatsApp Business", "category": "Comms", "status": "Connected", "desc": "Freelancer & client messaging."},
    {"id": "int-discord", "name": "Discord", "category": "Comms", "status": "Connected", "desc": "Freelancer spec broadcast bots."},
    {"id": "int-gmail", "name": "Gmail / SMTP", "category": "Comms", "status": "Connected", "desc": "Cold email sequences via n8n."},
    {"id": "int-cal", "name": "Cal.com", "category": "Scheduling", "status": "Connected", "desc": "Discovery call booking."},
    {"id": "int-n8n", "name": "n8n", "category": "Automation", "status": "Connected", "desc": "Workflow automation hub."},
    {"id": "int-odoo", "name": "Odoo CRM", "category": "CRM/Invoicing", "status": "Disconnected", "desc": "Invoicing & late-fee chasing."},
    {"id": "int-vapi", "name": "Vapi.ai", "category": "Voice", "status": "Connected", "desc": "AI voice discovery calls."},
    {"id": "int-ollama", "name": "Ollama", "category": "LLM", "status": "Connected", "desc": "Local llama3 for low-stakes tasks."},
    {"id": "int-claude", "name": "Anthropic Claude", "category": "LLM", "status": "Connected", "desc": "Client-facing high-quality comms."},
    {"id": "int-chroma", "name": "ChromaDB", "category": "Vector DB", "status": "Connected", "desc": "RAG for portfolio & proposals."},
    {"id": "int-scrapoxy", "name": "Scrapoxy", "category": "Proxies", "status": "Connected", "desc": "Residential proxy rotation."},
]

AUDIT_LOG = [
    {"id": "a1", "agent": "Bidding & Acquisition", "action": "Submitted proposal to Upwork lead #4821", "status": "success", "time": "2026-09-16T10:00:00Z"},
    {"id": "a2", "agent": "QA & Delivery", "action": "PR #98 failed test suite — auto-commented", "status": "warning", "time": "2026-09-16T05:20:00Z"},
    {"id": "a3", "agent": "Arbitrage Dispatcher", "action": "Awarded contract to FL-3821 (ROI 91)", "status": "success", "time": "2026-09-16T09:45:00Z"},
    {"id": "a4", "agent": "Stealth Client Manager", "action": "Escalated Sofia Klein to HITL (sentiment)", "status": "warning", "time": "2026-09-16T08:41:00Z"},
    {"id": "a5", "agent": "Job Hunter", "action": "Applied to 8 roles (randomized intervals)", "status": "success", "time": "2026-09-16T08:12:00Z"},
    {"id": "a6", "agent": "Self-Healing Scraper", "action": "Detected Upwork DOM drift — patched selectors", "status": "success", "time": "2026-09-16T04:02:00Z"},
]

NOTIFICATIONS = [
    {"id": "n1", "title": "New contract won", "body": "Python data pipeline (ETL) — $5,400 · 63% margin", "type": "success", "time": "2026-09-16T09:50:00Z", "read": False},
    {"id": "n2", "title": "HITL escalation", "body": "Sofia Klein flagged for frustration", "type": "warning", "time": "2026-09-16T08:41:00Z", "read": False},
    {"id": "n3", "title": "QA gate failed", "body": "PR #98 (AI Chatbot Widget) failed tests", "type": "warning", "time": "2026-09-16T05:20:00Z", "read": True},
    {"id": "n4", "title": "Scraper self-healed", "body": "Upwork selector auto-patched successfully", "type": "info", "time": "2026-09-16T04:02:00Z", "read": True},
    {"id": "n5", "title": "Payout completed", "body": "FL-3821 paid $1,680 via Stripe Connect", "type": "success", "time": "2026-09-13T12:00:00Z", "read": True},
]

DASHBOARD_USERS = [
    {"id": "du1", "name": "Alex Morgan", "email": "alex@agency.ai", "role": "Admin", "status": "Active", "lastActive": "now"},
    {"id": "du2", "name": "Riley Chen", "email": "riley@agency.ai", "role": "Operator", "status": "Active", "lastActive": "2h ago"},
    {"id": "du3", "name": "Sam Patel", "email": "sam@agency.ai", "role": "Viewer", "status": "Invited", "lastActive": "—"},
]

AFFILIATE_EVENTS = [
    {"id": "af1", "provider": "Vercel", "link": "vercel.com/?ref=agency", "clicks": 214, "conversions": 12, "revenue": 480},
    {"id": "af2", "provider": "DigitalOcean", "link": "do.co/ref/agency", "clicks": 168, "conversions": 9, "revenue": 675},
    {"id": "af3", "provider": "Stripe", "link": "stripe.com/partners", "clicks": 92, "conversions": 3, "revenue": 210},
]

SUBSCRIPTION_PLANS = [
    {"id": "free", "name": "Basic", "price": 0, "audience": "Try the platform", "features": ["10 job bids included", "2 platform profile slots", "Job Radar scans", "Community support"], "highlight": False},
    {"id": "plus", "name": "Plus", "price": 9, "audience": "Freelancers getting started", "features": ["50 job bids / month", "5 platform profiles", "AI Gig Builder", "Agency outreach tools", "Email support"], "highlight": False},
    {"id": "pro", "name": "Pro", "price": 19, "audience": "Serious freelancers & agencies", "features": ["Unlimited bids & profiles", "Priority job matching", "Full outreach + campaign suite", "Client portal & invoice chasing", "Priority support"], "highlight": True},
]

REVENUE_STREAMS = [
    {"id": "rs1", "stream": "Subscriptions", "monthly": 18400, "share": 32, "trend": 14, "desc": "3-tier SaaS plans — Basic, Plus, Pro"},
    {"id": "rs2", "stream": "Platform fee (5%)", "monthly": 4820, "share": 8, "trend": 11, "desc": "Take-rate on every contract payment"},
    {"id": "rs3", "stream": "Freelancer boosts", "monthly": 2100, "share": 4, "trend": 26, "desc": "Featured listings, priority dispatch, verified badges"},
    {"id": "rs4", "stream": "Add-on marketplace", "monthly": 3400, "share": 6, "trend": 19, "desc": "QA packs, expedited delivery, dedicated PM hours"},
    {"id": "rs5", "stream": "White-label licensing", "monthly": 2900, "share": 5, "trend": 8, "desc": "Agencies reselling the platform under their brand"},
    {"id": "rs6", "stream": "Affiliate revenue", "monthly": 1365, "share": 2, "trend": 31, "desc": "Vercel, DigitalOcean & tooling referrals"},
    {"id": "rs7", "stream": "Escrow float yield", "monthly": 840, "share": 1, "trend": 4, "desc": "Interest on funds held between milestones"},
    {"id": "rs8", "stream": "Premium support", "monthly": 1200, "share": 2, "trend": 9, "desc": "Priority support & onboarding add-ons"},
]

ADDON_MARKETPLACE = [
    {"id": "ad1", "name": "Featured Listing", "price": "$29/mo", "for": "Freelancers", "desc": "Appear first in the blind-auction pool"},
    {"id": "ad2", "name": "Priority Dispatch", "price": "$49/mo", "for": "Freelancers", "desc": "Get specs 1 hour before the general pool"},
    {"id": "ad3", "name": "Verified Badge", "price": "$19/mo", "for": "Freelancers", "desc": "Blue checkmark + trust boost on bids"},
    {"id": "ad4", "name": "Expedited Delivery", "price": "$199/project", "for": "Clients", "desc": "Fast-track your project to top-rated freelancers"},
    {"id": "ad5", "name": "Dedicated PM Hours", "price": "$150/10h", "for": "Clients", "desc": "Extra human project-manager attention"},
    {"id": "ad6", "name": "Voice AI Minutes", "price": "$0.40/min", "for": "Agencies", "desc": "AI discovery calls billed per minute"},
    {"id": "ad7", "name": "Custom Micro-site Domain", "price": "$15/mo", "for": "Agencies", "desc": "clientname.youragency.com branding"},
    {"id": "ad8", "name": "Market Rate Reports", "price": "$99/mo", "for": "Agencies", "desc": "Weekly arbitrage & pricing intelligence"},
    {"id": "ad9", "name": "White-Label Pack", "price": "$199/mo", "for": "Agencies", "desc": "Remove all Autopilot branding"},
]

BILLING_HISTORY = [
    {"id": "bh1", "date": "2026-09-01", "description": "Business plan — monthly", "amount": 500, "status": "Paid"},
    {"id": "bh2", "date": "2026-08-01", "description": "Business plan — monthly", "amount": 500, "status": "Paid"},
    {"id": "bh3", "date": "2026-07-01", "description": "Business plan — monthly", "amount": 500, "status": "Paid"},
]

# ---- Freelancer portal ----
FREELANCER_OPEN_SPECS = [
    {"id": "spec1", "title": "SaaS analytics dashboard module", "stack": ["Next.js", "Recharts", "Postgres"], "estHours": "50-70", "deadline": "12 days", "bidsIn": 6, "status": "Open for bids"},
    {"id": "spec2", "title": "LLM RAG integration service", "stack": ["Python", "FastAPI", "ChromaDB"], "estHours": "40-60", "deadline": "10 days", "bidsIn": 4, "status": "Open for bids"},
    {"id": "spec3", "title": "Shopify checkout customization", "stack": ["Liquid", "JS"], "estHours": "20-30", "deadline": "6 days", "bidsIn": 9, "status": "Closing soon"},
]

FREELANCER_MY_BIDS = [
    {"id": "fb1", "spec": "SaaS analytics dashboard module", "hours": 60, "rate": 28, "total": 1680, "status": "Awarded", "submitted": "2026-09-15"},
    {"id": "fb2", "spec": "LLM RAG integration service", "hours": 55, "rate": 32, "total": 1760, "status": "Under Review", "submitted": "2026-09-16"},
    {"id": "fb3", "spec": "Mobile MVP polish", "hours": 30, "rate": 26, "total": 780, "status": "Not Selected", "submitted": "2026-09-12"},
]

FREELANCER_CONTRACTS = [
    {"id": "fc1", "title": "SaaS analytics dashboard module", "milestonesDone": 1, "milestonesTotal": 3, "value": 1680, "qa": "Passing", "due": "2026-09-27"},
    {"id": "fc2", "title": "Ticketing Platform frontend", "milestonesDone": 2, "milestonesTotal": 3, "value": 1500, "qa": "Passing", "due": "2026-09-29"},
]

FREELANCER_EARNINGS = [
    {"month": "Jun", "amount": 3200},
    {"month": "Jul", "amount": 4100},
    {"month": "Aug", "amount": 3800},
    {"month": "Sep", "amount": 5200},
]

# ---- Client portal ----
CLIENT_PROJECTS = [
    {"id": "cp-1", "title": "Ticketing Platform", "status": "In Progress", "progress": 60, "nextMilestone": "Frontend UI", "due": "2026-09-29", "pm": "Sarah"},
    {"id": "cp-2", "title": "Marketing Website Revamp", "status": "Review", "progress": 90, "nextMilestone": "Final QA", "due": "2026-09-21", "pm": "Sarah"},
]

CLIENT_FILES = [
    {"id": "cf1", "name": "Staging Build v0.9", "type": "ZIP", "size": "24 MB", "date": "2026-09-14"},
    {"id": "cf2", "name": "Design System.fig", "type": "Figma", "size": "8 MB", "date": "2026-09-10"},
    {"id": "cf3", "name": "Release Notes v0.9.pdf", "type": "PDF", "size": "220 KB", "date": "2026-09-14"},
]

CLIENT_INVOICES = [
    {"id": "ci1", "title": "Milestone 2 — Backend API", "amount": 2500, "status": "Paid", "due": "2026-09-14"},
    {"id": "ci2", "title": "Milestone 3 — Frontend UI", "amount": 2500, "status": "Due", "due": "2026-09-29"},
]

SETTINGS = {
    "mode": "compliance",
    "matchThreshold": 80,
    "budgetFloor": 500,
    "appsPerDay": 10,
    "autoBid": True,
    "autoPayout": False,
    "selfHeal": True,
    "clientFacingModel": "claude",
    "internalModel": "ollama",
}

# ---- API Vault — centrally managed credentials (values masked; real keys live in env/secrets manager) ----
API_CREDENTIALS = [
    {"id": "cred-stripe", "service": "Stripe", "category": "Payments", "envVar": "STRIPE_SECRET_KEY", "maskedKey": "sk_live_••••••••4f2a", "status": "Connected", "lastRotated": "2026-08-14", "managedBy": "Agency Vault"},
    {"id": "cred-anthropic", "service": "Anthropic Claude", "category": "LLM", "envVar": "ANTHROPIC_API_KEY", "maskedKey": "sk-ant-••••••••9c1d", "status": "Connected", "lastRotated": "2026-08-30", "managedBy": "Agency Vault"},
    {"id": "cred-proxy", "service": "Residential Proxies", "category": "Scraping", "envVar": "PROXY_USERNAME", "maskedKey": "usr_••••••••7b3e", "status": "Connected", "lastRotated": "2026-09-02", "managedBy": "Agency Vault"},
    {"id": "cred-vapi", "service": "Vapi.ai", "category": "Voice", "envVar": "VAPI_API_KEY", "maskedKey": "••••••••••••8f11", "status": "Pending", "lastRotated": "—", "managedBy": "Agency Vault"},
    {"id": "cred-whatsapp", "service": "WhatsApp Business", "category": "Comms", "envVar": "WHATSAPP_TOKEN", "maskedKey": "EAAG••••••••c02d", "status": "Connected", "lastRotated": "2026-08-21", "managedBy": "Agency Vault"},
    {"id": "cred-gmail", "service": "Gmail API", "category": "Comms", "envVar": "GMAIL_CLIENT_SECRET", "maskedKey": "GOCSPX-••••••••55aa", "status": "Connected", "lastRotated": "2026-07-19", "managedBy": "Agency Vault"},
    {"id": "cred-github", "service": "GitHub", "category": "Code/QA", "envVar": "GITHUB_TOKEN", "maskedKey": "ghp_••••••••3e9f", "status": "Connected", "lastRotated": "2026-09-05", "managedBy": "Agency Vault"},
    {"id": "cred-sonar", "service": "SonarQube", "category": "Code/QA", "envVar": "SONAR_TOKEN", "maskedKey": "squ_••••••••1a4b", "status": "Pending", "lastRotated": "—", "managedBy": "Agency Vault"},
    {"id": "cred-odoo", "service": "Odoo", "category": "CRM/Invoicing", "envVar": "ODOO_API_KEY", "maskedKey": "—", "status": "Pending", "lastRotated": "—", "managedBy": "Agency Vault"},
    {"id": "cred-n8n", "service": "n8n", "category": "Automation", "envVar": "N8N_API_KEY", "maskedKey": "n8n_••••••••d77c", "status": "Connected", "lastRotated": "2026-08-11", "managedBy": "Agency Vault"},
    {"id": "cred-rocket", "service": "Rocket.Chat", "category": "Comms", "envVar": "ROCKETCHAT_TOKEN", "maskedKey": "tok_••••••••6e21", "status": "Connected", "lastRotated": "2026-08-11", "managedBy": "Agency Vault"},
    {"id": "cred-cal", "service": "Cal.com", "category": "Scheduling", "envVar": "CALCOM_API_KEY", "maskedKey": "cal_••••••••93bd", "status": "Connected", "lastRotated": "2026-08-26", "managedBy": "Agency Vault"},
    {"id": "cred-email", "service": "Resend (email)", "category": "Comms", "envVar": "EMAIL_API_KEY", "maskedKey": "re_••••••••20cd", "status": "Connected", "lastRotated": "2026-09-01", "managedBy": "Agency Vault"},
    {"id": "cred-openai", "service": "OpenAI (backup LLM)", "category": "LLM", "envVar": "OPENAI_API_KEY", "maskedKey": "sk-••••••••41fa", "status": "Standby", "lastRotated": "2026-07-28", "managedBy": "Agency Vault"},
]

SECURITY_CONTROLS = [
    {"id": "sec1", "control": "Secrets in env vars only — never in repo or logs", "area": "Secrets", "status": "Enforced"},
    {"id": "sec2", "control": "Security headers (X-Frame-Options, nosniff, Referrer-Policy)", "area": "HTTP", "status": "Enforced"},
    {"id": "sec3", "control": "Per-IP rate limiting (240 req/min sliding window)", "area": "Abuse", "status": "Enforced"},
    {"id": "sec4", "control": "X-Request-Id on every request for audit correlation", "area": "Observability", "status": "Enforced"},
    {"id": "sec5", "control": "Optional X-API-Key gate for mutating endpoints", "area": "Auth", "status": "Configured"},
    {"id": "sec6", "control": "CORS allowlist (frontend origin only)", "area": "HTTP", "status": "Enforced"},
    {"id": "sec7", "control": "Credential rotation schedule (30/60/90-day by tier)", "area": "Secrets", "status": "In progress"},
    {"id": "sec8", "control": "pip-audit + npm audit in CI (supply chain)", "area": "Dependencies", "status": "Planned"},
    {"id": "sec9", "control": "JWT auth + RBAC (admin/operator/viewer)", "area": "Auth", "status": "Planned"},
    {"id": "sec10", "control": "Webhook signature verification (Stripe, GitHub)", "area": "Webhooks", "status": "Planned"},
]

SECURITY_EVENTS = [
    {"id": "ev1", "event": "Credential rotated", "detail": "GITHUB_TOKEN rotated per 30-day policy", "severity": "info", "time": "2026-09-05T10:00:00Z"},
    {"id": "ev2", "event": "Rate limit triggered", "detail": "185.220.x.x throttled at 240 req/min", "severity": "warning", "time": "2026-09-14T03:12:00Z"},
    {"id": "ev3", "event": "New service connected", "detail": "Resend email API added to vault", "severity": "info", "time": "2026-09-01T14:00:00Z"},
    {"id": "ev4", "event": "Unapproved key access attempt", "detail": "X-API-Key mismatch on POST /api/settings", "severity": "warning", "time": "2026-09-12T19:44:00Z"},
]

# ---- User testing ----
USER_TEST_SCENARIOS = [
    {"id": "ut1", "role": "Admin", "scenario": "Start/pause each agent from Command Center", "status": "Passed", "tester": "Alex", "notes": "All 6 agents toggle correctly"},
    {"id": "ut2", "role": "Admin", "scenario": "Broadcast a spec to freelancer pool", "status": "Passed", "tester": "Alex", "notes": "Toast + audit entry confirmed"},
    {"id": "ut3", "role": "Admin", "scenario": "Approve a pending payout", "status": "In progress", "tester": "Riley", "notes": "Verifying audit trail"},
    {"id": "ut4", "role": "Admin", "scenario": "Resolve a HITL escalation", "status": "In progress", "tester": "Riley", "notes": ""},
    {"id": "ut5", "role": "Admin", "scenario": "Click every stat card → lands on detail page", "status": "Planned", "tester": "Sam", "notes": "Full click-through sweep"},
    {"id": "ut6", "role": "Freelancer", "scenario": "Browse open specs and submit a bid", "status": "Passed", "tester": "Priya", "notes": "Bid appears in My Bids"},
    {"id": "ut7", "role": "Freelancer", "scenario": "Check QA status on a submitted PR", "status": "In progress", "tester": "Priya", "notes": ""},
    {"id": "ut8", "role": "Freelancer", "scenario": "Activate a paid boost from billing", "status": "Planned", "tester": "Priya", "notes": ""},
    {"id": "ut9", "role": "Client", "scenario": "Approve a milestone and pay invoice", "status": "Passed", "tester": "Jordan", "notes": "Escrow flow clear to user"},
    {"id": "ut10", "role": "Client", "scenario": "Send a message to the team", "status": "Passed", "tester": "Jordan", "notes": ""},
    {"id": "ut11", "role": "Client", "scenario": "Upgrade plan from billing page", "status": "In progress", "tester": "Jordan", "notes": "Testing trial CTA clarity"},
    {"id": "ut12", "role": "Public", "scenario": "Signup → role form → dashboard entry", "status": "Planned", "tester": "Sam", "notes": "All 3 role forms"},
]

USER_FEEDBACK = [
    {"id": "fb1", "from": "Priya (Freelancer)", "area": "Specs", "text": "Blind bid is clear but I want to see deadline pressure on the card.", "severity": "Suggestion", "status": "Open", "date": "2026-09-16"},
    {"id": "fb2", "from": "Jordan (Client)", "area": "Milestones", "text": "Approve & Pay flow is intuitive — one click was enough.", "severity": "Positive", "status": "Logged", "date": "2026-09-15"},
    {"id": "fb3", "from": "Riley (Operator)", "area": "Navigation", "text": "Too many clicks to reach integrations — should be one level up.", "severity": "Issue", "status": "Fixed", "date": "2026-09-14"},
    {"id": "fb4", "from": "Sam (Viewer)", "area": "Dashboard", "text": "Stat cards look clickable but weren't — now fixed.", "severity": "Issue", "status": "Fixed", "date": "2026-09-17"},
]
