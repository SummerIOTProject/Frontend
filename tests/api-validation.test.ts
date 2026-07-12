import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMealFormData } from "@/lib/api/meals";
import { MAX_IMAGE_SIZE, validateImageFile } from "@/lib/validation/image";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("오늘의 메뉴 API", () => {
  it("실제 API 성공 응답을 반환한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "false");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080");
    vi.resetModules();
    const payload = { date: "2026-07-12", restaurant: { id: "r1", name: "테스트 식당" }, menus: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { getTodayMenu } = await import("@/lib/api/menus");
    await expect(getTodayMenu()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/menus/today", expect.any(Object));
  });

  it("실제 API 실패를 오류로 전달한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK_API", "false");
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    const { getTodayMenu } = await import("@/lib/api/menus");
    await expect(getTodayMenu()).rejects.toMatchObject({ status: 503 });
  });
});

describe("이미지 검증", () => {
  it("지원하지 않는 형식을 거부한다", () => {
    expect(validateImageFile(new File(["data"], "meal.gif", { type: "image/gif" }))).toContain("JPG");
  });

  it("10MB를 초과한 파일을 거부한다", () => {
    const oversized = new File([new Uint8Array(MAX_IMAGE_SIZE + 1)], "meal.jpg", { type: "image/jpeg" });
    expect(validateImageFile(oversized)).toContain("10MB");
  });
});

it("식사 요청을 multipart/form-data로 구성한다", () => {
  const before = new File(["before"], "before.jpg", { type: "image/jpeg" });
  const after = new File(["after"], "after.png", { type: "image/png" });
  const data = buildMealFormData({ userId: "user-1", restaurantId: "rest-1", mealDate: "2026-07-12", menuIds: ["m1", "m2"], beforeImage: before, afterImage: after });
  expect(data.get("userId")).toBe("user-1");
  expect(data.getAll("menuIds")).toEqual(["m1", "m2"]);
  expect(data.get("beforeImage")).toBe(before);
  expect(data.get("afterImage")).toBe(after);
});
