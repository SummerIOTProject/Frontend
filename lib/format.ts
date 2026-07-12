import type { MealStatus } from "./api/types";

export const statusLabels: Record<MealStatus, string> = {
  UPLOADING: "업로드 중",
  UPLOAD_COMPLETED: "업로드 완료",
  QUEUED: "분석 대기",
  ANALYZING: "분석 중",
  COMPLETED: "분석 완료",
  NEEDS_REVIEW: "사용자 확인 필요",
  FAILED: "분석 실패",
};

export function formatDate(value: string, withTime = false): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(value));
}

export function isTerminalStatus(status: MealStatus): boolean {
  return status === "COMPLETED" || status === "NEEDS_REVIEW" || status === "FAILED";
}
