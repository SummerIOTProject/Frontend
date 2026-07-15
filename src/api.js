const API_PREFIX = "/api/v1";

export const endpoints = {
  health: "/health",
  signup: `${API_PREFIX}/auth/signup`,
  login: `${API_PREFIX}/auth/login`,
  refresh: `${API_PREFIX}/auth/refresh`,
  logout: `${API_PREFIX}/auth/logout`,
  changePassword: `${API_PREFIX}/auth/password`,
  me: `${API_PREFIX}/me`,
  allergens: `${API_PREFIX}/allergens`,
  myAllergens: `${API_PREFIX}/me/allergens`,
  myRfidCards: `${API_PREFIX}/me/rfid-cards`,
  deactivateMyRfidCard: (cardId) => `${API_PREFIX}/me/rfid-cards/${encodeURIComponent(cardId)}/deactivate`,
  deviceRfidScan: `${API_PREFIX}/device/rfid/scan`,
  menus: `${API_PREFIX}/menus`,
  menu: (menuId) => `${API_PREFIX}/menus/${encodeURIComponent(menuId)}`,
  adminMenus: `${API_PREFIX}/admin/menus`,
  adminMenu: (menuId) => `${API_PREFIX}/admin/menus/${encodeURIComponent(menuId)}`,
  adminMeals: `${API_PREFIX}/admin/meals`,
  todayMeal: `${API_PREFIX}/meals/today`,
  meal: (mealId) => `${API_PREFIX}/meals/${encodeURIComponent(mealId)}`,
  mealRecords: `${API_PREFIX}/me/meal-records`,
  recentMealRecords: `${API_PREFIX}/me/meal-records/recent`,
  mealRecord: (recordId) => `${API_PREFIX}/me/meal-records/${encodeURIComponent(recordId)}`,
  deviceMealRecords: `${API_PREFIX}/device/meal-records`,
  mealRecordImage: (recordId, imageType) => `${API_PREFIX}/me/meal-records/${encodeURIComponent(recordId)}/images/${String(imageType).toLowerCase()}`,
  mealRecordImages: (recordId) => `${API_PREFIX}/me/meal-records/${encodeURIComponent(recordId)}/images`,
  analyzeMealRecord: (recordId) => `${API_PREFIX}/me/meal-records/${encodeURIComponent(recordId)}/analyze`,
  reanalyzeMealRecord: (recordId) => `${API_PREFIX}/me/meal-records/${encodeURIComponent(recordId)}/reanalyze`,
  consumedRatio: (itemRecordId) => `${API_PREFIX}/me/meal-item-records/${encodeURIComponent(itemRecordId)}/consumed-ratio`,
  recommendations: `${API_PREFIX}/me/recommendations`,
  adminUsers: `${API_PREFIX}/admin/users`,
  adminDashboard: `${API_PREFIX}/admin/dashboard`,
  leftoverSummary: `${API_PREFIX}/admin/leftover-summary`,
};

const DEFAULT_BACKEND_ORIGIN = "https://backend-five-kohl-41.vercel.app";
const configuredBackendOrigin = import.meta.env.VITE_BACKEND_ORIGIN?.trim();

const ALLERGEN_NAMES = Object.freeze({
  EGGS: "난류",
  MILK: "우유",
  BUCKWHEAT: "메밀",
  PEANUT: "땅콩",
  SOYBEAN: "대두",
  WHEAT: "밀",
  MACKEREL: "고등어",
  CRAB: "게",
  SHRIMP: "새우",
  PORK: "돼지고기",
  PEACH: "복숭아",
  TOMATO: "토마토",
  SULFITES: "아황산류",
  WALNUT: "호두",
  CHICKEN: "닭고기",
  BEEF: "쇠고기",
  SQUID: "오징어",
  SHELLFISH: "조개류",
  PINE_NUT: "잣",
});

export const BACKEND_ORIGIN = (
  import.meta.env.PROD ? DEFAULT_BACKEND_ORIGIN : configuredBackendOrigin || DEFAULT_BACKEND_ORIGIN
).replace(/\/$/, "");
export const API_BASE_URL = BACKEND_ORIGIN;
const baseUrl = API_BASE_URL;
const AUTH_KEY = "smartMealAuth";
const shouldLog = import.meta.env.MODE !== "test";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg"];
export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

