import type { Metadata } from "next";
import { MealUploadView } from "@/features/meal-upload/meal-upload-view";

export const metadata: Metadata = { title: "식사 사진 등록" };

export default function MealUploadPage() {
  return <MealUploadView />;
}
