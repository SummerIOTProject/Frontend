import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { MealHistoryView } from "@/features/meal-history/meal-history-view";
import { renderWithQuery } from "./test-utils";

it("메뉴 검색과 식당·상태 필터를 API 조건으로 적용한다", async () => {
  const user = userEvent.setup();
  renderWithQuery(<MealHistoryView />);
  expect(await screen.findByText("허브 닭구이")).toBeInTheDocument();

  const search = screen.getByLabelText("메뉴명 검색");
  await user.clear(search);
  await user.type(search, "토마토 펜네");
  await user.click(screen.getByRole("button", { name: "검색" }));
  await waitFor(() => expect(screen.getByText("토마토 펜네")).toBeInTheDocument());
  expect(screen.queryByText("허브 닭구이")).not.toBeInTheDocument();

  await user.selectOptions(screen.getByLabelText("분석 상태 필터"), "COMPLETED");
  await waitFor(() => expect(screen.getByText("조건에 맞는 식사 기록이 없습니다.")).toBeInTheDocument());
});