function apiLog(event, details) {
  if (!shouldLog) return;
  if (details === undefined) console.log(`[API] ${event}`);
  else console.log(`[API] ${event}`, details);
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR", detail = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validateMealImage(file) {
  if (!file || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "JPG 파일만 등록할 수 있습니다.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "사진은 한 장당 4MB 이하여야 합니다.";
  }
  return null;
}

export function buildMealImageFormData(file) {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function getStoredAuth() {
  return readStorage(AUTH_KEY, null);
}

export function clearAuth() {
  apiLog("인증 정보 삭제");
  try {
    globalThis.localStorage?.removeItem(AUTH_KEY);
  } catch {
    // 브라우저 저장소가 차단되어도 현재 요청의 오류 처리는 계속합니다.
  }
}

export function hasSession() {
  return Boolean(getStoredAuth()?.accessToken);
}

function saveAuth(auth) {
  writeStorage(AUTH_KEY, auth);
  return auth;
}

export async function requestApi(path, options = {}, fetchImpl = globalThis.fetch) {
  const {
    auth = true,
    retryOnUnauthorized = true,
    headers: providedHeaders,
    ...fetchOptions
  } = options;
  const headers = new Headers(providedHeaders || {});
  headers.set("Accept", "application/json");
  const accessToken = getStoredAuth()?.accessToken;
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const method = fetchOptions.method || "GET";
  apiLog("요청 시작", { method, path, authenticated: Boolean(auth && accessToken) });

  let response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, { ...fetchOptions, headers });
  } catch {
    apiLog("네트워크 오류", { method, path });
    throw new ApiError("서버에 연결할 수 없습니다.", { code: "NETWORK_ERROR" });
  }
  apiLog("응답 수신", { method, path, status: response.status });

  if (response.status === 401 && auth && retryOnUnauthorized && getStoredAuth()?.refreshToken) {
    apiLog("Access Token 만료, 갱신 시도", { path });
    await refreshAccessToken(fetchImpl);
    return requestApi(path, { ...options, retryOnUnauthorized: false }, fetchImpl);
  }

  const payload = response.status === 204 ? { success: true, data: null } : await readResponse(response);
  if (!response.ok || payload?.success === false) {
    apiLog("요청 실패", { method, path, status: response.status, code: payload?.error?.code || "API_ERROR" });
    throw new ApiError(payload?.message || `API 요청에 실패했습니다. (${response.status})`, {
      status: response.status,
      code: payload?.error?.code || "API_ERROR",
      detail: payload?.error?.detail || "",
    });
  }
  apiLog("요청 완료", { method, path });
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

async function refreshAccessToken(fetchImpl) {
  const current = getStoredAuth();
  if (!current?.refreshToken) throw new ApiError("로그인이 필요합니다.", { code: "AUTH_REQUIRED" });
  try {
    const data = await requestApi(endpoints.refresh, jsonOptions("POST", {
      refresh_token: current.refreshToken,
    }, { auth: false, retryOnUnauthorized: false }), fetchImpl);
    saveAuth({
      ...current,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || current.refreshToken,
      tokenType: data.token_type,
      accessTokenExpiresIn: data.access_token_expires_in,
      refreshTokenExpiresInDays: data.refresh_token_expires_in_days,
    });
    apiLog("Access Token 갱신 완료");
  } catch (error) {
    apiLog("Access Token 갱신 실패", { code: error.code || "UNKNOWN" });
    clearAuth();
    throw error;
  }
}

async function readResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new ApiError("서버 응답 형식을 확인할 수 없습니다.", {
      status: response.status,
      code: "INVALID_RESPONSE",
    });
  }
}

function jsonOptions(method, body, extra = {}) {
  return {
    ...extra,
    method,
    headers: { "Content-Type": "application/json", ...extra.headers },
    body: JSON.stringify(body),
  };
}

export function isTerminalStatus(status) {
  return ["COMPLETED", "FAILED"].includes(status);
}

export function buildMenuCreatePayload(menu) {
  return {
    name: menu.name,
    standard_serving_g: menu.standardServingG,
    nutrition_per_100g: {
      calories_kcal: menu.nutrition.caloriesKcal,
      carbohydrate_g: menu.nutrition.carbohydrateG,
      protein_g: menu.nutrition.proteinG,
      fat_g: menu.nutrition.fatG,
    },
    ingredients: menu.ingredients,
    allergen_codes: menu.allergenCodes || [],
  };
}

export function buildMenuUpdatePayload(menu) {
  return buildMenuCreatePayload(menu);
}

