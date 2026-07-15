import { api, getLocalDateKey } from "../api.js";
import {
  debugLog,
  escapeHtml,
  formatMealType,
  hide,
  initShell,
  readUser,
  show,
  showError,
  text,
} from "../common.js";

const weekForm = document.querySelector("#menu-week-form");
const dateInput = document.querySelector("#menu-week-date");
const previousWeekButton = document.querySelector("#previous-week");
const currentWeekButton = document.querySelector("#current-week");
const nextWeekButton = document.querySelector("#next-week");
const controls = [
  weekForm.querySelector('button[type="submit"]'),
  previousWeekButton,
  currentWeekButton,
  nextWeekButton,
];

let anchorDate = getInitialDate();

init();

function init() {
  debugLog("MENU", "페이지 초기화");
  initMenuShell();
  dateInput.value = anchorDate;
  weekForm.addEventListener("submit", handleWeekSubmit);
  previousWeekButton.addEventListener("click", () => moveWeek(-7));
  currentWeekButton.addEventListener("click", () => selectDate(getLocalDateKey()));
  nextWeekButton.addEventListener("click", () => moveWeek(7));
  loadWeek();
}

function initMenuShell() {
  const user = api.hasSession() ? readUser() : null;

  if (user) {
    document.querySelector("[data-user-name]").hidden = false;
    document.querySelector("[data-logout]").hidden = false;
    document.querySelector("#menu-login-link").hidden = true;
    initShell(user);
    return;
  }

  document.querySelectorAll('[data-nav="menu"]').forEach((link) => {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  });
}

function handleWeekSubmit(event) {
  event.preventDefault();
  selectDate(dateInput.value);
}

function moveWeek(days) {
  selectDate(shiftDateKey(anchorDate, days));
}

function selectDate(dateKey) {
  anchorDate = isDateKey(dateKey) ? dateKey : getLocalDateKey();
  dateInput.value = anchorDate;
  loadWeek();
}

async function loadWeek() {
  const week = getWeek(anchorDate);
  debugLog("MENU", "주간 급식 조회 시작", { startDate: week.startDate, endDate: week.endDate });
  setControlsDisabled(true);
  document.querySelector("#menu-loading").innerHTML = `
    <span class="spinner" aria-hidden="true"></span>
    <strong>주간 급식 메뉴를 불러오고 있습니다.</strong>`;
  show("menu-loading");
  hide("menu-content");

  try {
    const result = await api.getMealsForWeek({
      dates: week.days,
      mealType: "LUNCH",
    });
    renderWeek(week, result);
    updateAddress(anchorDate);
    hide("menu-loading");
    show("menu-content");
    debugLog("MENU", "주간 급식 조회 완료", {
      requestCount: result.requestedCount,
      mealCount: result.meals.length,
      mismatchCount: result.mismatchCount,
      failureCount: result.failureCount,
    });
  } catch (error) {
    debugLog("MENU", "주간 급식 조회 실패", { message: error.message });
    showError("menu-loading", error.message, loadWeek);
  } finally {
    setControlsDisabled(false);
  }
}

function renderWeek(week, result) {
  const meals = Array.isArray(result.meals) ? result.meals : [];
  const mealsByDate = new Map(meals.map((meal) => [meal.date, meal]));
  const schoolNames = [...new Set(meals.map((meal) => meal.schoolName).filter(Boolean))];
  const context = schoolNames.length ? `${schoolNames.join(", ")}의 조회 가능한 점심 메뉴입니다.` : "선택한 주의 점심 메뉴를 확인하세요.";

  text("meal-summary-title", formatWeekTitle(week.startDate, week.endDate));
  text("meal-summary-description", context);
  text("menu-anchor-date", formatKoreanDate(anchorDate, true));
  text("menu-week-range", formatWeekRange(week.startDate, week.endDate));
  text("menu-meal-type", formatMealType("LUNCH"));
  text("menu-count", `${meals.length}일 등록`);

  const notice = document.querySelector("#weekly-api-notice");
  const notices = [];
  if (result.mismatchCount) notices.push(`요청 날짜와 다른 날짜로 응답한 ${result.mismatchCount}건은 제외했습니다.`);
  if (result.failureCount) notices.push(`응답하지 않은 ${result.failureCount}건은 빈 날짜로 표시했습니다.`);
  if (notices.length) {
    notice.textContent = notices.join(" ");
    notice.hidden = false;
  } else {
    notice.hidden = true;
  }

  document.querySelector("#weekly-menu-grid").innerHTML = week.days
    .map((dateKey) => renderDayCard(dateKey, mealsByDate.get(dateKey)))
    .join("");
}

