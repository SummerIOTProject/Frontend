import { mockApi } from "@/mocks/server";
import { apiRequest, useMockApi } from "./client";
import { endpoints } from "./endpoints";
import type { TodayMenuResponse } from "./types";

export function getTodayMenu(): Promise<TodayMenuResponse> {
  return useMockApi ? mockApi.getTodayMenu() : apiRequest<TodayMenuResponse>(endpoints.todayMenus);
}
