import { mockApi } from "@/mocks/server";
import { apiRequest, useMockApi } from "./client";
import { endpoints } from "./endpoints";
import type { Recommendation } from "./types";

export function getRecommendations(): Promise<Recommendation[]> {
  return useMockApi ? mockApi.getRecommendations() : apiRequest<Recommendation[]>(endpoints.recommendations);
}
