import type {
  AnalysisCorrectionRequest,
  DashboardResponse,
  MealAnalysis,
  MealHistoryFilters,
  MealHistoryResponse,
  MealUploadResponse,
  Recommendation,
  TodayMenuResponse,
} from "@/lib/api/types";
import { analyses, dashboardData, historyItems, recommendations, todayMenu } from "./data";

const pollingCounts = new Map<string, number>();

function wait(ms = 260, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("요청이 취소되었습니다.", "AbortError"));
      },
      { once: true },
    );
  });
}

export const mockApi = {
  async getTodayMenu(): Promise<TodayMenuResponse> {
    await wait();
    return structuredClone(todayMenu);
  },

  async getDashboard(): Promise<DashboardResponse> {
    await wait();
    return structuredClone(dashboardData);
  },

  async getRecommendations(): Promise<Recommendation[]> {
    await wait();
    return structuredClone(recommendations);
  },

  async uploadMeal(options: { onProgress?: (progress: number) => void; signal?: AbortSignal }): Promise<MealUploadResponse> {
    for (const progress of [12, 34, 58, 81, 100]) {
      await wait(180, options.signal);
      options.onProgress?.(progress);
    }
    const mealId = `meal-mock-${Date.now()}`;
    analyses[mealId] = { ...structuredClone(analyses["meal-20260711-001"]), mealId, status: "UPLOAD_COMPLETED", analyzedAt: undefined, menuResults: [] };
    return { mealId, status: "UPLOAD_COMPLETED" };
  },

  async getAnalysis(mealId: string): Promise<MealAnalysis> {
    await wait();
    const analysis = analyses[mealId];
    if (!analysis) throw new Error("식사 기록을 찾을 수 없습니다.");
    if (["UPLOAD_COMPLETED", "QUEUED", "ANALYZING"].includes(analysis.status)) {
      const count = (pollingCounts.get(mealId) ?? 0) + 1;
      pollingCounts.set(mealId, count);
      analysis.status = count === 1 ? "QUEUED" : count === 2 ? "ANALYZING" : "COMPLETED";
      if (analysis.status === "COMPLETED") {
        const result = analyses["meal-20260711-001"];
        analysis.menuResults = structuredClone(result.menuResults);
        analysis.analyzedAt = new Date().toISOString();
      }
    }
    return structuredClone(analysis);
  },

  async correctAnalysis(mealId: string, correction: AnalysisCorrectionRequest): Promise<MealAnalysis> {
    await wait();
    const analysis = analyses[mealId];
    if (!analysis) throw new Error("식사 기록을 찾을 수 없습니다.");
    analysis.status = "COMPLETED";
    analysis.menuResults = analysis.menuResults.map((item) =>
      item.menuId === correction.menuId ? { ...item, intakeRate: correction.intakeRate ?? item.intakeRate, correctedByUser: true } : item,
    );
    return structuredClone(analysis);
  },

  async getHistory(filters: MealHistoryFilters): Promise<MealHistoryResponse> {
    await wait();
    const pageSize = filters.pageSize ?? 4;
    const page = filters.page ?? 1;
    const search = filters.search?.trim().toLocaleLowerCase("ko") ?? "";
    const filtered = historyItems.filter((item) => {
      const restaurantMatches = !filters.restaurantId || item.restaurantId === filters.restaurantId;
      const statusMatches = !filters.status || filters.status === "ALL" || item.status === filters.status;
      const menuMatches = !search || item.menus.some((menu) => menu.menuName.toLocaleLowerCase("ko").includes(search));
      return restaurantMatches && statusMatches && menuMatches;
    });
    const start = (page - 1) * pageSize;
    return {
      items: structuredClone(filtered.slice(start, start + pageSize)),
      page,
      pageSize,
      total: filtered.length,
      hasNext: start + pageSize < filtered.length,
      aggregate: {
        averageIntakeRate: 81,
        averageLeftoverRate: 19,
        menuStats: [
          { menuId: "menu-rice", menuName: "밥류", intakeRate: 86, recommendedAmount: 155, unit: "g" },
          { menuId: "menu-protein", menuName: "단백질 반찬", intakeRate: 92, recommendedAmount: 115, unit: "g" },
          { menuId: "menu-vegetable", menuName: "채소 반찬", intakeRate: 67, recommendedAmount: 70, unit: "g" },
        ],
      },
      restaurants: [
        { id: "rest-green-01", name: "그린테이블 본점" },
        { id: "rest-balance-02", name: "밸런스 키친" },
      ],
    };
  },
};

export function resetMockPolling() {
  pollingCounts.clear();
}
