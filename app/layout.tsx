import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://autopilotv2.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c10" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Autopilot — AI Client-Finding Engine for Freelancers",
  description:
    "Find clients, send better proposals, and run your freelance business in one workspace. AI scans and drafts — you approve every send.",
  openGraph: {
    type: "website",
    siteName: "Autopilot",
    title: "Autopilot — AI Client-Finding Engine for Freelancers",
    description: "Find clients, send better proposals, and run your freelance business in one workspace.",
  },
  twitter: { card: "summary_large_image", title: "Autopilot", description: "AI finds the clients. You approve every send." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
