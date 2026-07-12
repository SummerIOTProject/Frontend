import type {
  DashboardResponse,
  MealAnalysis,
  MealHistoryItem,
  Recommendation,
  TodayMenuResponse,
} from "@/lib/api/types";

export const todayMenu: TodayMenuResponse = {
  date: "2026-07-12",
  restaurant: { id: "rest-green-01", name: "그린테이블 본점", location: "2층 다이닝홀" },
  menus: [
    { id: "menu-rice", name: "현미밥", category: "주식", standardServing: 180, unit: "g" },
    { id: "menu-chicken", name: "허브 닭구이", category: "주찬", standardServing: 120, unit: "g" },
    { id: "menu-salad", name: "계절 채소 샐러드", category: "부찬", standardServing: 90, unit: "g" },
    { id: "menu-soup", name: "들깨 버섯국", category: "국", standardServing: 200, unit: "ml" },
  ],
};

export const recommendations: Recommendation[] = [
  { menuId: "menu-rice", menuName: "현미밥", recommendedAmount: 150, unit: "g", reason: "최근 5회 섭취 경향을 반영한 권장량입니다." },
  { menuId: "menu-chicken", menuName: "허브 닭구이", recommendedAmount: 120, unit: "g", reason: "최근 섭취율이 안정적으로 높았습니다." },
  { menuId: "menu-salad", menuName: "계절 채소 샐러드", recommendedAmount: 70, unit: "g", reason: "최근 남긴 양을 반영해 기준량보다 적게 권장합니다." },
  { menuId: "menu-soup", menuName: "들깨 버섯국", recommendedAmount: 160, unit: "ml", reason: "최근 평균 잔반량을 반영했습니다." },
];

const historyMenus = [
  { menuId: "menu-rice", menuName: "현미밥", intakeRate: 88, recommendedAmount: 150, unit: "g" },
  { menuId: "menu-chicken", menuName: "허브 닭구이", intakeRate: 94, recommendedAmount: 120, unit: "g" },
  { menuId: "menu-salad", menuName: "계절 채소 샐러드", intakeRate: 68, recommendedAmount: 70, unit: "g" },
];

export const historyItems: MealHistoryItem[] = [
  { mealId: "meal-20260711-001", mealDate: "2026-07-11T12:10:00+09:00", restaurantId: "rest-green-01", restaurantName: "그린테이블 본점", menus: historyMenus, averageIntakeRate: 83, averageLeftoverRate: 17, status: "COMPLETED", correctedByUser: false },
  { mealId: "meal-20260710-002", mealDate: "2026-07-10T18:24:00+09:00", restaurantId: "rest-green-01", restaurantName: "그린테이블 본점", menus: [{ menuId: "menu-pasta", menuName: "토마토 펜네", intakeRate: 76, recommendedAmount: 140, unit: "g" }, { menuId: "menu-salad", menuName: "그린 샐러드", intakeRate: 62, recommendedAmount: 65, unit: "g" }], averageIntakeRate: 69, averageLeftoverRate: 31, status: "NEEDS_REVIEW", correctedByUser: true },
  { mealId: "meal-20260709-001", mealDate: "2026-07-09T12:02:00+09:00", restaurantId: "rest-balance-02", restaurantName: "밸런스 키친", menus: [{ menuId: "menu-bibimbap", menuName: "채소 비빔밥", intakeRate: 91, recommendedAmount: 260, unit: "g" }], averageIntakeRate: 91, averageLeftoverRate: 9, status: "COMPLETED", correctedByUser: false },
  { mealId: "meal-20260708-001", mealDate: "2026-07-08T12:18:00+09:00", restaurantId: "rest-green-01", restaurantName: "그린테이블 본점", menus: [{ menuId: "menu-rice", menuName: "잡곡밥", intakeRate: 82, recommendedAmount: 155, unit: "g" }, { menuId: "menu-fish", menuName: "고등어구이", intakeRate: 96, recommendedAmount: 110, unit: "g" }], averageIntakeRate: 89, averageLeftoverRate: 11, status: "COMPLETED", correctedByUser: false },
  { mealId: "meal-20260707-001", mealDate: "2026-07-07T18:08:00+09:00", restaurantId: "rest-balance-02", restaurantName: "밸런스 키친", menus: [{ menuId: "menu-curry", menuName: "병아리콩 카레", intakeRate: 74, recommendedAmount: 220, unit: "g" }], averageIntakeRate: 74, averageLeftoverRate: 26, status: "COMPLETED", correctedByUser: false },
  { mealId: "meal-20260706-001", mealDate: "2026-07-06T12:31:00+09:00", restaurantId: "rest-green-01", restaurantName: "그린테이블 본점", menus: [{ menuId: "menu-noodle", menuName: "메밀국수", intakeRate: 0, recommendedAmount: 180, unit: "g" }], averageIntakeRate: 0, averageLeftoverRate: 0, status: "FAILED", correctedByUser: false },
];

