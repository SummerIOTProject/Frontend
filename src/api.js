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

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (
  configuredApiBaseUrl || (import.meta.env.PROD ? "/backend" : "http://localhost:8000")
).replace(/\/$/, "");
const baseUrl = API_BASE_URL;
const useMock = import.meta.env.VITE_USE_MOCK_API === "true";
const AUTH_KEY = "smartMealAuth";
const MOCK_MENU_KEY = "smartMealMockMenus";
const MOCK_MENU_OVERRIDES_KEY = "smartMealMockMenuOverrides";
const MOCK_MEAL_PLANS_KEY = "smartMealMockMealPlans";
const MOCK_UPLOADED_RECORDS_KEY = "smartMealMockUploadedRecords";
const MOCK_UPLOADED_ANALYSES_KEY = "smartMealMockUploadedAnalyses";
const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const shouldLog = import.meta.env.MODE !== "test";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
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
    return "JPG, JPEG, PNG, WebP 파일만 등록할 수 있습니다.";
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
    apiLog("로그인", { loginId, mode: useMock ? "mock" : "real" });
    const data = useMock
      ? await mockLogin(loginId, password)
      : await requestApi(endpoints.login, jsonOptions("POST", {
        login_id: loginId,
        password,
      }, { auth: false }));
    const auth = saveAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      accessTokenExpiresIn: data.access_token_expires_in,
      refreshTokenExpiresInDays: data.refresh_token_expires_in_days,
      ...(useMock ? { mockLoginId: loginId } : {}),
    });
    apiLog("로그인 토큰 저장 완료", { loginId });
    return auth;
  },

  async logout() {
    apiLog("로그아웃", { mode: useMock ? "mock" : "real" });
    const refreshToken = getStoredAuth()?.refreshToken;
    try {
      if (useMock) {
        await wait();
      } else if (refreshToken) {
        await requestApi(endpoints.logout, jsonOptions("POST", {
          refresh_token: refreshToken,
        }));
      }
    } finally {
      clearAuth();
    }
  },

  async getCurrentUser() {
    apiLog("현재 사용자 조회", { mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const loginId = getStoredAuth()?.mockLoginId;
      if (!loginId) throw new ApiError("로그인이 필요합니다.", { status: 401, code: "AUTH_REQUIRED" });
      return adaptUser({
        id: loginId.startsWith("admin") ? 900 : 1,
        login_id: loginId,
        name: loginId.startsWith("admin") ? "급식 관리자" : "정준서",
        student_number: loginId.startsWith("admin") ? "ADMIN-001" : "20223137",
        role: loginId.startsWith("admin") ? "ADMIN" : "STUDENT",
        is_active: true,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
      });
    }
    return adaptUser(await requestApi(endpoints.me));
  },

  async getAllergens() {
    apiLog("알레르기 목록 조회", { mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      return structuredClone(mockAllergens).map(adaptAllergen);
    }
    const data = await requestApi(endpoints.allergens, { auth: false });
    return (Array.isArray(data) ? data : []).map(adaptAllergen);
  },

  async getTodayMeal(mealType = "LUNCH") {
    apiLog("오늘 급식 조회", { mealType, mode: useMock ? "mock" : "real" });
    const data = useMock
      ? (await wait(), getMockTodayMeals())
      : await requestApi(endpoints.todayMeal, { auth: false });
    const meal = (data.items || []).find((item) => item.meal_type === mealType);
    if (!meal) {
      throw new ApiError(`오늘 ${mealType === "LUNCH" ? "점심" : "급식"} 정보가 없습니다.`, {
        status: 404,
        code: "MEAL_NOT_FOUND",
      });
    }
    return adaptMeal(meal);
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
    apiLog("최근 식사 기록 조회", { days, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const endDate = getLocalDateKey();
      const startDate = shiftDateKey(endDate, -(days - 1));
      return {
        period: { days, startDate, endDate },
        records: getMockRecentRecords(days).map(adaptMealRecord),
      };
    }
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

  async prepareMealRecordForUpload(mealId) {
    apiLog("업로드 대상 식사 기록 준비", { mealId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const recordId = Date.now();
      const meal = getMockTodayMeal();
      const record = {
        id: recordId,
        user_id: 1,
        meal_id: mealId,
        status: "CREATED",
        started_at: new Date().toISOString(),
        completed_at: null,
        failure_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        meal,
        images: [],
        item_records: [],
      };
      const records = readStorage(MOCK_UPLOADED_RECORDS_KEY, {});
      records[recordId] = record;
      writeStorage(MOCK_UPLOADED_RECORDS_KEY, records);
      return adaptMealRecord(record);
    }
    const recent = await this.getRecentMealRecords(1);
    const record = recent.records.find((item) => String(item.mealId) === String(mealId));
    if (!record) {
      throw new ApiError("RFID 장치에서 오늘 식사 기록을 먼저 생성해 주세요.", {
        status: 404,
        code: "MEAL_RECORD_REQUIRED",
      });
    }
    return record;
  },

  async uploadMealImage(recordId, imageType, file, { signal, onProgress } = {}) {
    const normalizedType = String(imageType).toUpperCase();
    if (!["BEFORE", "AFTER"].includes(normalizedType)) {
      throw new ApiError("사진 유형이 올바르지 않습니다.", { code: "INVALID_IMAGE_TYPE" });
    }
    const validationError = validateMealImage(file);
    if (validationError) throw new ApiError(validationError, { code: "INVALID_IMAGE_FILE" });
    apiLog("식사 사진 업로드", { recordId, imageType: normalizedType, fileName: file.name, fileSize: file.size, mode: useMock ? "mock" : "real" });
    if (useMock) {
      for (const progress of [20, 45, 70, 100]) {
        await wait(80);
        if (signal?.aborted) throw new DOMException("업로드를 취소했습니다.", "AbortError");
        onProgress?.(progress);
      }
      const records = readStorage(MOCK_UPLOADED_RECORDS_KEY, {});
      const record = records[recordId];
      if (!record) throw new ApiError("식사 기록을 찾을 수 없습니다.", { status: 404, code: "MEAL_RECORD_NOT_FOUND" });
      const imageUrl = normalizedType === "BEFORE" ? mockBeforeImageUrl : mockAfterImageUrl;
      const image = {
        id: Date.now(),
        meal_record_id: Number(recordId),
        image_type: normalizedType,
        image_url: imageUrl,
        mime_type: file.type,
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
      record.images = [...(record.images || []).filter((item) => item.image_type !== normalizedType), image];
      record.status = normalizedType === "BEFORE" ? "BEFORE_IMAGE_UPLOADED" : "IMAGES_UPLOADED";
      record.updated_at = new Date().toISOString();
      records[recordId] = record;
      writeStorage(MOCK_UPLOADED_RECORDS_KEY, records);
      return { imageId: image.id, recordId: Number(recordId), imageType: normalizedType, imageUrl };
    }
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
    apiLog("사용자 식사 분석 요청", { recordId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait(240);
      const records = readStorage(MOCK_UPLOADED_RECORDS_KEY, {});
      const record = records[recordId];
      if (!record) throw new ApiError("식사 기록을 찾을 수 없습니다.", { status: 404, code: "MEAL_RECORD_NOT_FOUND" });
      const meal = record.meal || getMockTodayMeal();
      const templates = mockUploadAnalysisTemplates;
      record.status = "COMPLETED";
      record.item_records = meal.menu_items.map((menu, index) => {
        const template = templates[menu.menu_id] || { consumed_ratio: 0.75, consumed_percent: 75, consumption_level: "MOST" };
        const nutrition = template.nutrition || {};
        return {
          id: Number(`${String(recordId).slice(-6)}${index + 1}`),
          meal_record_id: Number(recordId),
          meal_menu_item_id: menu.meal_menu_item_id,
          menu_id: menu.menu_id,
          menu_name: menu.name,
          consumed_ratio: template.consumed_ratio,
          consumed_percent: template.consumed_percent,
          consumption_level: template.consumption_level,
          confidence: template.confidence,
          is_corrected: false,
          corrected_at: null,
          corrected_by: null,
          note: template.note || null,
          analysis_type: "MOCK",
          nutrition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
      record.completed_at = new Date().toISOString();
      record.updated_at = record.completed_at;
      record.images = [];
      records[recordId] = record;
      writeStorage(MOCK_UPLOADED_RECORDS_KEY, records);
      const analysis = {
        meal_record_id: Number(recordId),
        analysis_type: "MOCK",
        analysis_note: "메뉴별 섭취율 분석 결과입니다.",
        items: record.item_records,
      };
      const analyses = readStorage(MOCK_UPLOADED_ANALYSES_KEY, {});
      analyses[recordId] = analysis;
      writeStorage(MOCK_UPLOADED_ANALYSES_KEY, analyses);
      return adaptAnalysis(analysis);
    }
    const data = await requestApi(endpoints.analyzeMealRecord(recordId), { method: "POST" });
    return adaptAnalysis(data);
  },

  async getMealRecordDetail(recordId) {
    apiLog("식사 기록 상세 조회", { recordId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const uploadedRecords = readStorage(MOCK_UPLOADED_RECORDS_KEY, {});
      const seededRecord = getMockRecentRecords(5).find((record) => String(record.id) === String(recordId));
      const baseDetail = uploadedRecords[recordId] || mockRecordDetails[recordId] || seededRecord;
      const detail = baseDetail ? structuredClone(baseDetail) : null;
      if (!detail) throw new ApiError("식사 기록을 찾을 수 없습니다.", { status: 404, code: "MEAL_RECORD_NOT_FOUND" });
      if (!uploadedRecords[recordId] && seededRecord) {
        detail.meal = { ...detail.meal, meal_date: seededRecord.meal.meal_date, meal_type: "LUNCH" };
      }
      return adaptMealRecord(detail);
    }
    return adaptMealRecord(await requestApi(endpoints.mealRecord(recordId)));
  },

  async getMealAnalysis(recordId) {
    apiLog("식사 분석 결과 조회", { recordId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const uploadedAnalyses = readStorage(MOCK_UPLOADED_ANALYSES_KEY, {});
      const analysis = uploadedAnalyses[recordId] || mockAnalyses[recordId];
      if (analysis) return adaptAnalysis(structuredClone(analysis));
      const detail = await this.getMealRecordDetail(recordId);
      return analysisFromAdaptedRecord(detail);
    }
    return analysisFromRecordDto(await requestApi(endpoints.mealRecord(recordId)));
  },

  async getRecommendations(mealId) {
    apiLog("권장 배식량 조회", { mealId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      return adaptRecommendations(getMockRecommendations(mealId));
    }
    return adaptRecommendations(await requestApi(`${endpoints.recommendations}${buildQuery({ meal_id: mealId })}`));
  },

  async correctConsumedRatio(itemRecordId, consumedRatio) {
    apiLog("섭취율 보정 요청", { itemRecordId, consumedRatio, mode: useMock ? "mock" : "real" });
    if (!Number.isFinite(consumedRatio) || consumedRatio < 0 || consumedRatio > 1) {
      throw new ApiError("섭취율은 0부터 1 사이여야 합니다.", { code: "INVALID_CONSUMED_RATIO" });
    }
    if (useMock) {
      await wait();
      const corrected = updateMockConsumedRatio(itemRecordId, consumedRatio);
      if (!corrected) throw new ApiError("메뉴 식사 기록을 찾을 수 없습니다.", { status: 404, code: "MEAL_ITEM_NOT_FOUND" });
      return adaptMealItem(corrected);
    }
    const data = await requestApi(endpoints.consumedRatio(itemRecordId), jsonOptions("PATCH", {
      consumed_ratio: consumedRatio,
    }));
    return adaptMealItem(data);
  },

  async getAdminDashboard(date) {
    apiLog("관리자 대시보드 조회", { date, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      return adaptAdminDashboard({ ...mockAdminDashboard, date });
    }
    return adaptAdminDashboard(await requestApi(`${endpoints.adminDashboard}${buildQuery({ date })}`));
  },

  async getLeftoverSummary({ startDate, endDate }) {
    apiLog("메뉴별 잔반 통계 조회", { startDate, endDate, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      return { menuSummary: structuredClone(mockLeftoverSummary).map(adaptLeftoverSummaryItem) };
    }
    const data = await requestApi(`${endpoints.leftoverSummary}${buildQuery({
      start_date: startDate,
      end_date: endDate,
    })}`);
    return { menuSummary: (Array.isArray(data) ? data : []).map(adaptLeftoverSummaryItem) };
  },

  async getMenus({ page = 1, size = 20, keyword = "" } = {}) {
    apiLog("메뉴 목록 조회", { page, size, keyword, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const allMenus = getMockMenus();
      const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko");
      const filtered = normalizedKeyword
        ? allMenus.filter((menu) => menu.name.toLocaleLowerCase("ko").includes(normalizedKeyword))
        : allMenus;
      return { items: structuredClone(filtered).map(adaptMenu), page, size, totalCount: filtered.length };
    }
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
    apiLog("메뉴 상세 조회", { menuId, mode: useMock ? "mock" : "real" });
    if (useMock) {
      await wait();
      const menu = getMockMenus().find((item) => String(item.id) === String(menuId));
      if (!menu) throw new ApiError("메뉴를 찾을 수 없습니다.", { status: 404, code: "MENU_NOT_FOUND" });
      return adaptMenu(structuredClone(menu));
    }
    return adaptMenu(await requestApi(endpoints.menu(menuId)));
  },

  getMeal(mealId) {
    return requestApi(endpoints.meal(mealId)).then(adaptMeal);
  },

  async createAdminMenu(menu) {
    apiLog("관리자 메뉴 등록", { name: menu.name, allergenCount: menu.allergenCodes?.length || 0, mode: useMock ? "mock" : "real" });
    const body = buildMenuCreatePayload(menu);
    if (useMock) {
      await wait();
      const created = {
        id: Date.now(),
        name: body.name,
        standard_serving_g: body.standard_serving_g,
        calories_per_100g: body.nutrition_per_100g.calories_kcal,
        carbohydrate_per_100g: body.nutrition_per_100g.carbohydrate_g,
        protein_per_100g: body.nutrition_per_100g.protein_g,
        fat_per_100g: body.nutrition_per_100g.fat_g,
        ingredients: body.ingredients,
        allergen_codes: body.allergen_codes,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const customMenus = readStorage(MOCK_MENU_KEY, []);
      customMenus.push(created);
      writeStorage(MOCK_MENU_KEY, customMenus);
      return adaptMenu(created);
    }
    return adaptMenu(await requestApi(endpoints.adminMenus, jsonOptions("POST", body)));
  },

  async updateAdminMenu(menuId, menu) {
    apiLog("관리자 메뉴 수정", { menuId, name: menu.name, mode: useMock ? "mock" : "real" });
    const body = buildMenuUpdatePayload(menu);
    if (useMock) {
      await wait();
      const updated = {
        id: Number(menuId),
        name: body.name,
        standard_serving_g: body.standard_serving_g,
        calories_per_100g: body.nutrition_per_100g.calories_kcal,
        carbohydrate_per_100g: body.nutrition_per_100g.carbohydrate_g,
        protein_per_100g: body.nutrition_per_100g.protein_g,
        fat_per_100g: body.nutrition_per_100g.fat_g,
        ingredients: body.ingredients,
        allergen_codes: body.allergen_codes,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const customMenus = readStorage(MOCK_MENU_KEY, []);
      const customIndex = customMenus.findIndex((item) => String(item.id) === String(menuId));
      if (customIndex >= 0) {
        customMenus[customIndex] = updated;
        writeStorage(MOCK_MENU_KEY, customMenus);
      } else {
        const exists = mockMenus.some((item) => String(item.id) === String(menuId));
        if (!exists) throw new ApiError("메뉴를 찾을 수 없습니다.", { status: 404, code: "MENU_NOT_FOUND" });
        const overrides = readStorage(MOCK_MENU_OVERRIDES_KEY, {});
        overrides[menuId] = updated;
        writeStorage(MOCK_MENU_OVERRIDES_KEY, overrides);
      }
      return adaptMenu(updated);
    }
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
    apiLog("관리자 일자별 식단 등록", { mealDate: body.meal_date, menuCount: body.menu_ids.length, mode: useMock ? "mock" : "real" });
    if (!body.meal_date || !body.school_name || body.menu_ids.length === 0) {
      throw new ApiError("날짜, 제공 기관, 메뉴를 모두 입력해 주세요.", { code: "INVALID_MEAL_PLAN" });
    }
    if (useMock) {
      await wait();
      const catalog = getMockMenus();
      const selectedMenus = body.menu_ids.map((menuId) => catalog.find((menu) => String(menu.id) === String(menuId)));
      if (selectedMenus.some((menu) => !menu)) {
        throw new ApiError("선택한 메뉴 중 등록되지 않은 메뉴가 있습니다.", { code: "MENU_NOT_FOUND" });
      }
      const created = {
        id: Date.now(),
        meal_date: body.meal_date,
        meal_type: "LUNCH",
        school_name: body.school_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        menu_items: selectedMenus.map((menu, index) => toMealMenuItem(menu, Date.now() + index + 1)),
      };
      const plans = readStorage(MOCK_MEAL_PLANS_KEY, []);
      plans.push(created);
      writeStorage(MOCK_MEAL_PLANS_KEY, plans);
      return adaptMeal(created);
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
  return {
    id: data.allergen_id ?? data.id,
    code: data.code,
    name: data.name ?? data.name_ko,
    displayNumber: data.display_number,
    description: data.description,
    isActive: data.is_active,
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
      allergens: (item.allergens || []).map((allergen) => typeof allergen === "string" ? allergen : allergen.name),
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
    analysis_type: record.item_records?.[0]?.analysis_type || "MOCK",
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
    allergens: (data.allergens || data.allergen_codes || []).map((value) => {
      if (typeof value === "object") return { code: value.code, name: value.name ?? value.name_ko ?? value.code };
      const allergen = mockAllergens.find((item) => item.code === value);
      return { code: value, name: allergen?.name_ko || value };
    }),
    isActive: data.is_active,
  };
}

async function mockLogin(loginId, password) {
  await wait();
  if (!loginId || !password) throw new ApiError("로그인 아이디와 비밀번호를 입력해 주세요.", { status: 400, code: "INVALID_LOGIN" });
  return {
    access_token: `mock-access-${loginId}`,
    refresh_token: `mock-refresh-${loginId}`,
    token_type: "bearer",
    access_token_expires_in: 3600,
    refresh_token_expires_in_days: 14,
  };
}

function updateMockConsumedRatio(itemRecordId, consumedRatio) {
  for (const detail of Object.values(mockRecordDetails)) {
    const item = detail.item_records?.find((candidate) => String(candidate.id) === String(itemRecordId));
    if (item) {
      item.consumed_ratio = consumedRatio;
      item.consumed_percent = Math.round(consumedRatio * 100);
      item.is_corrected = true;
      item.corrected_at = new Date().toISOString();
      item.corrected_by = 1;
      item.confidence = null;
    }
  }
  for (const analysis of Object.values(mockAnalyses)) {
    const item = analysis.items?.find((candidate) => String(candidate.id) === String(itemRecordId));
    if (item) {
      item.consumed_ratio = consumedRatio;
      item.consumed_percent = Math.round(consumedRatio * 100);
      item.is_corrected = true;
      item.corrected_at = new Date().toISOString();
      item.corrected_by = 1;
      item.confidence = null;
      return item;
    }
  }
  const uploadedRecords = readStorage(MOCK_UPLOADED_RECORDS_KEY, {});
  for (const record of Object.values(uploadedRecords)) {
    const item = record.item_records?.find((candidate) => String(candidate.id) === String(itemRecordId));
    if (item) {
      item.consumed_ratio = consumedRatio;
      item.consumed_percent = Math.round(consumedRatio * 100);
      item.is_corrected = true;
      item.corrected_at = new Date().toISOString();
      item.corrected_by = 1;
      item.confidence = null;
      writeStorage(MOCK_UPLOADED_RECORDS_KEY, uploadedRecords);
    }
  }
  const uploadedAnalyses = readStorage(MOCK_UPLOADED_ANALYSES_KEY, {});
  for (const analysis of Object.values(uploadedAnalyses)) {
    const item = analysis.items?.find((candidate) => String(candidate.id) === String(itemRecordId));
    if (item) {
      item.consumed_ratio = consumedRatio;
      item.consumed_percent = Math.round(consumedRatio * 100);
      item.is_corrected = true;
      item.corrected_at = new Date().toISOString();
      item.corrected_by = 1;
      item.confidence = null;
      writeStorage(MOCK_UPLOADED_ANALYSES_KEY, uploadedAnalyses);
      return item;
    }
  }
  return null;
}

function getMockMenus() {
  const overrides = readStorage(MOCK_MENU_OVERRIDES_KEY, {});
  const baseMenus = mockMenus.map((menu) => overrides[menu.id] || menu);
  return [...baseMenus, ...readStorage(MOCK_MENU_KEY, [])];
}

function getMockTodayMeals() {
  const meal = getMockTodayMeal();
  return { items: [meal], total: 1 };
}

function getMockTodayMeal() {
  const today = getLocalDateKey();
  const plans = readStorage(MOCK_MEAL_PLANS_KEY, []);
  const savedPlan = [...plans].reverse().find((plan) => plan.meal_date === today && plan.meal_type === "LUNCH");
  if (savedPlan) return structuredClone(savedPlan);
  const menus = getMockMenus().filter((menu) => [1, 5, 8, 10].includes(menu.id));
  return {
    ...mockTodayMeal,
    meal_date: today,
    menu_items: menus.map((menu, index) => toMealMenuItem(menu, 101 + index)),
  };
}

function getMockRecentRecords(days) {
  const today = getLocalDateKey();
  const startDate = shiftDateKey(today, -(days - 1));
  const uploaded = Object.values(readStorage(MOCK_UPLOADED_RECORDS_KEY, {}))
    .filter((record) => record.status === "COMPLETED");
  const uploadedDates = new Set(uploaded.map((record) => record.meal?.meal_date));
  const seeded = mockRecentRecords.map((record, index) => ({
    ...structuredClone(record),
    meal: {
      ...structuredClone(record.meal),
      meal_date: shiftDateKey(today, -index),
      meal_type: "LUNCH",
    },
  })).filter((record) => !uploadedDates.has(record.meal.meal_date));
  return [...uploaded, ...seeded]
    .filter((record) => record.status === "COMPLETED"
      && record.meal?.meal_date >= startDate
      && record.meal?.meal_date <= today
      && record.meal?.meal_type === "LUNCH")
    .sort((left, right) => right.meal.meal_date.localeCompare(left.meal.meal_date));
}

function toMealMenuItem(menu, mealMenuItemId) {
  return {
    meal_menu_item_id: mealMenuItemId,
    menu_id: menu.id,
    name: menu.name,
    standard_serving_g: menu.standard_serving_g,
    nutrition_per_100g: {
      calories_kcal: menu.calories_per_100g,
      carbohydrate_g: menu.carbohydrate_per_100g,
      protein_g: menu.protein_per_100g,
      fat_g: menu.fat_per_100g,
    },
    ingredients: [...(menu.ingredients || [])],
    allergens: [...(menu.allergen_codes || [])],
  };
}

function shiftDateKey(dateKey, dayOffset) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return getLocalDateKey(date);
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
    // 로컬 mock 저장 실패가 화면 조회를 막지 않도록 합니다.
  }
}

const mockTimestamp = "2026-07-13T03:00:00Z";

const mockAllergens = [
  { id: 1, code: "EGGS", name_ko: "난류", display_number: 1, description: null, is_active: true },
  { id: 2, code: "MILK", name_ko: "우유", display_number: 2, description: null, is_active: true },
  { id: 3, code: "SOYBEAN", name_ko: "대두", display_number: 5, description: null, is_active: true },
  { id: 4, code: "WHEAT", name_ko: "밀", display_number: 6, description: null, is_active: true },
  { id: 5, code: "PEANUT", name_ko: "땅콩", display_number: 4, description: null, is_active: true },
];

const mockMenus = [
  {
    id: 1,
    name: "현미밥",
    standard_serving_g: 180,
    calories_per_100g: 145,
    carbohydrate_per_100g: 31,
    protein_per_100g: 3,
    fat_per_100g: 1,
    is_active: true,
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    ingredients: ["현미", "쌀"],
    allergen_codes: [],
  },
  {
    id: 5,
    name: "제육볶음",
    standard_serving_g: 120,
    calories_per_100g: 220,
    carbohydrate_per_100g: 12,
    protein_per_100g: 18,
    fat_per_100g: 11,
    is_active: true,
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    ingredients: ["돼지고기", "양파", "고추장", "간장"],
    allergen_codes: ["SOYBEAN", "WHEAT"],
  },
  {
    id: 8,
    name: "계절 채소무침",
    standard_serving_g: 80,
    calories_per_100g: 62,
    carbohydrate_per_100g: 8,
    protein_per_100g: 2,
    fat_per_100g: 3,
    is_active: true,
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    ingredients: ["오이", "당근", "양배추"],
    allergen_codes: [],
  },
  {
    id: 10,
    name: "콩나물국",
    standard_serving_g: 200,
    calories_per_100g: 25,
    carbohydrate_per_100g: 2,
    protein_per_100g: 2,
    fat_per_100g: 1,
    is_active: true,
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    ingredients: ["콩나물", "대파"],
    allergen_codes: ["SOYBEAN"],
  },
];

const mockTodayMeal = {
  id: 10,
  meal_date: "2026-07-13",
  meal_type: "LUNCH",
  school_name: "국민대학교",
  created_at: mockTimestamp,
  updated_at: mockTimestamp,
  menu_items: mockMenus.map((menu, index) => toMealMenuItem(menu, 101 + index)),
};

function makeMockMeal(id, date, menuIds) {
  return {
    id,
    meal_date: date,
    meal_type: "LUNCH",
    school_name: "국민대학교",
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    menu_items: menuIds.map((menuId, index) => toMealMenuItem(
      mockMenus.find((menu) => menu.id === menuId),
      id * 10 + index + 1,
    )),
  };
}

const mockItemNutrition = {
  1: { estimated_consumed_g: 154.8, calories_kcal: 224.46, carbohydrate_g: 47.99, protein_g: 4.64, fat_g: 1.55, is_estimated: true },
  5: { estimated_consumed_g: 84, calories_kcal: 184.8, carbohydrate_g: 10.08, protein_g: 15.12, fat_g: 9.24, is_estimated: true },
  8: { estimated_consumed_g: 44, calories_kcal: 27.28, carbohydrate_g: 3.52, protein_g: 0.88, fat_g: 1.32, is_estimated: true },
  10: { estimated_consumed_g: 152, calories_kcal: 38, carbohydrate_g: 3.04, protein_g: 3.04, fat_g: 1.52, is_estimated: true },
};

function makeMockItem({ id, recordId, mealMenuItemId, menuId, ratio, level, confidence = 0.88, corrected = false }) {
  const menu = mockMenus.find((item) => item.id === menuId);
  return {
    id,
    meal_record_id: recordId,
    meal_menu_item_id: mealMenuItemId,
    menu_id: menuId,
    menu_name: menu.name,
    consumed_ratio: ratio,
    consumed_percent: Math.round(ratio * 10000) / 100,
    consumption_level: level,
    confidence: corrected ? null : confidence,
    is_corrected: corrected,
    corrected_at: corrected ? mockTimestamp : null,
    corrected_by: corrected ? 1 : null,
    note: null,
    analysis_type: "MOCK",
    nutrition: structuredClone(mockItemNutrition[menuId]),
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
  };
}

function makeMockRecord(id, meal, itemRecords, images = []) {
  return {
    id,
    user_id: 1,
    meal_id: meal.id,
    status: "COMPLETED",
    started_at: mockTimestamp,
    completed_at: mockTimestamp,
    failure_reason: null,
    created_at: mockTimestamp,
    updated_at: mockTimestamp,
    meal,
    images,
    item_records: itemRecords,
  };
}

const firstMeal = structuredClone(mockTodayMeal);
const secondMeal = makeMockMeal(9, "2026-07-12", [1, 5]);
const thirdMeal = makeMockMeal(8, "2026-07-11", [1, 8]);
const fourthMeal = makeMockMeal(7, "2026-07-10", [5, 10]);
const fifthMeal = makeMockMeal(6, "2026-07-09", [1, 8]);

const mockBeforeImageUrl = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80";
const mockAfterImageUrl = "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80";

const mockRecentRecords = [
  makeMockRecord(100, firstMeal, [
    makeMockItem({ id: 501, recordId: 100, mealMenuItemId: 102, menuId: 5, ratio: 0.7, level: "MOST", corrected: true }),
    makeMockItem({ id: 502, recordId: 100, mealMenuItemId: 101, menuId: 1, ratio: 0.86, level: "MOST" }),
    makeMockItem({ id: 503, recordId: 100, mealMenuItemId: 103, menuId: 8, ratio: 0.55, level: "HALF", confidence: 0.62 }),
    makeMockItem({ id: 504, recordId: 100, mealMenuItemId: 104, menuId: 10, ratio: 0.76, level: "MOST" }),
  ]),
  makeMockRecord(99, secondMeal, [
    makeMockItem({ id: 491, recordId: 99, mealMenuItemId: 91, menuId: 1, ratio: 0.9, level: "MOST" }),
    makeMockItem({ id: 492, recordId: 99, mealMenuItemId: 92, menuId: 5, ratio: 0.78, level: "MOST" }),
  ]),
  makeMockRecord(98, thirdMeal, [
    makeMockItem({ id: 481, recordId: 98, mealMenuItemId: 81, menuId: 1, ratio: 0.82, level: "MOST" }),
    makeMockItem({ id: 482, recordId: 98, mealMenuItemId: 82, menuId: 8, ratio: 0.68, level: "MOST" }),
  ]),
  makeMockRecord(97, fourthMeal, [
    makeMockItem({ id: 471, recordId: 97, mealMenuItemId: 71, menuId: 5, ratio: 0.6, level: "MOST" }),
    makeMockItem({ id: 472, recordId: 97, mealMenuItemId: 72, menuId: 10, ratio: 0.8, level: "MOST" }),
  ]),
  makeMockRecord(96, fifthMeal, [
    makeMockItem({ id: 461, recordId: 96, mealMenuItemId: 61, menuId: 1, ratio: 0.88, level: "MOST" }),
    makeMockItem({ id: 462, recordId: 96, mealMenuItemId: 62, menuId: 8, ratio: 0.82, level: "MOST" }),
  ]),
];

const mockRecordDetails = Object.fromEntries(mockRecentRecords.map((record) => [record.id, record]));
const mockAnalyses = Object.fromEntries(mockRecentRecords.map((record) => [record.id, {
  meal_record_id: record.id,
  analysis_type: "MOCK",
  analysis_note: "메뉴별 섭취율 분석 결과입니다.",
  items: record.item_records,
}]));

const mockRecommendationTemplates = {
  1: { level: "NORMAL", ratio: 1, grams: 180, reason: "20대·175cm·68kg 사용자의 점심 권장 에너지와 탄수화물 목표를 반영한 결과입니다." },
  5: { level: "NORMAL", ratio: 0.92, grams: 110, reason: "20대·175cm·68kg 사용자의 점심 단백질 및 지방 권장량을 반영한 결과입니다." },
  8: { level: "NORMAL", ratio: 0.88, grams: 70, reason: "20대·175cm·68kg 사용자의 점심 영양 균형을 반영한 채소 권장량입니다." },
  10: { level: "LESS", ratio: 0.9, grams: 180, reason: "20대·175cm·68kg 사용자의 점심 영양 목표와 메뉴 구성을 반영한 결과입니다." },
};

function getMockRecommendations(mealId) {
  const meal = getMockTodayMeal();
  return {
    meal_id: Number(mealId),
    items: meal.menu_items.map((menu) => {
      const template = mockRecommendationTemplates[menu.menu_id] || {
        level: "NORMAL",
        ratio: 1,
        grams: menu.standard_serving_g,
        reason: "사용자의 나잇대·키·몸무게와 점심 권장 영양소를 반영한 결과입니다.",
      };
      return {
        meal_id: Number(mealId),
        meal_menu_item_id: menu.meal_menu_item_id,
        menu_id: menu.menu_id,
        menu_name: menu.name,
        standard_serving_g: menu.standard_serving_g,
        recommendation_level: template.level,
        recommended_serving_ratio: template.ratio,
        recommended_serving_g: template.grams,
        recent_average_consumed_ratio: null,
        sample_count: 0,
        reason: template.reason,
      };
    }),
  };
}

const mockUploadAnalysisTemplates = {
  1: { consumed_ratio: 0.86, consumed_percent: 86, consumption_level: "MOST", confidence: 0.91, nutrition: { estimated_consumed_g: 154.8, calories_kcal: 224.46, carbohydrate_g: 47.99, protein_g: 4.64, fat_g: 1.55, is_estimated: true } },
  5: { consumed_ratio: 0.7, consumed_percent: 70, consumption_level: "MOST", confidence: 0.87, nutrition: { estimated_consumed_g: 84, calories_kcal: 184.8, carbohydrate_g: 10.08, protein_g: 15.12, fat_g: 9.24, is_estimated: true } },
  8: { consumed_ratio: 0.55, consumed_percent: 55, consumption_level: "HALF", confidence: 0.62, nutrition: { estimated_consumed_g: 44, calories_kcal: 27.28, carbohydrate_g: 3.52, protein_g: 0.88, fat_g: 1.32, is_estimated: true } },
  10: { consumed_ratio: 0.76, consumed_percent: 76, consumption_level: "MOST", confidence: 0.89, nutrition: { estimated_consumed_g: 152, calories_kcal: 38, carbohydrate_g: 3.04, protein_g: 3.04, fat_g: 1.52, is_estimated: true } },
};

const mockAdminDashboard = {
  date: "2026-07-13",
  active_user_count: 120,
  meal_record_count: 95,
  completed_analysis_count: 90,
  failed_analysis_count: 5,
  average_consumed_ratio: 0.74,
  average_leftover_ratio: 0.26,
};

const mockLeftoverSummary = [
  { menu_id: 5, menu_name: "제육볶음", average_consumed_ratio: 0.63, average_leftover_ratio: 0.37, analysis_count: 35 },
  { menu_id: 1, menu_name: "현미밥", average_consumed_ratio: 0.84, average_leftover_ratio: 0.16, analysis_count: 42 },
  { menu_id: 8, menu_name: "계절 채소무침", average_consumed_ratio: 0.58, average_leftover_ratio: 0.42, analysis_count: 31 },
  { menu_id: 10, menu_name: "콩나물국", average_consumed_ratio: 0.76, average_leftover_ratio: 0.24, analysis_count: 28 },
];