export function buildAdminMealPayload(meal) {
  return {
    meal_date: meal.mealDate,
    meal_type: "LUNCH",
    school_name: meal.schoolName.trim(),
    menu_ids: meal.menuIds.map(Number),
  };
}

export const api = {
  hasSession,

  health() {
    return requestApi(endpoints.health, { auth: false });
  },

  signup({ loginId, password, name, studentNumber, allergenCodes = [] }) {
    return requestApi(endpoints.signup, jsonOptions("POST", {
      login_id: loginId,
      password,
      name,
      student_number: studentNumber,
      allergen_codes: allergenCodes,
    }, { auth: false })).then(adaptUser);
  },

  updateCurrentUser({ name, loginId }) {
    return requestApi(endpoints.me, jsonOptions("PATCH", {
      ...(name !== undefined ? { name } : {}),
      ...(loginId !== undefined ? { login_id: loginId } : {}),
    })).then(adaptUser);
  },

  changePassword({ currentPassword, newPassword }) {
    return requestApi(endpoints.changePassword, jsonOptions("PATCH", {
      current_password: currentPassword,
      new_password: newPassword,
    }));
  },

  async getMyAllergens() {
    const data = await requestApi(endpoints.myAllergens);
    return (data.items || []).map(adaptAllergen);
  },

  async updateMyAllergens(allergenCodes) {
    const data = await requestApi(endpoints.myAllergens, jsonOptions("PUT", {
      allergen_codes: allergenCodes,
    }));
    return (data.items || []).map(adaptAllergen);
  },

  async createMyRfidCard(uid) {
    return adaptRfidCard(await requestApi(endpoints.myRfidCards, jsonOptions("POST", { uid })));
  },

  async getMyRfidCards() {
    const data = await requestApi(endpoints.myRfidCards);
    return (Array.isArray(data) ? data : []).map(adaptRfidCard);
  },

  async deactivateMyRfidCard(cardId) {
    return adaptRfidCard(await requestApi(endpoints.deactivateMyRfidCard(cardId), { method: "PATCH" }));
  },

  async login({ loginId, password }) {
    apiLog("로그인", { loginId });
    const data = await requestApi(endpoints.login, jsonOptions("POST", {
      login_id: loginId,
      password,
    }, { auth: false }));
    const auth = saveAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      accessTokenExpiresIn: data.access_token_expires_in,
      refreshTokenExpiresInDays: data.refresh_token_expires_in_days,
    });
    apiLog("로그인 토큰 저장 완료", { loginId });
    return auth;
  },

  async logout() {
    apiLog("로그아웃");
    const refreshToken = getStoredAuth()?.refreshToken;
    try {
      if (refreshToken) {
        await requestApi(endpoints.logout, jsonOptions("POST", {
          refresh_token: refreshToken,
        }));
      }
    } finally {
      clearAuth();
    }
  },

  async getCurrentUser() {
    apiLog("현재 사용자 조회");
    return adaptUser(await requestApi(endpoints.me));
  },

  async getAllergens() {
    apiLog("알레르기 목록 조회");
    const data = await requestApi(endpoints.allergens, { auth: false });
    return (Array.isArray(data) ? data : []).map(adaptAllergen);
  },

  async getTodayMeal(mealType = "LUNCH") {
    apiLog("오늘 급식 조회", { mealType });
    const data = await requestApi(`${endpoints.todayMeal}${buildQuery({ meal_type: mealType })}`, { auth: false });
    const meals = Array.isArray(data?.items) ? data.items : data ? [data] : [];
    const meal = meals.find((item) => item.meal_type === mealType);
    if (!meal) {
      throw new ApiError(`오늘 ${mealType === "LUNCH" ? "점심" : "급식"} 정보가 없습니다.`, {
        status: 404,
        code: "MEAL_NOT_FOUND",
      });
    }
    return adaptMeal(meal);
  },

  async getMealForDate(date, mealType = "LUNCH") {
    apiLog("날짜별 급식 조회", { date, mealType });
    const data = await requestApi(`${endpoints.todayMeal}${buildQuery({ date, meal_type: mealType })}`, { auth: false });
    const meals = Array.isArray(data?.items) ? data.items : data ? [data] : [];
    const source = meals.find((item) => item.meal_type === mealType);
    if (!source) return { requestedDate: date, meal: null, mismatchedDate: false };
    if (source.meal_date !== date) {
      return { requestedDate: date, responseDate: source.meal_date, meal: null, mismatchedDate: true };
    }
    return { requestedDate: date, responseDate: source.meal_date, meal: adaptMeal(source), mismatchedDate: false };
  },

  async getMealsForWeek({ dates, mealType = "LUNCH" }) {
    const requestedDates = [...new Set((dates || []).filter(Boolean))].slice(0, 7);
    apiLog("주간 급식 일자별 조회", { dates: requestedDates, mealType, requestCount: requestedDates.length });
    const outcomes = await Promise.all(requestedDates.map(async (date) => {
      try {
        return await this.getMealForDate(date, mealType);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { requestedDate: date, meal: null, mismatchedDate: false, notFound: true };
        }
        return { requestedDate: date, meal: null, mismatchedDate: false, error };
      }
    }));
    const failures = outcomes.filter((outcome) => outcome.error);
    if (failures.length === requestedDates.length && failures[0]?.error) throw failures[0].error;
    return {
      meals: outcomes.map((outcome) => outcome.meal).filter(Boolean),
      coverage: "DAILY_REQUESTS",
      requestedCount: requestedDates.length,
      mismatchCount: outcomes.filter((outcome) => outcome.mismatchedDate).length,
      failureCount: failures.length,
    };
  },

  async getDashboard() {
    apiLog("사용자 대시보드 구성 시작");
    const todayMeal = await this.getTodayMeal();
    const [recent, recommendationData] = await Promise.all([
      this.getRecentMealRecords(5),
      this.getRecommendations(todayMeal.mealId),
    ]);
    const recommendations = todayMeal.menuItems.map((menu) => {
      const recommendation = recommendationData.recommendations.find((item) => String(item.menuId) === String(menu.menuId));
      return recommendation
        ? { ...recommendation, available: true }
        : {
          menuId: menu.menuId,
          menuName: menu.name,
          standardServingG: menu.standardServingG,
          recommendedServingG: null,
          reason: "신체 정보와 권장 영양소 기준에 맞는 추천 데이터가 없습니다.",
          available: false,
        };
    });
    const dashboard = { todayMeal, recent, recommendations };
    apiLog("사용자 대시보드 구성 완료", {
      menuCount: todayMeal.menuItems.length,
      recentRecordCount: recent.records.length,
      recommendationCount: dashboard.recommendations.length,
    });
    return dashboard;
  },

  async getRecentMealRecords(days = 5) {
    apiLog("최근 식사 기록 조회", { days });
    const data = await requestApi(`${endpoints.recentMealRecords}${buildQuery({ days })}`);
    return {
      period: {
        days,
        startDate: data.start_date,
        endDate: data.end_date,
      },
      records: (data.items || [])
        .map(adaptMealRecord)
        .filter((record) => !record.mealType || record.mealType === "LUNCH"),
    };
  },

  async uploadMealImage(recordId, imageType, file, { signal, onProgress } = {}) {
    const normalizedType = String(imageType).toUpperCase();
    if (!["BEFORE", "AFTER"].includes(normalizedType)) {
      throw new ApiError("사진 유형이 올바르지 않습니다.", { code: "INVALID_IMAGE_TYPE" });
    }
    const validationError = validateMealImage(file);
    if (validationError) throw new ApiError(validationError, { code: "INVALID_IMAGE_FILE" });
    apiLog("식사 사진 업로드", { recordId, imageType: normalizedType, fileName: file.name, fileSize: file.size });
    const data = await uploadMultipart(
      endpoints.mealRecordImage(recordId, normalizedType),
      buildMealImageFormData(file),
      { signal, onProgress },
    );
    return {
      imageId: data.image_id,
      recordId: Number(recordId),
      imageType: normalizedType,
      imageUrl: data.image_url,
    };
  },

  async analyzeMealRecord(recordId) {
    apiLog("사용자 식사 분석 요청", { recordId });
    const data = await requestApi(endpoints.analyzeMealRecord(recordId), { method: "POST" });
    return adaptAnalysis(data);
  },

  async getMealRecordDetail(recordId) {
    apiLog("식사 기록 상세 조회", { recordId });
    return adaptMealRecord(await requestApi(endpoints.mealRecord(recordId)));
  },

  async getMealAnalysis(recordId) {
    apiLog("식사 분석 결과 조회", { recordId });
    return analysisFromRecordDto(await requestApi(endpoints.mealRecord(recordId)));
  },

  async getRecommendations(mealId) {
    apiLog("권장 배식량 조회", { mealId });
    return adaptRecommendations(await requestApi(`${endpoints.recommendations}${buildQuery({ meal_id: mealId })}`));
  },

  async correctConsumedRatio(itemRecordId, consumedRatio) {
    apiLog("섭취율 보정 요청", { itemRecordId, consumedRatio });
    if (!Number.isFinite(consumedRatio) || consumedRatio < 0 || consumedRatio > 1) {
      throw new ApiError("섭취율은 0부터 1 사이여야 합니다.", { code: "INVALID_CONSUMED_RATIO" });
    }
    const data = await requestApi(endpoints.consumedRatio(itemRecordId), jsonOptions("PATCH", {
      consumed_ratio: consumedRatio,
    }));
    return adaptMealItem(data);
  },

  async getAdminDashboard(date) {
    apiLog("관리자 대시보드 조회", { date });
    return adaptAdminDashboard(await requestApi(`${endpoints.adminDashboard}${buildQuery({ date })}`));
  },

  async getLeftoverSummary({ startDate, endDate }) {
    apiLog("메뉴별 잔반 통계 조회", { startDate, endDate });
    const data = await requestApi(`${endpoints.leftoverSummary}${buildQuery({
      start_date: startDate,
      end_date: endDate,
    })}`);
    const source = Array.isArray(data) ? data : data?.menu_summary || data?.items || [];
    return { menuSummary: source.map(adaptLeftoverSummaryItem) };
  },

  async getMenus({ page = 1, size = 20, keyword = "" } = {}) {
    apiLog("메뉴 목록 조회", { page, size, keyword });
    const data = await requestApi(endpoints.menus, { auth: false });
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko");
    const items = (data.items || []).map(adaptMenu);
    const filtered = normalizedKeyword
      ? items.filter((menu) => menu.name.toLocaleLowerCase("ko").includes(normalizedKeyword))
      : items;
    return {
      items: filtered.slice((page - 1) * size, page * size),
      page,
      size,
      totalCount: filtered.length,
    };
  },

  async getMenu(menuId) {
    apiLog("메뉴 상세 조회", { menuId });
    return adaptMenu(await requestApi(endpoints.menu(menuId)));
  },

  getMeal(mealId) {
    return requestApi(endpoints.meal(mealId)).then(adaptMeal);
  },

  async createAdminMenu(menu) {
    apiLog("관리자 메뉴 등록", { name: menu.name, allergenCount: menu.allergenCodes?.length || 0 });
    const body = buildMenuCreatePayload(menu);
    return adaptMenu(await requestApi(endpoints.adminMenus, jsonOptions("POST", body)));
  },

  async updateAdminMenu(menuId, menu) {
    apiLog("관리자 메뉴 수정", { menuId, name: menu.name });
    const body = buildMenuUpdatePayload(menu);
    return adaptMenu(await requestApi(endpoints.adminMenu(menuId), jsonOptions("PATCH", body)));
  },

  deleteAdminMenu(menuId) {
    return requestApi(endpoints.adminMenu(menuId), { method: "DELETE" });
  },

  async getAdminUsers({ page = 1, size = 20, keyword = "" } = {}) {
    const data = await requestApi(`${endpoints.adminUsers}${buildQuery({ page, size, keyword })}`);
    return {
      items: (data.items || []).map(adaptUser),
      page: data.page ?? page,
      size: data.size ?? size,
      totalCount: data.total ?? data.items?.length ?? 0,
    };
  },

  async createAdminMeal(meal) {
    const body = buildAdminMealPayload(meal);
    apiLog("관리자 일자별 식단 등록", { mealDate: body.meal_date, menuCount: body.menu_ids.length });
    if (!body.meal_date || !body.school_name || body.menu_ids.length === 0) {
      throw new ApiError("날짜, 제공 기관, 메뉴를 모두 입력해 주세요.", { code: "INVALID_MEAL_PLAN" });
    }
    return adaptMeal(await requestApi(endpoints.adminMeals, jsonOptions("POST", body)));
  },
};