const beforePhoto = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85";
const afterPhoto = "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=85";

const completedAnalysis: MealAnalysis = {
  mealId: "meal-20260711-001",
  status: "COMPLETED",
  mealDate: "2026-07-11T12:10:00+09:00",
  restaurantName: "그린테이블 본점",
  beforeImageUrl: beforePhoto,
  afterImageUrl: afterPhoto,
  analyzedAt: "2026-07-11T12:14:00+09:00",
  correctionAvailable: true,
  menuResults: [
    { menuId: "menu-rice", menuName: "현미밥", standardServing: 180, intakeRate: 88, consumedAmount: 158, leftoverAmount: 22, unit: "g", confidence: 94, recommendedAmount: 150, recommendationReason: "최근 섭취 패턴과 이번 잔반량을 함께 반영했습니다.", correctedByUser: false },
    { menuId: "menu-chicken", menuName: "허브 닭구이", standardServing: 120, intakeRate: 94, consumedAmount: 113, leftoverAmount: 7, unit: "g", confidence: 92, recommendedAmount: 120, recommendationReason: "기준 배식량을 대부분 섭취해 현재 권장량을 유지합니다.", correctedByUser: false },
    { menuId: "menu-salad", menuName: "계절 채소 샐러드", standardServing: 90, intakeRate: 68, consumedAmount: 61, leftoverAmount: 29, unit: "g", confidence: 61, recommendedAmount: 70, recommendationReason: "최근 남긴 양을 반영해 다음 배식량을 조정했습니다.", correctedByUser: false },
  ],
};

export const analyses: Record<string, MealAnalysis> = {
  [completedAnalysis.mealId]: completedAnalysis,
  "meal-20260710-002": { ...completedAnalysis, mealId: "meal-20260710-002", mealDate: "2026-07-10T18:24:00+09:00", status: "NEEDS_REVIEW", menuResults: completedAnalysis.menuResults.map((item, index) => ({ ...item, confidence: index === 1 ? 48 : item.confidence, correctedByUser: index === 1 })) },
  "meal-20260706-001": { mealId: "meal-20260706-001", status: "FAILED", mealDate: "2026-07-06T12:31:00+09:00", restaurantName: "그린테이블 본점", menuResults: [], errorMessage: "사진에서 식판 전체 영역을 확인하지 못했습니다. 같은 위치에서 다시 촬영해 주세요.", correctionAvailable: false },
  "meal-active-001": { ...completedAnalysis, mealId: "meal-active-001", mealDate: "2026-07-12T12:05:00+09:00", status: "ANALYZING", menuResults: [] },
};

for (const meal of historyItems) {
  if (!analyses[meal.mealId]) {
    analyses[meal.mealId] = {
      ...structuredClone(completedAnalysis),
      mealId: meal.mealId,
      mealDate: meal.mealDate,
      restaurantName: meal.restaurantName,
      status: meal.status,
    };
  }
}

export const dashboardData: DashboardResponse = {
  menuContext: todayMenu,
  summary: { recentMealCount: 8, averageIntakeRate: 84, averageLeftoverRate: 16, latestAnalyzedAt: "2026-07-11T12:14:00+09:00" },
  recommendations,
  recentMeals: historyItems.slice(0, 3),
  activeMeal: { mealId: "meal-active-001", status: "ANALYZING", mealDate: "2026-07-12T12:05:00+09:00", restaurantName: "그린테이블 본점" },
};
