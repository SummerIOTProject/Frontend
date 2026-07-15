import { api } from "../api.js";
import {
  debugLog,
  escapeHtml,
  formatDate,
  formatMealType,
  hide,
  initShell,
  requireUser,
  show,
  showError,
  statusBadge,
  text,
} from "../common.js";

init();

async function init() {
  debugLog("DASHBOARD", "페이지 초기화");
  const user = await requireUser();
  if (!user) return;
  initShell(user);
  await loadDashboard();
}

async function loadDashboard() {
  debugLog("DASHBOARD", "데이터 조회 시작");
  const loading = document.querySelector("#dashboard-loading");
  loading.innerHTML = '<span class="spinner"></span><strong>오늘의 급식 정보를 준비하고 있습니다.</strong>';
  show("dashboard-loading");
  hide("dashboard-content");

  try {
    const data = await api.getDashboard();
    renderTodayMeal(data.todayMeal);
    renderRecommendations(data.recommendations);
    renderRecentMeals(data.recent);
    hide("dashboard-loading");
    show("dashboard-content");
    debugLog("DASHBOARD", "데이터 표시 완료", {
      menuCount: data.todayMeal?.menuItems?.length || 0,
      recommendationCount: data.recommendations?.length || 0,
      recentRecordCount: data.recent?.records?.length || 0,
    });
  } catch (error) {
    debugLog("DASHBOARD", "데이터 조회 실패", { message: error.message });
    showError("dashboard-loading", error.message, loadDashboard);
  }
}

function renderTodayMeal(meal) {
  debugLog("DASHBOARD", "오늘 급식 렌더링", { mealId: meal?.mealId, menuCount: meal?.menuItems?.length || 0 });
  if (!meal) {
    text("today-date", "오늘 등록된 급식이 없습니다.");
    text("today-meal-context", "급식 정보 없음");
    document.querySelector("#today-menu-list").innerHTML = emptyListItem("등록된 메뉴가 없습니다.");
    return;
  }

  text("today-date", [safeDate(meal.date), formatMealType(meal.mealType), meal.schoolName].filter(Boolean).join(" · "));
  text("today-meal-context", `${formatMealType(meal.mealType)} · ${meal.schoolName || "제공 기관 미등록"}`);

  const menus = Array.isArray(meal.menuItems) ? meal.menuItems : [];
  document.querySelector("#today-menu-list").innerHTML = menus.length
    ? menus.map((menu, index) => `
      <li>
        <em>${String(index + 1).padStart(2, "0")}</em>
        <div>
          <strong>${escapeHtml(menu.name)}</strong>
          <small>${escapeHtml(allergenLabel(menu.allergens))}</small>
        </div>
        <span>${formatGrams(menu.standardServingG)}</span>
      </li>`).join("")
    : emptyListItem("등록된 메뉴가 없습니다.");
}

function renderRecommendations(items = []) {
  debugLog("DASHBOARD", "권장 배식량 렌더링", { count: items.length });
  const container = document.querySelector("#recommendation-list");
  const recommendations = Array.isArray(items) ? items : [];
  container.innerHTML = recommendations.length
    ? recommendations.map(recommendationRow).join("")
    : emptyState("오늘 제공된 권장 배식량이 없습니다.");
}

function recommendationRow(item) {
  const unavailable = item.available === false
    || item.recommendedServingG === null
    || item.recommendedServingG === undefined;
  const reason = item.reason || (unavailable
    ? "추천 배식량 데이터가 제공되지 않았습니다."
    : "추천 사유가 제공되지 않았습니다.");

  return `
    <article class="recommendation">
      <span class="round-icon">${unavailable ? "–" : "●"}</span>
      <div>
        <strong>${escapeHtml(item.menuName)}</strong>
        <small>기준 ${formatGrams(item.standardServingG)} · 개인 영양 기준 적용</small>
        <small>${escapeHtml(reason)}</small>
      </div>
      <b>${unavailable ? "추천 데이터 없음" : formatGrams(item.recommendedServingG)}</b>
    </article>`;
}

function renderRecentMeals(recent) {
  const records = Array.isArray(recent?.records) ? recent.records : [];
  debugLog("DASHBOARD", "최근 식사 기록 렌더링", { count: records.length });
  const period = recent?.period;
  text(
    "recent-period",
    period?.startDate && period?.endDate
      ? `${safeDate(period.startDate)}부터 ${safeDate(period.endDate)}까지 · 최근 ${period.days}일`
      : "최근 식사 기록",
  );

  document.querySelector("#recent-meals").innerHTML = records.length
    ? records.map(recentMealRow).join("")
    : emptyState("최근 식사 기록이 없습니다.");
}

function recentMealRow(record) {
  const date = new Date(record.date);
  const validDate = !Number.isNaN(date.getTime());
  const items = Array.isArray(record.items) ? record.items : [];
  const menuNames = items.map((item) => item.menuName).filter(Boolean).join(", ") || "메뉴 정보 없음";
  const intakeSummary = items.map((item) => `${item.menuName} ${formatPercent(item.consumedPercent)}`).join(" · ");
  const corrected = items.some((item) => item.isCorrected);

  return `
    <a class="history-row" href="/meal.html?id=${encodeURIComponent(record.recordId)}" aria-label="${escapeHtml(menuNames)} 식사 기록 상세 보기">
      <span class="date-box">
        <b>${validDate ? date.getDate() : "-"}</b>
        <small>${validDate ? new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(date) : "날짜 없음"}</small>
      </span>
      <span>
        <strong>${escapeHtml(menuNames)}</strong>
        <small>${escapeHtml([formatMealType(record.mealType), intakeSummary, corrected ? "사용자 보정" : ""].filter(Boolean).join(" · "))}</small>
      </span>
      ${statusBadge(record.status)}
      <em>›</em>
    </a>`;
}

function allergenLabel(allergens) {
  if (!Array.isArray(allergens) || allergens.length === 0) return "알레르기 정보 없음";
  const names = allergens.map((item) => typeof item === "object" ? item.name : item).filter(Boolean);
  return names.length ? `알레르기: ${names.join(", ")}` : "알레르기 정보 없음";
}

function safeDate(value) {
  try {
    return value ? formatDate(value) : "날짜 미등록";
  } catch {
    return "날짜 미등록";
  }
}

function formatGrams(value) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}g` : "-";
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const percent = Number(value);
  return Number.isFinite(percent) ? `${percent.toLocaleString("ko-KR")}%` : "-";
}

function emptyState(message) {
  return `<div class="state compact"><strong>${escapeHtml(message)}</strong></div>`;
}

function emptyListItem(message) {
  return `<li><em>--</em><div><strong>${escapeHtml(message)}</strong></div><span>-</span></li>`;
}
