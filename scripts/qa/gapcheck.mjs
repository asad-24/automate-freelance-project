// Launch gap-check: static scan for things that are commonly missing before launch.
// Usage: npm run qa   (writes docs/gapcheck-report.md; exits 1 if any FAIL)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
const root = process.cwd();
const results = [];
const add = (area, name, ok, note = "", level = "FAIL") => results.push({ area, name, ok, note, level: ok ? "PASS" : level });
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => (exists(p) ? fs.readFileSync(path.join(root, p), "utf8") : "");
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".venv", "venv", "__pycache__", ".pytest_cache", "Autopilot-launch"].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    f.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p);

// 1. Routes vs. links
const pages = walk(path.join(root, "app")).filter((f) => /page\.tsx$/.test(f)).map((f) => "/" + rel(f).replace(/^app\//, "").replace(/\/?page\.tsx$/, "").replace(/\(.*?\)\//g, ""));
const routeRegexes = pages.map((p) => new RegExp("^" + p.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+") + "$"));
const src = [...walk(path.join(root, "app")), ...walk(path.join(root, "components")), ...walk(path.join(root, "lib"))].filter((f) => /\.(tsx?|ts)$/.test(f));
const broken = new Set();
for (const f of src) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/(?:href|push|replace)\s*[=(]\s*\{?\s*["'`](\/[a-zA-Z0-9\-_/]*)["'`]/g)) {
    const h = m[1].replace(/\/$/, "") || "/";
    if (h.startsWith("/api") || h === "/") continue;
    if (!routeRegexes.some((r) => r.test(h))) broken.add(`${h}  (${rel(f)})`);
  }
}
add("Routes", `internal links resolve to a page (${pages.length} pages)`, broken.size === 0, [...broken].slice(0, 15).join("\n    "));

// 2. Buttons with no handler (static heuristic)
const dead = [];
for (const f of src.filter((f) => f.endsWith(".tsx"))) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/<Button\b((?:[^>=]|=>|=(?:"[^"]*"|'[^']*'|\{[^}]*\}))*?)>/g)) {
    const a = m[1];
    if (!/onClick|type=["']submit|asChild|href|onSelect|disabled|onValueChange/.test(a)) dead.push(`${rel(f)}: <Button${a.slice(0, 60).replace(/\s+/g, " ")}`);
  }
}
add("Interaction", "every <Button> has a handler/href/submit (static heuristic)", dead.length === 0, `${dead.length} without; first:\n    ` + dead.slice(0, 12).join("\n    "), "WARN");

// 3. Fake-success / misleading copy
const bad = [];
for (const f of src) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/toast[^;\n]*["'`]([^"'`]*(Redirecting to|Payment (successful|received)|Sent!|Connected!)[^"'`]*)["'`]/gi)) bad.push(`${rel(f)}: ${m[1]}`);
}
add("Truthfulness", "no obviously fake-success toasts", bad.length === 0, bad.slice(0, 10).join("\n    "), "WARN");

// 4. Hard-coded secrets / credentials
// Placeholders like mongodb+srv://user:<db_password>@… are not secrets: real
// credentials never contain angle brackets.
const secretRe = /(sk_live_[A-Za-z0-9]{10,}|gsk_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|mongodb(\+srv)?:\/\/[^"'\s<>]+:[^"'\s<>]+@)/;
const leaks = walk(root).filter((f) => /\.(tsx?|py|json|md|mjs|js)$/.test(f) && !/package-lock/.test(f)).filter((f) => secretRe.test(fs.readFileSync(f, "utf8"))).map(rel);
add("Security", "no API keys / DB URIs committed in source", leaks.length === 0, leaks.join("\n    "));
// In a git checkout only committed files ship; ignored local .env files are fine.
let tracked = null;
try { tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n"); } catch { /* not a git checkout */ }
const envFiles = (tracked ?? walk(root).map(rel)).filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/example|sample/.test(f));
add("Security", tracked ? "no .env files committed to git" : "no real .env files in the folder to ship", envFiles.length === 0, envFiles.join(", "));
const demoCreds = /["']?password["']?\s*[:=]\s*["'][^"']{4,}["']/i.test(read("backend/app/routers/demo.py"));
add("Security", "no hard-coded demo credentials in backend/app/routers/demo.py", !demoCreds, "Demo logins exist in backend; disable or gate behind env before launch.", "WARN");
const bypass = read("lib/auth.tsx");
add("Security", "auth bypass is off by default in production", /NODE_ENV\s*!==\s*["']production["']|DEV_BYPASS_AUTH\s*===\s*["']true["']/.test(bypass), "DEV_BYPASS_AUTH must not default to true in prod");
add("Security", "backend has server-side auth on data routes", /Depends\((current_user|require_roles)/.test(read("backend/app/main.py")), "Client-side auth only: API GETs are open. Needs JWT/session + per-user tenancy before real customers.");

// 5. SEO / legal / ops files
for (const [p, label, lvl] of [
  ["app/robots.ts", "robots.txt", "FAIL"], ["app/sitemap.ts", "sitemap.xml", "FAIL"], ["app/icon.svg", "favicon/icon", "WARN"],
  ["app/not-found.tsx", "custom 404", "FAIL"], ["app/error.tsx", "error boundary", "FAIL"], ["app/global-error.tsx", "global error boundary", "FAIL"],
]) add("Ops/SEO", label, exists(p), p, lvl);
for (const r of ["terms", "privacy"]) add("Legal", `/${r} page exists`, pages.some((p) => p.endsWith("/" + r)), "", "FAIL");
add("Legal", "cookie/consent notice", src.some((f) => /cookie/i.test(fs.readFileSync(f, "utf8"))), "Needed if serving EU users with analytics", "WARN");
const lay = read("app/layout.tsx");
add("SEO", "metadataBase + OpenGraph set", /metadataBase/.test(lay) && /openGraph/.test(lay));
add("SEO", "og:image provided", exists("app/opengraph-image.tsx") || exists("app/opengraph-image.png") || /images\s*:/.test(lay), "Link previews will have no image", "WARN");
add("Ops", "monitoring/analytics wired (Sentry/Vercel Analytics/PostHog)", /sentry|@vercel\/analytics|posthog/i.test(read("package.json")), "No error tracking: you won't know when users hit errors", "WARN");
add("Ops", ".env.example documents required variables", exists(".env.example") || exists(".env.local.example"), "", "WARN");

// 6. Payments truthfulness
const terms = read("app/(marketing)/legal/terms/page.tsx");
const stripeLive = /stripe/i.test(read("package.json")) || /stripe\.(checkout|PaymentIntent)/i.test(read("backend/app/routers/billing.py"));
add("Payments", "Stripe/escrow actually integrated (Terms mention escrow)", !(/escrow/i.test(terms) && !stripeLive), "Terms promise escrow but payments are stubbed. Remove the claim or integrate Stripe.");

// 7. A11y (static)
const noLabel = [];
for (const f of src.filter((f) => f.endsWith(".tsx"))) {
  const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/<(?:Button|button)\b([^>]*)>\s*<(\w+)\b[^>]*\/>\s*<\/(?:Button|button)>/g)) if (!/aria-label|title=/.test(m[1])) noLabel.push(rel(f));
  for (const m of t.matchAll(/<img\b([^>]*)>/g)) if (!/alt=/.test(m[1])) noLabel.push(rel(f) + " (img alt)");
}
add("A11y", "icon-only buttons have aria-label; <img> have alt", noLabel.length === 0, `${new Set(noLabel).size} files; first:\n    ` + [...new Set(noLabel)].slice(0, 10).join("\n    "), "WARN");

// 8. Data truthfulness
const mock = read("lib/mock-data.ts");
add("Data", "no fake stats/testimonials left in mock seeds", !/(\$\d{2,3}(\.\d)?k|4\.9\b)/.test(mock), "Check lib/mock-data.ts for invented numbers", "WARN");

// 9. QA assets
add("QA", "browser checks present (crawl + auth guard)", exists("scripts/qa/crawl.mjs") && exists("scripts/qa/authguard.mjs"), "scripts/qa/crawl.mjs, scripts/qa/authguard.mjs", "WARN");
add("QA", "npm run qa script present", /"qa"/.test(read("package.json")));

// Report
const icon = { PASS: "✅", WARN: "🟡", FAIL: "❌" };
let md = `# Gap-check report\n\n| | Area | Check |\n|---|---|---|\n`;
for (const r of results) md += `| ${icon[r.level]} | ${r.area} | ${r.name} |\n`;
md += `\n## Details\n`;
for (const r of results.filter((r) => !r.ok)) md += `\n**${icon[r.level]} ${r.area}: ${r.name}**\n\n    ${r.note}\n`;
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/gapcheck-report.md", md);
for (const r of results) console.log(`${icon[r.level]} [${r.area}] ${r.name}${r.ok ? "" : "\n    " + r.note.split("\n").slice(0, 4).join("\n    ")}`);
const fails = results.filter((r) => r.level === "FAIL").length, warns = results.filter((r) => r.level === "WARN").length;
console.log(`\n${results.length - fails - warns} pass, ${warns} warn, ${fails} fail`);
process.exit(fails ? 1 : 0);