function renderDayCard(dateKey, meal) {
  const menuItems = Array.isArray(meal?.menuItems) ? meal.menuItems : [];
  const isToday = dateKey === getLocalDateKey();
  const isSelected = dateKey === anchorDate;
  const classes = ["weekly-day-card", isToday ? "is-today" : "", isSelected ? "is-selected" : ""].filter(Boolean).join(" ");

  return `<article class="${classes}">
    <header class="weekly-day-heading">
      <div><span>${formatWeekday(dateKey)}</span><strong>${formatKoreanDate(dateKey)}</strong></div>
      <div class="weekly-day-badges">${isToday ? "<em>오늘</em>" : ""}${isSelected ? "<em>선택일</em>" : ""}</div>
    </header>
    ${menuItems.length
      ? `<p class="weekly-school-name">${escapeHtml(meal.schoolName || "제공 기관 미등록")}</p>
        <ul class="weekly-menu-items">${menuItems.map(renderMenuItem).join("")}</ul>`
      : `<div class="weekly-day-empty"><strong>조회된 급식이 없습니다.</strong><span>아직 급식 메뉴가 등록되지 않았어요.</span></div>`}
  </article>`;
}

function renderMenuItem(menu) {
  const allergens = normalizeTextList(menu.allergens);

  return `<li class="weekly-menu-item">
    <div class="weekly-menu-item-title"><strong>${escapeHtml(menu.name || "메뉴명 미등록")}</strong><span>${formatAmount(menu.standardServingG, "g")}</span></div>
    ${allergens.length ? `<div class="menu-allergen-tags">${allergens.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
  </li>`;
}

function normalizeTextList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => typeof value === "object" ? value.name || value.code : value)
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function formatAmount(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(amount)}${unit}`;
}

function getInitialDate() {
  const date = new URLSearchParams(globalThis.location?.search || "").get("date");
  return isDateKey(date) ? date : getLocalDateKey();
}

function getWeek(dateKey) {
  const date = parseDateKey(dateKey);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const startDate = shiftDateKey(dateKey, -mondayOffset);
  const days = Array.from({ length: 7 }, (_, index) => shiftDateKey(startDate, index));
  return { startDate, endDate: days[6], days };
}

function shiftDateKey(dateKey, days) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return parseDateKey(value).toISOString().slice(0, 10) === value;
}

function formatKoreanDate(dateKey, includeWeekday = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    ...(includeWeekday ? { weekday: "short" } : {}),
  }).format(parseDateKey(dateKey));
}

function formatWeekday(dateKey) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "UTC", weekday: "long" }).format(parseDateKey(dateKey));
}

function formatWeekRange(startDate, endDate) {
  return `${formatKoreanDate(startDate)} - ${formatKoreanDate(endDate)}`;
}

function formatWeekTitle(startDate, endDate) {
  const year = parseDateKey(startDate).getUTCFullYear();
  return `${year}년 ${formatWeekRange(startDate, endDate)}`;
}

function setControlsDisabled(disabled) {
  controls.forEach((control) => { control.disabled = disabled; });
  dateInput.disabled = disabled;
}

function updateAddress(dateKey) {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("date", dateKey);
  globalThis.history.replaceState(null, "", url);
}
