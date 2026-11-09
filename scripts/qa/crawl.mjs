// Usage: npm run build && npm start -- -p 3100, then (one-time) npm i --no-save playwright && npx playwright install chromium,
// then BASE_URL=http://localhost:3100 npm run qa:crawl.
// Route crawler: visits every route, records console errors, page errors, failed requests, blank pages, and broken internal links.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = process.env.BASE_URL || "http://localhost:3100";
function routes(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) { if (/^page\.(t|j)sx?$/.test(e.name)) out.push(base || "/"); continue; }
    const seg = e.name;
    if (seg.startsWith("_")) continue;
    const p = seg.startsWith("(") ? base : `${base}/${seg}`;
    out.push(...routes(path.join(dir, seg), p));
  }
  return [...new Set(out)];
}
const dyn = { "[id]": "a1", "[slug]": "demo" };
const list = routes("app").map((r) => r.replace(/\[(\w+)\]/g, (m) => dyn[m] || "demo")).sort();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const results = []; const links = new Set();
for (const r of list) {
  const page = await ctx.newPage(); const errs = []; const bad = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/font|favicon|ERR_TUNNEL|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); });
  page.on("response", (res) => { if (res.status() >= 400 && res.url().startsWith(BASE)) bad.push(res.status() + " " + res.url().replace(BASE, "")); });
  let status = 0, text = "";
  try { const res = await page.goto(BASE + r, { waitUntil: "networkidle", timeout: 20000 }); status = res?.status() ?? 0; await page.waitForTimeout(600);
    text = (await page.innerText("body")).trim();
    (await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href")))).forEach((h) => links.add(h.split("#")[0].split("?")[0])); } catch (e) { errs.push("nav: " + e.message.slice(0, 120)); }
  results.push({ route: r, status, blank: text.length < 40, errs, bad, notFound: /could not be found|404/i.test(text.slice(0, 300)) });
  await page.close();
}
const known = new Set(list.map((r) => r.replace(/\/(a1|demo)$/, "")));
const knownPrefix = (h) => list.some((r) => r === h) || list.some((r) => r.replace(/\/(a1|demo)$/, "") === h.replace(/\/[^/]+$/, "") && /^\/(dashboard\/agents|microsite|portfolio|dashboard\/\w+|client\/\w+|freelancer\/\w+)\//.test(h));
const broken = [...links].filter((h) => h && !knownPrefix(h));
const problems = results.filter((x) => x.status >= 400 || x.blank || x.errs.length || x.bad.length || x.notFound);
console.log(JSON.stringify({ routes: list.length, problems, brokenLinks: broken }, null, 1));
await browser.close();
