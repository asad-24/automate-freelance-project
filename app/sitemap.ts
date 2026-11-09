import type { MetadataRoute } from "next";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://autopilotv2.vercel.app";
const PATHS = ["", "/pricing", "/services", "/portfolio", "/about", "/contact", "/beta", "/signup", "/login", "/legal/terms", "/legal/privacy", "/legal/ai-disclosure"];
export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: `${SITE}${p}`, lastModified: new Date() }));
}