function adaptUser(data) {
  return {
    id: data.user_id ?? data.id,
    loginId: data.login_id,
    name: data.name,
    studentNumber: data.student_number,
    role: data.role,
    isActive: data.is_active,
    allergens: (data.allergens || []).map(adaptAllergen),
  };
}

function adaptAllergen(data) {
  const source = typeof data === "object" && data !== null ? data : {};
  const allergen = adaptAllergenValue(data);
  return {
    id: source.allergen_id ?? source.id,
    code: allergen.code,
    name: allergen.name,
    displayNumber: source.display_number,
    description: source.description,
    isActive: source.is_active,
  };
}

function adaptRfidCard(data) {
  return {
    cardId: data.card_id ?? data.id,
    uid: data.uid,
    isActive: data.is_active,
  };
}

function adaptMeal(data) {
  return {
    mealId: data.meal_id ?? data.id,
    date: data.meal_date,
    mealType: data.meal_type,
    schoolName: data.school_name || "",
    menuItems: (data.menu_items || []).map((item) => ({
      mealMenuItemId: item.meal_menu_item_id,
      menuId: item.menu_id,
      name: item.name,
      standardServingG: item.standard_serving_g,
      nutrition: adaptNutrition(item.nutrition_per_100g),
      ingredients: item.ingredients || [],
      allergens: (item.allergens || []).map(adaptAllergenValue),
    })),
  };
}

