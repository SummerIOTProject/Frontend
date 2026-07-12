import { mockApi } from "@/mocks/server";
import { apiRequest, useMockApi } from "./client";
import { endpoints } from "./endpoints";
import type { DashboardResponse } from "./types";

export function getDashboard(): Promise<DashboardResponse> {
  return useMockApi ? mockApi.getDashboard() : apiRequest<DashboardResponse>(endpoints.dashboard);
}
