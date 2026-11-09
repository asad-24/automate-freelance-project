"use client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { adminNav } from "@/components/dashboard/nav-config";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell nav={adminNav} roleLabel="Administrator">
      {children}
    </DashboardShell>
  );
}