function adaptMealRecord(data) {
  const meal = data.meal || {};
  return {
    recordId: data.meal_record_id ?? data.id,
    mealId: data.meal_id,
    date: data.meal_date ?? meal.meal_date,
    mealType: data.meal_type ?? meal.meal_type,
    status: data.status,
    schoolName: meal.school_name || "",
    startedAt: data.started_at,
    completedAt: data.completed_at,
    errorMessage: data.failure_reason,
    items: (data.items || data.item_records || []).map((item) => adaptMealItem(item, meal.menu_items)),
  };
}

function adaptMealItem(item, mealMenuItems = []) {
  const consumedRatio = item.consumed_ratio;
  const mealMenu = mealMenuItems.find((candidate) => String(candidate.meal_menu_item_id) === String(item.meal_menu_item_id));
  return {
    itemRecordId: item.meal_item_record_id ?? item.id,
    mealMenuItemId: item.meal_menu_item_id,
    menuId: item.menu_id,
    menuName: item.menu_name,
    standardServingG: mealMenu?.standard_serving_g,
    consumedRatio,
    consumedPercent: item.consumed_percent ?? (Number.isFinite(consumedRatio) ? Math.round(consumedRatio * 100) : undefined),
    consumptionLevel: item.consumption_level,
    estimatedConsumedG: item.nutrition?.estimated_consumed_g,
    estimatedNutrition: adaptNutrition(item.nutrition),
    confidence: item.confidence,
    isCorrected: Boolean(item.is_corrected),
    correctedAt: item.corrected_at,
    note: item.note,
    analysisType: item.analysis_type,
  };
}

