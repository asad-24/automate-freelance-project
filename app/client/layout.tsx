"use client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { clientNav } from "@/components/dashboard/nav-config";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell nav={clientNav} roleLabel="Client">
      {children}
    </DashboardShell>
  );
}
