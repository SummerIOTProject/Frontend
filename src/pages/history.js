import { api } from "../api.js";
import {
  debugLog,
  escapeHtml,
  formatDate,
  formatMealType,
  formatPercentRatio,
  initShell,
  loadingMarkup,
  requireUser,
  showError,
  statusBadge,
  text,
} from "../common.js";

const user = await requireUser();
const RECENT_DAYS = 5;
const FIXED_MEAL_TYPE = "LUNCH";

if (user) {
  debugLog("HISTORY", "페이지 초기화", { userId: user.id });
  initShell(user);
  initHistory();
}

function initHistory() {
  const results = document.querySelector("#history-results");

  loadRecords();

  async function loadRecords() {
    debugLog("HISTORY", "최근 점심 식사 기록 조회 시작", {
      days: RECENT_DAYS,
      mealType: FIXED_MEAL_TYPE,
    });
    text("history-period", `오늘 기준 최근 ${RECENT_DAYS}일 · 점심`);
    results.innerHTML = loadingMarkup("최근 5일간 점심 식사 기록을 불러오는 중입니다.");

    try {
      const data = await api.getRecentMealRecords(RECENT_DAYS);
      const records = (Array.isArray(data?.records) ? data.records : [])
        .filter((record) => !record.mealType || record.mealType === FIXED_MEAL_TYPE);
      debugLog("HISTORY", "최근 점심 식사 기록 조회 완료", {
        receivedCount: data?.records?.length || 0,
        displayedCount: records.length,
      });

      text("history-period", formatPeriod(data?.period));
      text("history-count", `${records.length}건`);
      results.innerHTML = records.length
        ? records.map(recordCard).join("")
        : `<div class="state compact">
            <strong>최근 5일간 점심 식사 기록이 없습니다.</strong>
            <p>식사 분석이 완료되면 메뉴별 섭취 기록이 여기에 표시됩니다.</p>
          </div>`;
    } catch (error) {
      debugLog("HISTORY", "최근 점심 식사 기록 조회 실패", { message: error.message });
      text("history-count", "-건");
      showError("history-results", error.message, loadRecords);
    }
  }
}

function formatPeriod(period) {
  if (!period?.startDate || !period?.endDate) {
    return `오늘 기준 최근 ${RECENT_DAYS}일 · 점심`;
  }

  try {
    return `${formatDate(period.startDate)}부터 ${formatDate(period.endDate)}까지 · 점심`;
  } catch {
    return `오늘 기준 최근 ${RECENT_DAYS}일 · 점심`;
  }
}

function recordCard(record) {
  const date = getDateParts(record.date);
  const itemSummary = buildItemSummary(record.items);
  const corrected = record.items?.some((item) => item.isCorrected);
  const mealType = record.mealType || FIXED_MEAL_TYPE;

  return `<a class="history-card" href="/meal.html?id=${encodeURIComponent(record.recordId)}"
      aria-label="${escapeHtml(formatDate(record.date))} ${escapeHtml(formatMealType(mealType))} 식사 기록 상세 보기">
    <span class="date-box"><b>${date.day}</b><small>${date.month}</small></span>
    <span class="grow">
      <strong>${itemSummary}</strong>
      <small>${escapeHtml(formatDate(record.date))} · ${escapeHtml(formatMealType(mealType))}</small>
      ${corrected ? "<i>사용자 보정</i>" : ""}
    </span>
    ${statusBadge(record.status)}
    <em aria-hidden="true">›</em>
  </a>`;
}

function buildItemSummary(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "메뉴 정보는 상세 화면에서 확인";
  }

  return items.map((item) => {
    const name = escapeHtml(item.menuName || "메뉴");
    const ratio = item.consumedPercent != null
      ? `${escapeHtml(item.consumedPercent)}%`
      : item.consumedRatio != null
        ? escapeHtml(formatPercentRatio(item.consumedRatio))
        : "";
    return ratio ? `${name} ${ratio}` : name;
  }).join(" · ");
}

function getDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "-", month: "-" };

  return {
    day: date.getDate(),
    month: new Intl.DateTimeFormat("ko-KR", { month: "short", weekday: "short" }).format(date),
  };
}
