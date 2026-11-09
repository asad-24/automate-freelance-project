# Deploying Autopilot: step-by-step (free demo on Render + Vercel)

This guide puts the app online **using only free accounts**, for a client demo. The backend runs on **Render** (free plan) and the frontend on **Vercel** (free Hobby plan); data lives in a free **MongoDB Atlas** cluster.

Follow the parts in order: the frontend needs the backend's URL, and the backend needs the frontend's URL. Allow about 40 minutes the first time.

**What gets created (all free)**

| Piece | Where | What it does |
|---|---|---|
| `autopilot-api` | Render web service, **Free** plan | The FastAPI backend: login, data, Job Radar, AI drafts |
| Frontend | Vercel project, **Hobby** plan | The Next.js website people open |
| Database | MongoDB Atlas, **M0 Free** cluster | Keeps accounts and data |
| AI writing | Groq, free tier | Proposals, replies, gig drafts |

**What the free setup leaves out:**

- **Scheduled background scans** and their "strong match" alerts, because Render has no free background workers.
- **The optional browser-automation worker.**

Everything you show in a demo still works, including **Job Radar → Scan now**. To switch the missing parts back on, see [After the demo](#after-the-demo-upgrading-to-production).

**Free-plan behaviour to know about:**

- **The API sleeps after 15 minutes without visits.** The next visit wakes it in about a minute. See [Before the demo](#part-5-before-the-demo).
- **The database is required.** A sleeping service loses anything kept only in memory, so without MongoDB, accounts would vanish between visits.
- **Vercel's Hobby plan is for non-commercial use.** It's fine for showing the client; move to Vercel Pro before real customers use the app.

---

## Part 0: Accounts and values to collect

Create these free accounts. Sign in with GitHub where offered, which makes connecting the repo easier.

- [ ] **GitHub:** access to `shahrierQA/automated-freelancer-platform`.
- [ ] **Render:** https://dashboard.render.com. No card is needed for the free plan.
- [ ] **Vercel:** https://vercel.com, Hobby plan.
- [ ] **MongoDB Atlas:** https://cloud.mongodb.com.
- [ ] **Groq:** https://console.groq.com.

Keep these values in a password manager, never in the repo or in chat:

| Value | How to get it |
|---|---|
| **MongoDB connection string** | Part 1. |
| **Groq API key** | console.groq.com → **API Keys** → **Create API Key**. Copy it; it's shown only once. |
| **Your admin email** | The email you'll sign up with in the app. |

---

## Part 1: Create the free database (MongoDB Atlas)

1. Sign in to https://cloud.mongodb.com and create a **project** called `autopilot`.
2. Click **Create** and choose **M0 (Free)**:
   - Provider: **AWS**.
   - Region: **Oregon (us-west-2)**, close to Render's default region.
   - Click **Create Deployment**.
3. **Create the database user.** Atlas may show this right away; otherwise go to **Security → Database Access → Add New Database User**.
   - Username: `autopilot-app`.
   - Click **Autogenerate Secure Password** and **copy the password**.
   - Role: **Read and write to any database**.
   - Click **Add User**.
4. **Allow Render to connect.** Go to **Security → Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`), then **Confirm**. Free Render services don't have fixed IP addresses, so this is the practical choice for a demo; the strong password protects the database.
5. **Copy the connection string.** Go to **Database → Connect → Drivers → Python**. It looks like:

   ```
   mongodb+srv://autopilot-app:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<db_password>` with the password from step 3. This is your **`MONGODB_URI`**.

✅ You have a `MONGODB_URI` to paste in Part 2.

---

## Part 2: Deploy the backend on Render (free)

The repo's `render.yaml` is already set to the free plan and creates **one** service, `autopilot-api`.

### 2a. Create the Blueprint

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect GitHub if asked, then pick **`shahrierQA/automated-freelancer-platform`**.
3. **Blueprint Name:** `autopilot`. **Branch:** `main`.
4. Render shows **one** resource, `autopilot-api`, on the **Free** plan.

> **Already created services from this repo earlier (paid ones)?** Delete or suspend them first, so you aren't billed and there are no name clashes. Go to each service → **Settings** → bottom of the page → **Delete Web Service** / **Delete Background Worker**.

### 2b. Fill in the values Render asks for

Render asks for a long list of values. **Fill in only these two and leave all the others blank.** Blank switches safely stay off.

| Variable | Enter |
|---|---|
| `MONGODB_URI` | Your connection string from Part 1. |
| `GROQ_API_KEY` | Your Groq key. |

These are filled in automatically:

- `SECRET_KEY`: generated randomly by the Blueprint.
- `ENVIRONMENT=production`: set in `render.yaml`.
- `CORS_ORIGINS`: set in `render.yaml`.

5. Click **Apply**. The first build takes about 3–5 minutes.

### 2c. Add your admin email

**`autopilot-api` → Environment → Add Environment Variable**. Key: `OWNER_EMAILS`. Value: your admin email (separate several with commas). Then click **Save, rebuild, and deploy**.

### 2d. Check the backend

1. Open **`autopilot-api`** and copy the URL under its name, e.g. `https://autopilot-api-xxxx.onrender.com`. This is your **API URL**.
2. Open `<API URL>/health` in a browser. If the service was asleep, this can take up to a minute. You should see:

   ```json
   {"status":"ok","environment":"production","version":"0.3.0","database":"ok"}
   ```

   | If you see | It means | Fix |
   |---|---|---|
   | `"database":"in-memory"` | `MONGODB_URI` is missing. | Add it in **Environment**. Without it, accounts vanish whenever the free service sleeps. |
   | HTTP 503 with `"database":"unavailable"` | Atlas refused the connection. | Check **Network Access** (Part 1, step 4) and the password inside the URI. |
   | Deploy log ends with `SECRET_KEY must be a random value…` | `SECRET_KEY` was removed or shortened. | In **Environment**, click **Generate** next to `SECRET_KEY`. |

✅ Backend is live. Keep the **API URL** handy.

---

## Part 3: Deploy the frontend on Vercel (free)

### 3a. Import the project

> **A Vercel project for this repo already exists** (e.g. `autopilotv2`)? Open it, set the variables from 3b under **Settings → Environment Variables**, then go to **Deployments** → **⋯** on the latest deployment → **Redeploy**. Then go to 3c.

1. Go to https://vercel.com/new.
2. Under **Import Git Repository**, pick **`shahrierQA/automated-freelancer-platform`**. If it's missing, click **Adjust GitHub App Permissions** and grant access to the repo.
3. On **Configure Project**, leave everything at its default:
   - **Framework Preset:** Next.js (detected automatically).
   - **Root Directory:** `./`.
   - **Build, output and install commands:** the defaults.

   Node.js 22 comes from `package.json`; there's nothing to set.

### 3b. Set the environment variables

Expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Your **API URL** from Part 2d, e.g. `https://autopilot-api-xxxx.onrender.com`. **No trailing slash.** |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | `false` |
| `NEXT_PUBLIC_SITE_URL` | Optional: your App URL, used for the sitemap and link previews. Defaults to `https://autopilotv2.vercel.app`. |

Leave `NEXT_PUBLIC_PAYMENTS_LIVE` unset. Until Stripe is integrated, Upgrade buttons say "payments open soon" and never ask for card details.

> `NEXT_PUBLIC_*` values are compiled into the site when it builds. If you change one later, **redeploy**; saving the value alone changes nothing.

### 3c. Deploy

1. Click **Deploy** and wait about 2–4 minutes.
2. Copy the production URL Vercel shows, e.g. `https://autopilotv2.vercel.app`. This is your **App URL**.

✅ Frontend is live.

---

## Part 4: Connect the frontend and backend (CORS)

The backend accepts browser requests only from the addresses in `CORS_ORIGINS`. In `render.yaml` it is set to:

```
https://autopilotv2.vercel.app,http://localhost:3000
```

**If your App URL is exactly `https://autopilotv2.vercel.app`, there's nothing to do.** Otherwise:

1. Edit `render.yaml`. Under `autopilot-api`, change the `CORS_ORIGINS` value to your App URL. Keep `http://localhost:3000` if you develop locally. Use exact URLs with no trailing slash, separated by commas.
2. Commit and push to `main`. Render redeploys automatically.

Change it in the file, not only in Render's dashboard: values defined in `render.yaml` can be overwritten by the next Blueprint sync.

---

## Part 5: Before the demo

Do this **10 minutes before** you present, so the client never waits for a cold start.

1. **Wake the API:** open `<API URL>/health` and wait for `"status":"ok"`.
2. **Sign in:** open your **App URL** and sign in with the demo account.
3. **Warm the Job Radar:** open **Job Radar** and click **Scan now** once. The first scan fetches the feeds; scans after that come from the cache and are instant.
4. **Keep it awake:** keep the app open in a tab during the demo. Any visit within 15 minutes keeps the API awake.
5. **Optional demo content:** save a search, generate one AI proposal, create one gig draft, and record an invoice in **Money**, so there's something to show straight away.

### Demo checklist

Run `npm run qa` first; it's an instant static check. The full go/no-go list is in [launch-readiness.md](launch-readiness.md).

- [ ] **Sign up or sign in, then reload.** You're still signed in.
- [ ] **Job Radar → Scan now.** Jobs appear from RemoteOK, We Work Remotely, Jobicy, Arbeitnow, Himalayas and 4 Day Week, with budgets in each listing's own currency.
- [ ] **Job Radar → pick a job → AI Draft.** A tailored proposal appears (needs `GROQ_API_KEY`).
- [ ] **Money.** Record income, create an invoice, mark it paid, export CSV.
- [ ] **Calendar.** Add an event. The invoice due date appears automatically.
- [ ] **Integrations → Capability Map.** It shows **79 platforms**, with category filters and search.
- [ ] **Accounts & Platforms → Guided account setup.** **Show all 46 platforms** expands the list; signup links open the official sites.
- [ ] **Upgrade (any page).** It says payments open soon and asks for no card details.

**If the app says "Can't reach the server":**

1. Open `<API URL>/health` directly. If it's still waking up, wait a minute and reload the app.
2. If health is OK but the app still fails, either:
   - `NEXT_PUBLIC_API_URL` on Vercel is wrong or has a trailing slash. Fix it and **redeploy**.
   - The App URL is missing from `CORS_ORIGINS` (Part 4).

---

## After the demo: upgrading to production

When the client signs off, switch on what the free plan leaves out:

1. **Render**, in `render.yaml`:
   1. Change `autopilot-api` to `plan: 0.5c-512mb` (Starter) so it stays awake.
   2. Uncomment its `REDIS_URL` block.
   3. Remove one leading `# ` from every line in the **Paid add-ons** section at the bottom. That brings back `autopilot-queue` (scheduled scans every 15 minutes, plus match alerts), `autopilot-redis`, and optionally `autopilot-worker`.
   4. Commit, push, then in Render go to **Blueprints** → `autopilot` → **Manual Sync**.
   5. On `autopilot-queue`, set `MONGODB_URI` to the same value as the API.
2. **Vercel:** upgrade to **Pro**; Hobby is for non-commercial use only.
3. **Payments:** once Stripe checkout is integrated, set `NEXT_PUBLIC_PAYMENTS_LIVE=true` and redeploy. Reword the escrow claim in the Terms first (see [launch-readiness.md](launch-readiness.md)).
4. **Atlas:** move off M0 when you need backups or more than 512 MB. Then replace `0.0.0.0/0` with Render's outbound IP ranges (service → **Connect** → **Outbound**).
5. **Optional extras:**
   - **Sentry:** set `SENTRY_DSN` on Render and `NEXT_PUBLIC_SENTRY_DSN` on Vercel.
   - **Custom domain:** add `app.` on Vercel and `api.` on Render, then update `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and `CORS_ORIGINS`.
   - **More job sources, once approved:** add their ids to `JOB_SOURCES_APPROVED` or set their API keys (see [platform-matrix.md](platform-matrix.md)).

## Day-to-day operations

- **Deploying changes:** every push to `main` redeploys Render and Vercel automatically.
- **Switching off a misbehaving feed:** add its id to `JOB_SOURCES_DISABLED` on `autopilot-api`. No code change is needed.
- **Rolling back:**
  - **Vercel:** go to **Deployments**, pick the last good one, and click **Instant Rollback**.
  - **Render:** open the service → **Events** → the last good deploy → **Rollback**.

## Reference: environment variables for the free setup

| Where | Required | Optional |
|---|---|---|
| Render `autopilot-api` | `MONGODB_URI`, `GROQ_API_KEY`, `OWNER_EMAILS`. `SECRET_KEY` and `CORS_ORIGINS` come from the Blueprint. | `JOB_SOURCES_APPROVED` / `JOB_SOURCES_DISABLED`, job API keys, `SENTRY_DSN` (see [README → Environment variables](../README.md)) |
| Vercel | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEV_BYPASS_AUTH=false` | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SENTRY_DSN`. Leave `NEXT_PUBLIC_PAYMENTS_LIVE` unset until Stripe is integrated. |
