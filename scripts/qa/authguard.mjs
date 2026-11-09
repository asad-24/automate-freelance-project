// Usage: BASE_URL=http://localhost:3200 npm run qa:auth (needs playwright, see crawl.mjs).
// Run against a production build made WITHOUT NEXT_PUBLIC_DEV_BYPASS_AUTH. Verifies logged-out users are kept out.
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3200";
const b = await chromium.launch(); let fail = 0;
const check = (n, ok, d = "") => { console.log(ok ? "PASS" : "FAIL", n, d); if (!ok) fail++; };
for (const r of ["/dashboard", "/dashboard/agents", "/client", "/freelancer"]) {
  const p = await (await b.newContext()).newPage();
  await p.goto(BASE + r, { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const u = new URL(p.url()).pathname;
  check(`logged-out ${r} is redirected`, !u.startsWith(r) || /login|signup/.test(u), "-> " + u);
}
const p = await (await b.newContext()).newPage();
await p.goto(BASE + "/", { waitUntil: "networkidle" });
check("marketing home is public", new URL(p.url()).pathname === "/");
await b.close(); process.exit(fail ? 1 : 0);
