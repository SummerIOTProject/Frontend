import type { Metadata } from "next";
import { MealAnalysisView } from "@/features/meal-analysis/meal-analysis-view";

export const metadata: Metadata = { title: "식사 분석" };

export default async function MealAnalysisPage({ params }: { params: Promise<{ mealId: string }> }) {
  const { mealId } = await params;
  return <MealAnalysisView mealId={mealId} />;
}
