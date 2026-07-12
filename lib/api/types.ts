export type MealStatus =
  | "UPLOADING"
  | "UPLOAD_COMPLETED"
  | "QUEUED"
  | "ANALYZING"
  | "COMPLETED"
  | "NEEDS_REVIEW"
  | "FAILED";

export interface Restaurant {
  id: string;
  name: string;
  location?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  standardServing: number;
  unit: string;
}

export interface TodayMenuResponse {
  date: string;
  restaurant: Restaurant;
  menus: MenuItem[];
}

export interface MealUploadRequest {
  userId: string;
  restaurantId: string;
  mealDate: string;
  menuIds: string[];
  beforeImage: File;
  afterImage: File;
}

export interface MealUploadResponse {
  mealId: string;
  status: MealStatus;
}

export interface MenuAnalysisResult {
  menuId: string;
  menuName: string;
  standardServing: number;
  intakeRate: number;
  consumedAmount: number;
  leftoverAmount: number;
  unit: string;
  confidence: number;
  recommendedAmount: number;
  recommendationReason: string;
  correctedByUser: boolean;
}

export interface MealAnalysis {
  mealId: string;
  status: MealStatus;
  mealDate: string;
  restaurantName: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  menuResults: MenuAnalysisResult[];
  analyzedAt?: string;
  errorMessage?: string;
  correctionAvailable?: boolean;
}

export interface MealHistoryMenu {
  menuId: string;
  menuName: string;
  intakeRate: number;
  recommendedAmount: number;
  unit: string;
}

export interface MealHistoryItem {
  mealId: string;
  mealDate: string;
  restaurantId: string;
  restaurantName: string;
  menus: MealHistoryMenu[];
  averageIntakeRate: number;
  averageLeftoverRate: number;
  status: MealStatus;
  correctedByUser: boolean;
}

export interface Recommendation {
  menuId: string;
  menuName: string;
  recommendedAmount: number;
  unit: string;
  reason: string;
}

export interface DashboardResponse {
  menuContext: TodayMenuResponse;
  summary: {
    recentMealCount: number;
    averageIntakeRate: number;
    averageLeftoverRate: number;
    latestAnalyzedAt?: string;
  };
  recommendations: Recommendation[];
  recentMeals: MealHistoryItem[];
  activeMeal?: Pick<MealAnalysis, "mealId" | "status" | "mealDate" | "restaurantName">;
}

export interface MealHistoryResponse {
  items: MealHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  aggregate: {
    averageIntakeRate: number;
    averageLeftoverRate: number;
    menuStats: Array<{
      menuId: string;
      menuName: string;
      intakeRate: number;
      recommendedAmount: number;
      unit: string;
    }>;
  };
  restaurants: Restaurant[];
}

export interface MealHistoryFilters {
  restaurantId?: string;
  search?: string;
  status?: MealStatus | "ALL";
  page?: number;
  pageSize?: number;
}

export type IntakePreset = "ALMOST_NONE" | "HALF" | "MOST" | "ALL" | "CUSTOM";

export interface AnalysisCorrectionRequest {
  menuId: string;
  preset: IntakePreset;
  intakeRate?: number;
}
