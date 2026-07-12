import type { Metadata } from "next";
import { MealHistoryView } from "@/features/meal-history/meal-history-view";

export const metadata: Metadata = { title: "식사 기록" };

export default function HistoryPage() {
  return <MealHistoryView />;
}
