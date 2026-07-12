import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "대시보드" };

export default function DashboardPage() {
  return <DashboardView />;
}
