import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  Bot,
  Briefcase,
  Gavel,
  Megaphone,
  Users,
  FileText,
  ListChecks,
  Network,
  UsersRound,
  MessagesSquare,
  Mic,
  ShieldCheck,
  CreditCard,
  BarChart3,
  TrendingUp,
  Settings,
  Plug,
  ScrollText,
  Bell,
  UserCog,
  User,
  FileCheck2,
  Wallet,
  DollarSign,
  FolderKanban,
  Files,
  Receipt,
  Command,
  UserPlus,
  ClipboardCheck,
  Rocket,
  Radar,
  Gift,
  CalendarDays,
  Zap,
  CircleDollarSign,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string; soon?: boolean };
export type NavSection = {
  title: string;
  items: NavItem[];
  /** Render as a collapsible group (used for the "Advanced" power-user menu). */
  collapsible?: boolean;
  /** Initial open state when collapsible. Defaults to collapsed. */
  defaultOpen?: boolean;
};

/**
 * Pages that only show the shared demo dataset. The backend doesn't serve that
 * data to real accounts (see backend/app/main.py), so outside the
 * frontend-only demo these pages show "Coming soon".
 */
export const DEMO_ONLY_ROUTES = [
  "/dashboard/agents", "/dashboard/arbitrage", "/dashboard/margins", "/dashboard/hitl",
  "/dashboard/personas", "/dashboard/portfolio", "/dashboard/security", "/dashboard/users",
  "/dashboard/analytics", "/dashboard/onboarding",
  "/dashboard/job-hunter", "/dashboard/marketing",
];

export const isDemoOnlyRoute = (path: string) =>
  DEMO_ONLY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

export const adminNav: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard/command", label: "Dashboard", icon: Command },
      { href: "/dashboard/job-radar", label: "Job Radar", icon: Radar },
      { href: "/dashboard/gigs", label: "Gigs", icon: Briefcase },
      { href: "/dashboard/agents", label: "Agent Fleet", icon: Bot },
      { href: "/dashboard/automation", label: "Automation", icon: Zap },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/dashboard/accounts", label: "Accounts & Gigs", icon: Plug },
      { href: "/dashboard/money", label: "Money", icon: DollarSign },
    ],
  },
  {
    title: "Capital",
    items: [
      { href: "/dashboard/funding", label: "Project Funding", icon: CircleDollarSign },
      { href: "/dashboard/protection", label: "Project Protection", icon: ShieldCheck },
      { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
      { href: "/dashboard/wallet", label: "Wallet & Token", icon: Wallet },
    ],
  },
  {
    title: "Grow",
    items: [
      { href: "/dashboard/refer", label: "Refer & Extend", icon: Gift },
      { href: "/dashboard/growth", label: "Outreach", icon: Megaphone },
      { href: "/dashboard/onboarding", label: "Client Onboarding", icon: UserPlus },
    ],
  },
  {
    title: "Advanced",
    collapsible: true,
    items: [
      { href: "/dashboard/profile", label: "My Profile", icon: User },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/users", label: "Team & Invites", icon: UserCog },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/security", label: "Security & API", icon: ShieldCheck },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/dashboard/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export const freelancerNav: NavSection[] = [
  {
    title: "Capital",
    items: [
      { href: "/freelancer/funding", label: "Project Funding", icon: CircleDollarSign },
      { href: "/freelancer/protection", label: "Project Protection", icon: ShieldCheck },
      { href: "/freelancer/investments", label: "Investments", icon: TrendingUp },
      { href: "/freelancer/wallet", label: "Wallet & Token", icon: Wallet },
    ],
  },

  {
    title: "Work",
    items: [
      { href: "/freelancer", label: "Dashboard", icon: LayoutDashboard },
      { href: "/freelancer/specs", label: "Open Specs", icon: Gavel },
      { href: "/freelancer/bids", label: "My Bids", icon: FileText },
      { href: "/freelancer/contracts", label: "My Contracts", icon: FolderKanban },
      { href: "/freelancer/qa", label: "QA & Submissions", icon: FileCheck2 },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/freelancer/messages", label: "Messages", icon: MessagesSquare },
      { href: "/freelancer/earnings", label: "Earnings", icon: Wallet },
      { href: "/freelancer/billing", label: "Billing & Plan", icon: CreditCard },
      { href: "/freelancer/profile", label: "My Profile", icon: User },
    ],
  },
];

export const clientNav: NavSection[] = [
  {
    title: "Capital",
    items: [
      { href: "/client/investments", label: "Investments", icon: TrendingUp },
      { href: "/client/wallet", label: "Wallet & Token", icon: Wallet },
    ],
  },
  {
    title: "Portal",
    items: [
      { href: "/client", label: "Dashboard", icon: LayoutDashboard },
      { href: "/client/projects", label: "Projects", icon: FolderKanban },
      { href: "/client/milestones", label: "Milestones", icon: ListChecks },
      { href: "/client/files", label: "Files", icon: Files },
      { href: "/client/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/client/messages", label: "Messages", icon: MessagesSquare },
      { href: "/client/billing", label: "Billing & Plan", icon: CreditCard },
      { href: "/client/profile", label: "My Profile", icon: User },
    ],
  },
];
