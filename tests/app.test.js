import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  MAX_IMAGE_SIZE,
  api,
  buildAdminMealPayload,
  buildMealImageFormData,
  buildMenuCreatePayload,
  buildQuery,
  endpoints,
  getLocalDateKey,
  getStoredAuth,
  isTerminalStatus,
  requestApi,
  validateMealImage,
} from "../src/api.js";

const adminHtml = readFileSync(resolve(process.cwd(), "admin.html"), "utf8");
const uploadHtml = readFileSync(resolve(process.cwd(), "upload.html"), "utf8");
const mealPageSource = readFileSync(resolve(process.cwd(), "src/pages/meal.js"), "utf8");

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function loadRealApi(fetchImpl) {
  vi.resetModules();
  vi.stubEnv("VITE_USE_MOCK_API", "false");
  vi.stubEnv("VITE_API_BASE_URL", "https://backend.example");
  vi.stubGlobal("fetch", fetchImpl);
  return import("../src/api.js");
}

describe("Backend API contract", () => {
  it("uses the documented user and administrator paths", () => {
    expect(endpoints.login).toBe("/api/v1/auth/login");
    expect(endpoints.todayMeal).toBe("/api/v1/meals/today");
    expect(endpoints.mealRecords).toBe("/api/v1/me/meal-records");
    expect(endpoints.deviceMealRecords).toBe("/api/v1/device/meal-records");
    expect(endpoints.mealRecordImage(100, "BEFORE")).toBe("/api/v1/me/meal-records/100/images/before");
    expect(endpoints.analyzeMealRecord(100)).toBe("/api/v1/me/meal-records/100/analyze");
    expect(endpoints.reanalyzeMealRecord(100)).toBe("/api/v1/me/meal-records/100/reanalyze");
    expect(endpoints.mealAnalysis).toBeUndefined();
    expect(endpoints.consumedRatio(501)).toBe("/api/v1/me/meal-item-records/501/consumed-ratio");
    expect(endpoints.leftoverSummary).toBe("/api/v1/admin/leftover-summary");
    expect(Object.values(endpoints).filter((value) => typeof value === "string").join(" ")).toContain("/device/");
  });

  it("maps the latest backend list wrappers and token fields", async () => {
    const response = (data) => new Response(JSON.stringify({ success: true, message: "ok", data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({
        access_token: "access",
        refresh_token: "refresh",
        token_type: "bearer",
        access_token_expires_in: 3600,
        refresh_token_expires_in_days: 14,
      }))
      .mockResolvedValueOnce(response([
        { id: 1, code: "EGGS", name_ko: "난류", display_number: 1, description: null, is_active: true },
      ]))
      .mockResolvedValueOnce(response({
        items: [{ id: 10, meal_date: "2026-07-14", meal_type: "LUNCH", school_name: "국민대학교", menu_items: [] }],
        total: 1,
      }))
      .mockResolvedValueOnce(response({
        start_date: "2026-07-14",
        end_date: "2026-07-14",
        items: [{
          id: 100,
          meal_id: 10,
          status: "CREATED",
          started_at: "2026-07-14T03:00:00Z",
          meal: { id: 10, meal_date: "2026-07-14", meal_type: "LUNCH", school_name: "국민대학교", menu_items: [] },
          item_records: [],
        }],
        total: 1,
      }));
    const { api: realApi, getStoredAuth: getRealStoredAuth } = await loadRealApi(fetchImpl);

    await realApi.login({ loginId: "student01", password: "Password123!" });
    expect(getRealStoredAuth()).toMatchObject({ accessTokenExpiresIn: 3600, refreshTokenExpiresInDays: 14 });
    await expect(realApi.getAllergens()).resolves.toMatchObject([{ id: 1, name: "난류" }]);
    await expect(realApi.getTodayMeal()).resolves.toMatchObject({ mealId: 10, mealType: "LUNCH" });
    await expect(realApi.getRecentMealRecords(1)).resolves.toMatchObject({
      period: { days: 1, startDate: "2026-07-14", endDate: "2026-07-14" },
      records: [{ recordId: 100, mealId: 10, status: "CREATED" }],
    });
    expect(fetchImpl.mock.calls[3][0]).toBe("https://backend.example/api/v1/me/meal-records/recent?days=1");
  });

  it("builds only supported query parameters", () => {
    expect(buildQuery({ start_date: "2026-07-01", end_date: "2026-07-13", meal_type: "" }))
      .toBe("?start_date=2026-07-01&end_date=2026-07-13");
  });

  it("unwraps successful envelopes and preserves common API errors", async () => {
    const success = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      message: "정상",
      data: { status: "UP" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(requestApi("/health", { auth: false }, success)).resolves.toEqual({ status: "UP" });

    const failure = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
      error: { code: "USER_NOT_FOUND", detail: "해당 사용자가 존재하지 않습니다." },
    }), { status: 404, headers: { "Content-Type": "application/json" } }));

    try {
      await requestApi("/api/v1/me", { auth: false }, failure);
      throw new Error("The request should have failed.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 404, code: "USER_NOT_FOUND", detail: "해당 사용자가 존재하지 않습니다." });
    }
  });

  it("stores tokens and resolves the current role through the profile API", async () => {
    await api.login({ loginId: "student01", password: "Password123!" });
    expect(getStoredAuth()).toMatchObject({ tokenType: "bearer", mockLoginId: "student01" });
    await expect(api.getCurrentUser()).resolves.toMatchObject({ loginId: "student01", role: "STUDENT" });

    await api.login({ loginId: "admin01", password: "Password123!" });
    await expect(api.getCurrentUser()).resolves.toMatchObject({ loginId: "admin01", role: "ADMIN" });
  });

  it("adds the bearer token and refreshes it after an unauthorized response", async () => {
    await api.login({ loginId: "student01", password: "Password123!" });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: false,
        message: "토큰이 만료되었습니다.",
        error: { code: "TOKEN_EXPIRED", detail: "" },
      }), { status: 401, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        message: "토큰이 재발급되었습니다.",
        data: {
          access_token: "new-access",
          refresh_token: "new-refresh",
          token_type: "bearer",
          access_token_expires_in: 3600,
          refresh_token_expires_in_days: 14,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        message: "내 정보를 조회했습니다.",
        data: { id: 1 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(requestApi(endpoints.me, {}, fetchImpl)).resolves.toEqual({ id: 1 });
    expect(fetchImpl.mock.calls[0][1].headers.get("Authorization")).toContain("mock-access-student01");
    expect(fetchImpl.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new-access");
    expect(getStoredAuth().accessToken).toBe("new-access");
    expect(getStoredAuth().refreshToken).toBe("new-refresh");
  });
});

describe("User meal APIs", () => {
  it("returns today's meal using the documented meal response fields", async () => {
    const meal = await api.getTodayMeal();
    expect(meal).toMatchObject({ mealId: 10, date: getLocalDateKey(), mealType: "LUNCH" });
    expect(meal.menuItems[1]).toMatchObject({ menuId: 5, name: "제육볶음", standardServingG: 120 });
    expect(meal.menuItems[1].nutrition).toMatchObject({ caloriesKcal: 220, proteinG: 18 });
  });

  it("maps the backend allergen array and Korean display names", async () => {
    const allergens = await api.getAllergens();
    expect(allergens[0]).toMatchObject({ id: 1, code: "EGGS", name: "난류", displayNumber: 1, isActive: true });
  });

  it("composes the dashboard from today's meal, recent records, and recommendations", async () => {
    const dashboard = await api.getDashboard();
    expect(dashboard.todayMeal.menuItems.length).toBeGreaterThan(0);
    expect(dashboard.recent.records[0].recordId).toBe(100);
    expect(dashboard.recommendations[0]).toHaveProperty("recommendedServingG");
    expect(dashboard.recommendations.map((item) => item.menuId))
      .toEqual(dashboard.todayMeal.menuItems.map((item) => item.menuId));
  });

  it("uses prewritten nutrition-profile recommendations instead of preference history", async () => {
    const beforeCorrection = await api.getRecommendations(10);
    expect(beforeCorrection.recommendations).toHaveLength(4);
    expect(beforeCorrection.recommendations.every((item) => item.recentAverageConsumedRatio === null)).toBe(true);
    expect(beforeCorrection.recommendations.every((item) => item.sampleCount === 0)).toBe(true);
    expect(beforeCorrection.recommendations.map((item) => item.reason).join(" ")).toMatch(/20대|키|몸무게|영양/);
    expect(beforeCorrection.recommendations.map((item) => item.reason).join(" ")).not.toMatch(/선호|최근 5일|평균 섭취율/);

    await api.correctConsumedRatio(501, 0.2);
    const afterCorrection = await api.getRecommendations(10);
    expect(afterCorrection.recommendations.map((item) => item.recommendedServingG))
      .toEqual(beforeCorrection.recommendations.map((item) => item.recommendedServingG));
  });

  it("returns only lunch records and menu items for the recent five-day view", async () => {
    const data = await api.getRecentMealRecords(5);
    expect(data.period).toMatchObject({ days: 5, endDate: getLocalDateKey() });
    expect(data.records).toHaveLength(5);
    expect(data.records.every((record) => record.mealType === "LUNCH")).toBe(true);
    expect(data.records.every((record) => record.items.length > 0)).toBe(true);
  });

  it("validates images and creates the multipart file field", () => {
    const valid = new File(["meal"], "meal.jpg", { type: "image/jpeg" });
    const invalidType = new File(["meal"], "meal.gif", { type: "image/gif" });
    const oversized = new File([new Uint8Array(MAX_IMAGE_SIZE + 1)], "large.png", { type: "image/png" });
    expect(validateMealImage(valid)).toBeNull();
    expect(validateMealImage(invalidType)).toContain("JPG");
    expect(validateMealImage(oversized)).toContain("4MB");
    expect(buildMealImageFormData(valid).get("file")).toBe(valid);
  });

  it("stores an uploaded meal record and exposes its analysis through history", async () => {
    const before = new File(["before"], "before.jpg", { type: "image/jpeg" });
    const after = new File(["after"], "after.webp", { type: "image/webp" });
    const record = await api.prepareMealRecordForUpload(10);
    await api.uploadMealImage(record.recordId, "BEFORE", before);
    await api.uploadMealImage(record.recordId, "AFTER", after);
    const rawBeforeAnalysis = JSON.parse(localStorage.getItem("smartMealMockUploadedRecords"))[record.recordId];
    expect(rawBeforeAnalysis).toMatchObject({ id: record.recordId, status: "IMAGES_UPLOADED" });
    expect(rawBeforeAnalysis).toHaveProperty("meal");
    expect(rawBeforeAnalysis).toHaveProperty("images");
    expect(rawBeforeAnalysis).toHaveProperty("item_records");
    expect(rawBeforeAnalysis).not.toHaveProperty("meal_record_id");
    const analysis = await api.analyzeMealRecord(record.recordId);
    const rawAfterAnalysis = JSON.parse(localStorage.getItem("smartMealMockUploadedRecords"))[record.recordId];
    expect(rawAfterAnalysis.images).toEqual([]);
    const corrected = await api.correctConsumedRatio(analysis.items[0].itemRecordId, 0.5);
    const recent = await api.getRecentMealRecords(5);
    expect(analysis).toMatchObject({ recordId: record.recordId, status: "COMPLETED" });
    expect(corrected).toMatchObject({ consumedRatio: 0.5, consumedPercent: 50, isCorrected: true });
    expect(recent.records.some((item) => item.recordId === record.recordId)).toBe(true);
    await expect(api.getMealAnalysis(record.recordId)).resolves.toMatchObject({ recordId: record.recordId });
  });

  it("returns meal analysis data and stops polling at terminal statuses", async () => {
    const detail = await api.getMealRecordDetail(100);
    const analysis = await api.getMealAnalysis(100);
    expect(detail.status).toBe("COMPLETED");
    expect(analysis.items[0]).toMatchObject({ itemRecordId: 501, estimatedConsumedG: 84 });
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
    expect(isTerminalStatus("IMAGES_UPLOADED")).toBe(false);
    expect(isTerminalStatus("ANALYZING")).toBe(false);
  });

  it("corrects consumption using an item record ID and a ratio from zero to one", async () => {
    const corrected = await api.correctConsumedRatio(501, 0.5);
    expect(corrected).toMatchObject({ itemRecordId: 501, consumedRatio: 0.5, consumedPercent: 50, isCorrected: true });
    await expect(api.correctConsumedRatio(501, 1.1)).rejects.toMatchObject({ code: "INVALID_CONSUMED_RATIO" });
  });
});

describe("Administrator APIs", () => {
  it("returns the documented dashboard and leftover summary values", async () => {
    const dashboard = await api.getAdminDashboard("2026-07-13");
    const summary = await api.getLeftoverSummary({ startDate: "2026-07-01", endDate: "2026-07-13" });
    expect(dashboard).toMatchObject({ totalUsers: 120, mealRecordCount: 95, failedAnalysisCount: 5, averageConsumedRatio: 0.74 });
    expect(summary.menuSummary[0]).toMatchObject({ menuName: "제육볶음", averageLeftoverRatio: 0.37, analysisCount: 35 });
  });

  it("builds the exact menu creation request DTO", () => {
    expect(buildMenuCreatePayload({
      name: "제육볶음",
      standardServingG: 120,
      nutrition: { caloriesKcal: 220, carbohydrateG: 12, proteinG: 18, fatG: 11 },
      ingredients: ["돼지고기", "양파"],
      allergenCodes: ["SOYBEAN", "WHEAT"],
    })).toEqual({
      name: "제육볶음",
      standard_serving_g: 120,
      nutrition_per_100g: { calories_kcal: 220, carbohydrate_g: 12, protein_g: 18, fat_g: 11 },
      ingredients: ["돼지고기", "양파"],
      allergen_codes: ["SOYBEAN", "WHEAT"],
    });
  });

  it("builds and submits one lunch meal plan with individually selected menus", async () => {
    expect(buildAdminMealPayload({
      mealDate: "2026-07-20",
      mealType: "DINNER",
      schoolName: " 국민대학교 ",
      menuIds: ["1", "5"],
    })).toEqual({
      meal_date: "2026-07-20",
      meal_type: "LUNCH",
      school_name: "국민대학교",
      menu_ids: [1, 5],
    });
    const meal = await api.createAdminMeal({
      mealDate: "2026-07-20",
      schoolName: "국민대학교",
      menuIds: [1, 5],
    });
    expect(meal).toMatchObject({ date: "2026-07-20", mealType: "LUNCH" });
    expect(meal.menuItems.map((item) => item.menuId)).toEqual([1, 5]);
    const rawMeal = JSON.parse(localStorage.getItem("smartMealMockMealPlans"))[0];
    expect(rawMeal).toHaveProperty("id");
    expect(rawMeal.menu_items[0]).toHaveProperty("nutrition_per_100g");
    expect(rawMeal).not.toHaveProperty("meal_id");
  });

  it("creates a menu and exposes it through the menu list API", async () => {
    const created = await api.createAdminMenu({
      name: "테스트 메뉴",
      standardServingG: 100,
      nutrition: { caloriesKcal: 100, carbohydrateG: 10, proteinG: 5, fatG: 3 },
      ingredients: ["두부"],
      allergenCodes: ["SOYBEAN"],
    });
    const menus = await api.getMenus({ keyword: "테스트" });
    expect(created.name).toBe("테스트 메뉴");
    expect(menus.items).toHaveLength(1);
    expect(menus.items[0].allergens[0].code).toBe("SOYBEAN");
    const rawMenu = JSON.parse(localStorage.getItem("smartMealMockMenus"))[0];
    expect(rawMenu).toHaveProperty("id");
    expect(rawMenu).toHaveProperty("calories_per_100g", 100);
    expect(rawMenu).toHaveProperty("allergen_codes");
    expect(rawMenu).not.toHaveProperty("menu_id");
  });

  it("loads menu details and updates an existing menu", async () => {
    const existing = await api.getMenu(5);
    expect(existing.name).toBe("제육볶음");
    const updated = await api.updateAdminMenu(5, {
      name: "간장 제육볶음",
      standardServingG: 110,
      nutrition: { caloriesKcal: 210, carbohydrateG: 10, proteinG: 19, fatG: 10 },
      ingredients: ["돼지고기", "양파", "간장"],
      allergenCodes: ["SOYBEAN"],
    });
    expect(updated).toMatchObject({ menuId: 5, name: "간장 제육볶음", standardServingG: 110 });
    await expect(api.getMenu(5)).resolves.toMatchObject({ name: "간장 제육볶음" });
    const list = await api.getMenus({ keyword: "간장" });
    expect(list.items.some((item) => item.menuId === 5)).toBe(true);
  });
});

describe("Page structure", () => {
  it("combines new-menu input and dated lunch registration in one form", () => {
    const page = new DOMParser().parseFromString(adminHtml, "text/html");
    const form = page.querySelector("#meal-schedule-form");

    expect(form).not.toBeNull();
    expect(form.querySelector("#meal-menu-select")).not.toBeNull();
    expect(form.querySelector("#draft-menu-name")).not.toBeNull();
    expect(form.querySelector("#selected-meal-menu-list")).not.toBeNull();
    expect(form.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(page.querySelector("#menu-form #editing-menu-id")).not.toBeNull();
  });

  it("does not render deleted meal photos on the individual record page", () => {
    expect(mealPageSource).not.toMatch(/beforeImageUrl|afterImageUrl|renderPhotos|photo-compare/);
  });

  it("uses semantic photo and upload icons without an icon dependency", () => {
    const page = new DOMParser().parseFromString(uploadHtml, "text/html");

    expect(page.querySelectorAll(".camera-icon").length).toBeGreaterThanOrEqual(3);
    expect(page.querySelectorAll(".upload-symbol")).toHaveLength(2);
    expect([...page.querySelectorAll(".camera-icon, .upload-symbol")]
      .every((icon) => icon.getAttribute("aria-hidden") === "true" || icon.closest('[aria-hidden="true"]'))).toBe(true);
  });
});
