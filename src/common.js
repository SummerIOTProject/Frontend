import "./styles.css";
import { api } from "./api.js";

const USER_KEY = "smartMealCurrentUser";
const shouldLog = import.meta.env.MODE !== "test";

export function debugLog(scope, event, details) {
  if (!shouldLog) return;
  const prefix = `[${scope}] ${event}`;
  if (details === undefined) console.log(prefix);
  else console.log(prefix, details);
}

export const statusLabels = {
  CREATED: "기록 생성",
  BEFORE_IMAGE_UPLOADED: "식전 사진 등록",
  IMAGES_UPLOADED: "사진 등록 완료",
  ANALYZING: "분석 중",
  COMPLETED: "분석 완료",
  FAILED: "분석 실패",
};

export function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function saveUser(user) {
  debugLog("AUTH", "사용자 캐시 저장", { userId: user.id, role: user.role });
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function clearUser() {
  debugLog("AUTH", "사용자 캐시 삭제");
  localStorage.removeItem(USER_KEY);
  // Remove the cache key used by the previous local-only login implementation.
  localStorage.removeItem("smartMealLocalUser");
}

export async function requireUser({ adminOnly = false } = {}) {
  debugLog("AUTH", "보호 페이지 접근 확인", { page: document.body.dataset.page, adminOnly });
  if (!api.hasSession()) {
    debugLog("AUTH", "세션 없음, 로그인 페이지로 이동");
    clearUser();
    location.replace("/index.html");
    return null;
  }

  let user = readUser();
  if (!user) {
    debugLog("AUTH", "사용자 캐시 없음, 내 정보 조회");
    try {
      user = saveUser(await api.getCurrentUser());
    } catch (error) {
      debugLog("AUTH", "내 정보 조회 실패", { message: error.message });
      clearUser();
      location.replace("/index.html");
      return null;
    }
  }

  if (adminOnly && user.role !== "ADMIN") {
    debugLog("AUTH", "관리자 권한 없음", { userId: user.id, role: user.role });
    location.replace("/dashboard.html");
    return null;
  }

  debugLog("AUTH", "보호 페이지 접근 허용", { userId: user.id, role: user.role });
  return user;
}

export function initShell(user) {
  const page = document.body.dataset.page;
  debugLog("SHELL", "공통 화면 초기화", { page, userId: user.id, role: user.role });

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user.name;
  });
  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = user.role !== "ADMIN";
  });
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  });
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      debugLog("SHELL", "로그아웃 버튼 선택", { page });
      button.disabled = true;
      try {
        await api.logout();
      } catch (error) {
        debugLog("SHELL", "서버 로그아웃 실패, 로컬 세션 정리", { message: error.message });
        // Local session data still has to be cleared when the server is unavailable.
      } finally {
        clearUser();
        location.href = "/index.html";
      }
    });
  });
}

export function statusBadge(status, id = "") {
  const safeStatus = String(status || "");
  return `<span${id ? ` id="${escapeHtml(id)}"` : ""} class="status status-${escapeHtml(safeStatus.toLowerCase())}">${escapeHtml(statusLabels[safeStatus] || safeStatus)}</span>`;
}

export function loadingMarkup(message = "정보를 불러오는 중입니다.") {
  return `<div class="state compact" role="status"><span class="spinner" aria-hidden="true"></span><strong>${escapeHtml(message)}</strong></div>`;
}

export function formatDate(value, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function formatMealType(mealType) {
  return ({ BREAKFAST: "아침", LUNCH: "점심", DINNER: "저녁", SNACK: "간식" })[mealType] || mealType || "-";
}

export function formatPercentRatio(ratio, maximumFractionDigits = 0) {
  const value = Number(ratio);
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    maximumFractionDigits,
  }).format(value);
}

export function text(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "";
}

export function hide(id) {
  document.getElementById(id)?.setAttribute("hidden", "");
}

export function show(id) {
  document.getElementById(id)?.removeAttribute("hidden");
}

export function showError(id, message, retry) {
  debugLog("UI", "오류 화면 표시", { targetId: id, message, retryAvailable: Boolean(retry) });
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = `<div class="state error"><span class="state-icon" aria-hidden="true">!</span><strong>정보를 불러오지 못했습니다.</strong><p>${escapeHtml(message)}</p>${retry ? '<button type="button" class="btn secondary">다시 시도</button>' : ""}</div>`;
  if (retry) element.querySelector("button")?.addEventListener("click", retry);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}
