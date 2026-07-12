import { mockApi } from "@/mocks/server";
import { apiRequest, uploadMultipart, useMockApi } from "./client";
import { endpoints } from "./endpoints";
import type {
  AnalysisCorrectionRequest,
  MealAnalysis,
  MealHistoryFilters,
  MealHistoryResponse,
  MealUploadRequest,
  MealUploadResponse,
} from "./types";

export function buildMealFormData(request: MealUploadRequest): FormData {
  const data = new FormData();
  data.append("userId", request.userId);
  data.append("restaurantId", request.restaurantId);
  data.append("mealDate", request.mealDate);
  request.menuIds.forEach((menuId) => data.append("menuIds", menuId));
  data.append("beforeImage", request.beforeImage);
  data.append("afterImage", request.afterImage);
  return data;
}

export function uploadMeal(
  request: MealUploadRequest,
  options: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
): Promise<MealUploadResponse> {
  const formData = buildMealFormData(request);
  return useMockApi ? mockApi.uploadMeal(options) : uploadMultipart<MealUploadResponse>(endpoints.meals, formData, options);
}

export function getMeal(mealId: string): Promise<MealAnalysis> {
  return useMockApi ? mockApi.getAnalysis(mealId) : apiRequest<MealAnalysis>(endpoints.meal(mealId));
}

export function getMealAnalysis(mealId: string): Promise<MealAnalysis> {
  return useMockApi ? mockApi.getAnalysis(mealId) : apiRequest<MealAnalysis>(endpoints.mealAnalysis(mealId));
}

export function correctMealAnalysis(mealId: string, correction: AnalysisCorrectionRequest): Promise<MealAnalysis> {
  return useMockApi
    ? mockApi.correctAnalysis(mealId, correction)
    : apiRequest<MealAnalysis>(endpoints.mealAnalysis(mealId), { method: "PATCH", body: JSON.stringify(correction) });
}

export function getMealHistory(filters: MealHistoryFilters): Promise<MealHistoryResponse> {
  if (useMockApi) return mockApi.getHistory(filters);
  const params = new URLSearchParams();
  if (filters.restaurantId) params.set("restaurantId", filters.restaurantId);
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 10));
  return apiRequest<MealHistoryResponse>(`${endpoints.mealHistory}?${params}`);
}
