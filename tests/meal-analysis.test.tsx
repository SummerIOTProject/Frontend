import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MealAnalysisView, getAnalysisPollingInterval } from "@/features/meal-analysis/meal-analysis-view";
import { renderWithQuery } from "./test-utils";

describe("분석 polling", () => {
  it("진행 상태에서 시작하고 완료·실패 상태에서 중단한다", () => {
    expect(getAnalysisPollingInterval("QUEUED")).toBe(2_000);
    expect(getAnalysisPollingInterval("ANALYZING")).toBe(2_000);
    expect(getAnalysisPollingInterval("COMPLETED")).toBe(false);
    expect(getAnalysisPollingInterval("FAILED")).toBe(false);
  });
});

describe("분석 결과 UI", () => {
  it("성공 결과와 메뉴별 수치, 낮은 신뢰도 배지를 표시한다", async () => {
    renderWithQuery(<MealAnalysisView mealId="meal-20260711-001" />);
    expect(await screen.findByRole("heading", { name: "식사 분석 결과" })).toBeInTheDocument();
    expect(screen.getAllByText("현미밥").length).toBeGreaterThan(0);
    expect(screen.getByText("158g")).toBeInTheDocument();
    expect(screen.getByText("29g")).toBeInTheDocument();
    expect(screen.getByText("확인 필요")).toBeInTheDocument();
  });

  it("실패 상태와 재시도 UI를 표시한다", async () => {
    renderWithQuery(<MealAnalysisView mealId="meal-20260706-001" />);
    expect(await screen.findByRole("heading", { name: "사진 분석에 실패했습니다." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상태 다시 확인" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "사진 다시 등록" })).toBeInTheDocument();
  });

  it("사용자 보정 요청을 저장한다", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MealAnalysisView mealId="meal-20260711-001" />);
    const save = await screen.findByRole("button", { name: "보정 결과 저장" });
    await user.click(save);
    await waitFor(() => expect(screen.getByText("보정 결과를 저장했습니다.")).toBeInTheDocument());
  });
});