function adaptAnalysis(data) {
  return {
    recordId: data.meal_record_id,
    status: data.status ?? "COMPLETED",
    analysisType: data.analysis_type,
    analysisNote: data.analysis_note,
    items: (data.items || []).map((item) => {
      const consumedRatio = item.consumed_ratio;
      return {
        itemRecordId: item.meal_item_record_id ?? item.id,
        mealMenuItemId: item.meal_menu_item_id,
        menuId: item.menu_id,
        menuName: item.menu_name,
        consumedRatio,
        consumedPercent: item.consumed_percent ?? (Number.isFinite(consumedRatio) ? Math.round(consumedRatio * 100) : undefined),
        consumptionLevel: item.consumption_level,
        standardServingG: item.standard_serving_g,
        estimatedConsumedG: item.estimated_consumed_g ?? item.nutrition?.estimated_consumed_g,
        estimatedNutrition: adaptNutrition(item.estimated_nutrition ?? item.nutrition),
        confidence: item.confidence,
        isCorrected: Boolean(item.is_corrected),
        correctedAt: item.corrected_at,
        note: item.note,
        analysisType: item.analysis_type,
      };
    }),
  };
}

function analysisFromRecordDto(record) {
  const mealMenus = record.meal?.menu_items || [];
  const analysis = adaptAnalysis({
    meal_record_id: record.id,
    analysis_type: record.item_records?.[0]?.analysis_type || null,
    analysis_note: "식사 기록에 저장된 메뉴별 섭취율 분석 결과입니다.",
    items: record.item_records || [],
  });
  analysis.items = analysis.items.map((item) => ({
    ...item,
    standardServingG: mealMenus.find((menu) => String(menu.meal_menu_item_id) === String(item.mealMenuItemId))?.standard_serving_g,
  }));
  return analysis;
}

