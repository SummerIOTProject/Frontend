import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MealUploadView } from "@/features/meal-upload/meal-upload-view";
import { renderWithQuery } from "./test-utils";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("식사 사진 등록", () => {
  it("식사 전·후 사진이 모두 있을 때만 분석 요청을 활성화한다", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MealUploadView />);
    const submit = await screen.findByRole("button", { name: "등록한 사진으로 분석 요청" });
    expect(submit).toBeDisabled();
    await user.upload(screen.getByLabelText("식사 전 선택"), new File(["before"], "before.jpg", { type: "image/jpeg" }));
    expect(submit).toBeDisabled();
    await user.upload(screen.getByLabelText("식사 후 선택"), new File(["after"], "after.webp", { type: "image/webp" }));
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("모바일 너비에서도 핵심 등록 UI를 렌더링한다", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    renderWithQuery(<MealUploadView />);
    expect(await screen.findByRole("heading", { name: "식사 전·후 사진 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("식사 전 선택")).toBeInTheDocument();
    expect(screen.getByLabelText("식사 후 선택")).toBeInTheDocument();
  });
});
