"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Gift,
  LogOut,
  Menu,
  Search,
  ShieldOff,
  ShieldCheck,
  User,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/lib/demo-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth, dashboardHomeFor, SIGNUP_WALL, type Role } from "@/lib/auth";
import { useAppMode } from "@/lib/app-mode";
import { notifications as notificationsSeed } from "@/lib/mock-data";
import { useEntity } from "@/lib/use-entity";
import { EmptyState } from "@/components/shared/empty-state";
import { isDemoOnlyRoute, type NavSection } from "./nav-config";

export function DashboardShell({
  nav: navItems,
  roleLabel,
  children,
}: {
  nav: NavSection[];
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, restored, logout, setRole, demoMode } = useAuth();
  // Demo-data pages stay visible as a roadmap but are marked "Soon".
  const nav = React.useMemo(
    () => demoMode ? navItems : navItems.map((section) => ({
      ...section,
      items: section.items.map((item) => (isDemoOnlyRoute(item.href) ? { ...item, soon: true } : item)),
    })),
    [navItems, demoMode]
  );
  const comingSoon = !demoMode && isDemoOnlyRoute(pathname);

  // Every API request reports whether the server answered (lib/api.ts).
  const [serverDown, setServerDown] = React.useState(false);
  React.useEffect(() => {
    const onStatus = (e: Event) => setServerDown(!(e as CustomEvent<{ ok: boolean }>).detail.ok);
    window.addEventListener("api:status", onStatus);
    return () => window.removeEventListener("api:status", onStatus);
  }, []);
  const { mode, toggle } = useAppMode();
  const demo = useDemoStore();
  const [open, setOpen] = React.useState(false);

  // Auth guard — when the dev bypass is off (NEXT_PUBLIC_DEV_BYPASS_AUTH=false),
  // unauthenticated visitors are sent to signup (launch wall) or login.
  // `restored` prevents a race where a valid stored session gets redirected
  // before AuthProvider finishes reading localStorage.
  React.useEffect(() => {
    if (restored && user === null) router.replace(SIGNUP_WALL ? "/signup" : "/login");
  }, [restored, user, router]);
  const notifications = useEntity("notifications", notificationsSeed);
  const unread = notifications.filter((n: any) => !n.read).length;
  const isPro = demo?.state.monetization?.plan === "pro";
  const bidCredits = demo?.state.monetization?.bidCredits ?? 0;
  const growth = demo?.state.growth;
  const trialLeft = growth ? Math.max(0, Math.ceil(growth.trialDays - (Date.now() - Date.parse(growth.trialStartedAt)) / 86400000)) : 0;

  const switchRole = (r: Role) => {
    setRole(r);
    router.push(dashboardHomeFor(r));
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
            <Bot className="size-4" />
          </span>
          Autopilot
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-4">
        {nav.map((section: any) => (
          <NavGroup
            key={section.title}
            section={section}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>
    </div>
  );

  // Compact icon rail — desktop. Radically slimmer than the old labeled sidebar.
  const IconRail = (
    <div className="flex h-full flex-col items-center py-3">
      <Link href="/" title="Autopilot" className="mb-2">
        <span className="glow-primary flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white">
          <Bot className="size-5" />
        </span>
      </Link>
      <nav className="mt-2 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {nav.map((section, si) => (
          <div key={section.title} className="flex flex-col items-center gap-1">
            {si > 0 && <div className="my-2 h-px w-6 bg-border" />}
            {section.items.map((item: any) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.soon ? `${item.label} (coming soon)` : item.label}
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-xl transition-all",
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    item.soon && !active && "opacity-50"
                  )}
                >
                  <item.icon className="size-[18px]" />
                  {item.badge && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                  {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="aurora flex h-screen overflow-hidden bg-background">
      {/* Desktop icon rail */}
      <aside className="hidden w-[68px] shrink-0 border-r border-border/60 bg-card/50 backdrop-blur-xl lg:block">{IconRail}</aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card shadow-xl">
            <button className="absolute right-3 top-4 z-10" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar — floating glass */}
        <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card/50 px-4 backdrop-blur-xl">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-5" />
          </button>

          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search jobs, clients, freelancers..." className="pl-9" />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Trial countdown */}
            {roleLabel === "Administrator" && !isPro && growth && trialLeft > 0 && (
              <Link href="/dashboard/refer" className="hidden md:block">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("gap-1.5", trialLeft <= 1 && "border-destructive/50 text-destructive")}
                  title="Trial — share or refer to extend to 7 days"
                >
                  <Gift className="size-4" />
                  {trialLeft}d trial
                </Button>
              </Link>
            )}

            {/* Plan / credits */}
            {roleLabel === "Administrator" && (
              <Link href="/dashboard/money" className="hidden md:block">
                <Button
                  variant={isPro ? "default" : "outline"}
                  size="sm"
                  className={cn("gap-1.5", !isPro && bidCredits <= 3 && "border-destructive/50 text-destructive")}
                  title="Plan & credits"
                >
                  <Zap className="size-4" />
                  {isPro ? "Pro" : `${bidCredits} bids left`}
                </Button>
              </Link>
            )}

            {/* Mode switch */}
            <Button
              variant={mode === "stealth" ? "destructive" : "outline"}
              size="sm"
              onClick={toggle}
              className="hidden sm:inline-flex"
              title="Toggle Stealth / Compliance mode"
            >
              {mode === "stealth" ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
              {mode === "stealth" ? "Stealth" : "Compliance"}
            </Button>

            <ThemeToggle />

            {/* Notifications */}
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Button>
              }
              className="w-80"
            >
              <DropdownLabel>Notifications</DropdownLabel>
              {notifications.slice(0, 4).map((n: any) => (
                <DropdownItem key={n.id} className="flex-col items-start">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.body}</span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <Link href="/dashboard/notifications">
                <DropdownItem className="justify-center text-primary">View all</DropdownItem>
              </Link>
            </Dropdown>

            {/* User menu */}
            <Dropdown
              trigger={
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
                  <Avatar name={user?.name ?? "User"} size={32} />
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-tight">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              }
              className="w-56"
            >
              <DropdownLabel>{user?.email}</DropdownLabel>
              <DropdownSeparator />
              {demoMode && (
                <>
                  <DropdownLabel>Switch role (demo)</DropdownLabel>
                  <DropdownItem onClick={() => switchRole("admin")}>Admin Dashboard</DropdownItem>
                  <DropdownItem onClick={() => switchRole("freelancer")}>Freelancer Dashboard</DropdownItem>
                  <DropdownItem onClick={() => switchRole("client")}>Client Portal</DropdownItem>
                  <DropdownSeparator />
                </>
              )}
              <Link href={`${basePath(pathname)}/profile`}>
                <DropdownItem>
                  <User className="size-4" /> My Profile
                </DropdownItem>
              </Link>
              <DropdownItem onClick={() => { logout(); router.push("/login"); }}>
                <LogOut className="size-4" /> Log out
              </DropdownItem>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {serverDown && !demoMode && (
            <div role="alert" className="mx-auto mb-4 flex max-w-7xl items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              Can&apos;t reach the server — some data may be missing or out of date, and changes you make now may not be saved.
            </div>
          )}
          <div className="mx-auto max-w-7xl animate-fade-in">
            {comingSoon ? (
              <EmptyState
                title="Coming soon"
                description="This area runs on demo data today. It'll open up once it works with your own accounts and data."
                action={<Button variant="outline" onClick={() => router.push("/dashboard/command")}>Back to dashboard</Button>}
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function basePath(pathname: string) {
  if (pathname.startsWith("/freelancer")) return "/freelancer";
  if (pathname.startsWith("/client")) return "/client";
  return "/dashboard";
}

function NavGroup({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate: () => void;
}) {
  const hasActive = section.items.some((i: any) => pathname === i.href);
  const [open, setOpen] = React.useState(section.defaultOpen ?? hasActive ?? false);

  const Items = (
    <div className="space-y-1">
      {section.items.map((item: any) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.soon && (
              <Badge variant="secondary" className="h-5 px-1.5">Soon</Badge>
            )}
            {item.badge && (
              <Badge variant={active ? "secondary" : "destructive"} className="h-5 px-1.5">
                {item.badge}
              </Badge>
            )}
          </Link>
        );
      })}
    </div>
  );

  if (section.collapsible) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="mb-1 flex w-full items-center gap-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          {section.title}
        </button>
        {open && Items}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {section.title}
      </p>
      {Items}
    </div>
  );
}
