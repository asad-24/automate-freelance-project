"use client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { freelancerNav } from "@/components/dashboard/nav-config";

export default function FreelancerLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell nav={freelancerNav} roleLabel="Freelancer">
      {children}
    </DashboardShell>
  );
}
