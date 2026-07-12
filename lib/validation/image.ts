import { z } from "zod";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "JPG, JPEG, PNG, WebP 파일만 등록할 수 있습니다.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "사진은 한 장당 10MB 이하여야 합니다.";
  }
  return null;
}

export const mealUploadFieldsSchema = z.object({
  mealDate: z.string().min(1, "식사 날짜를 선택해 주세요."),
  restaurantId: z.string().min(1, "식당을 확인해 주세요."),
});

export type MealUploadFields = z.infer<typeof mealUploadFieldsSchema>;
