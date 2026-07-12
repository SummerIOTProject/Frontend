export const endpoints = {
  todayMenus: "/menus/today",
  dashboard: "/dashboard",
  meals: "/meals",
  meal: (mealId: string) => `/meals/${encodeURIComponent(mealId)}`,
  mealAnalysis: (mealId: string) => `/meals/${encodeURIComponent(mealId)}/analysis`,
  mealHistory: "/meals/history",
  recommendations: "/recommendations",
} as const;