function analysisFromAdaptedRecord(record) {
  return {
    recordId: record.recordId,
    status: record.status,
    analysisType: record.items?.[0]?.analysisType,
    analysisNote: "식사 기록에 저장된 메뉴별 섭취율 분석 결과입니다.",
    items: record.items || [],
  };
}

function adaptNutrition(nutrition) {
  if (!nutrition) return null;
  return {
    caloriesKcal: nutrition.calories_kcal,
    carbohydrateG: nutrition.carbohydrate_g,
    proteinG: nutrition.protein_g,
    fatG: nutrition.fat_g,
  };
}

function adaptRecommendations(data) {
  return {
    mealId: data.meal_id,
    recommendations: (data.recommendations || data.items || []).map((item) => ({
      mealMenuItemId: item.meal_menu_item_id,
      menuId: item.menu_id,
      menuName: item.menu_name,
      standardServingG: item.standard_serving_g,
      recommendationLevel: item.recommendation_level,
      recommendedServingRatio: item.recommended_serving_ratio,
      recommendedServingG: item.recommended_serving_g,
      recentAverageConsumedRatio: item.recent_average_consumed_ratio,
      sampleCount: item.sample_count,
      reason: item.reason,
    })),
  };
}

function adaptAdminDashboard(data) {
  return {
    date: data.date,
    totalUsers: data.total_users ?? data.active_user_count,
    mealRecordCount: data.meal_record_count,
    completedAnalysisCount: data.completed_analysis_count,
    failedAnalysisCount: data.failed_analysis_count,
    averageConsumedRatio: data.average_consumed_ratio,
    averageLeftoverRatio: data.average_leftover_ratio,
  };
}

function adaptLeftoverSummaryItem(item) {
  return {
    menuId: item.menu_id,
    menuName: item.menu_name,
    averageConsumedRatio: item.average_consumed_ratio,
    averageLeftoverRatio: item.average_leftover_ratio,
    analysisCount: item.analysis_count,
  };
}

function adaptMenu(data) {
  const nutrition = data.nutrition_per_100g || {
    calories_kcal: data.calories_per_100g,
    carbohydrate_g: data.carbohydrate_per_100g,
    protein_g: data.protein_per_100g,
    fat_g: data.fat_per_100g,
  };
  return {
    menuId: data.menu_id ?? data.id,
    name: data.name,
    standardServingG: data.standard_serving_g,
    nutrition: adaptNutrition(nutrition),
    ingredients: data.ingredients || [],
    allergens: (data.allergens || data.allergen_codes || []).map(adaptAllergenValue),
    isActive: data.is_active,
  };
}

function adaptAllergenValue(value) {
  const source = typeof value === "object" && value !== null ? value : { code: value };
  const code = String(source.code || source.name || "").trim();
  const providedName = String(source.name ?? source.name_ko ?? "").trim();
  return {
    code,
    name: providedName && providedName !== code ? providedName : ALLERGEN_NAMES[code] || providedName || code,
  };
}

function uploadMultipart(path, formData, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}${path}`);
    xhr.setRequestHeader("Accept", "application/json");
    const accessToken = getStoredAuth()?.accessToken;
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let payload;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : { success: true, data: null };
      } catch {
        reject(new ApiError("서버 응답 형식을 확인할 수 없습니다.", { status: xhr.status, code: "INVALID_RESPONSE" }));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300 || payload?.success === false) {
        reject(new ApiError(payload?.message || `사진 업로드에 실패했습니다. (${xhr.status})`, {
          status: xhr.status,
          code: payload?.error?.code || "UPLOAD_FAILED",
          detail: payload?.error?.detail || "",
        }));
        return;
      }
      resolve(Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload);
    };
    xhr.onerror = () => reject(new ApiError("사진 업로드 중 서버에 연결할 수 없습니다.", { code: "NETWORK_ERROR" }));
    xhr.onabort = () => reject(new DOMException("업로드를 취소했습니다.", "AbortError"));
    if (signal?.aborted) {
      xhr.abort();
      return;
    }
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    apiLog("multipart 업로드 시작", { path, authenticated: Boolean(accessToken) });
    xhr.send(formData);
  });
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // 브라우저 저장소가 차단되어도 API 요청 처리는 계속합니다.
  }
}
