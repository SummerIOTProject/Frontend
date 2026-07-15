import { api, isTerminalStatus } from "../api.js";
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
  statusLabels,
} from "../common.js";

const POLL_INTERVAL_MS = 2000;
const recordId = new URLSearchParams(location.search).get("id");
const content = document.querySelector("#meal-content");
const user = await requireUser();
let pollTimer;

if (user) {
  debugLog("MEAL_DETAIL", "페이지 초기화", { recordId, userId: user.id });
  initShell(user);

  if (!recordId) {
    debugLog("MEAL_DETAIL", "식사 기록 ID 누락");
    showError("meal-content", "식사 기록 ID가 없습니다.", () => location.replace("/history.html"));
  } else {
    loadRecord();
  }
}

window.addEventListener("pagehide", stopPolling, { once: true });

async function loadRecord() {
  stopPolling();
  debugLog("MEAL_DETAIL", "식사 기록 상태 조회 시작", { recordId });

  try {
    const detail = await api.getMealRecordDetail(recordId);
    debugLog("MEAL_DETAIL", "식사 기록 상태 조회 완료", { recordId, status: detail.status });

    if (!isTerminalStatus(detail.status)) {
      renderProgress(detail);
      debugLog("MEAL_DETAIL", "다음 polling 예약", { recordId, intervalMs: POLL_INTERVAL_MS });
      pollTimer = window.setTimeout(loadRecord, POLL_INTERVAL_MS);
      return;
    }

    if (detail.status === "COMPLETED") {
      debugLog("MEAL_DETAIL", "분석 결과 화면 준비", { recordId, status: detail.status });
      await renderCompleted(detail);
      return;
    }

    renderFailure(detail);
  } catch (error) {
    debugLog("MEAL_DETAIL", "식사 기록 조회 실패", { recordId, message: error.message });
    showError("meal-content", error.message, loadRecord);
  }
}

function stopPolling() {
  if (pollTimer) {
    debugLog("MEAL_DETAIL", "polling 타이머 해제", { recordId });
    window.clearTimeout(pollTimer);
  }
  pollTimer = undefined;
}

function renderProgress(detail) {
  debugLog("MEAL_DETAIL", "진행 상태 렌더링", { recordId, status: detail.status });
  const status = escapeHtml(statusLabels[detail.status] || detail.status || "처리 중");
  const message = detail.status === "ANALYZING"
    ? "식사 사진을 분석하고 있습니다."
    : "분석에 필요한 정보를 준비하고 있습니다.";

  content.innerHTML = `<section class="analysis-state" role="status">
    <span class="spinner"></span>
    <span class="eyebrow">${status}</span>
    <h1>${message}</h1>
    <p>이 페이지를 닫아도 처리는 계속됩니다. 완료 여부를 자동으로 확인합니다.</p>
    <div class="analysis-steps" aria-label="분석 진행 단계">
      <span class="done">1 식사 기록</span>
      <span class="current">2 사진 처리</span>
      <span>3 분석 결과</span>
    </div>
  </section>`;
}

function renderFailure(detail) {
  debugLog("MEAL_DETAIL", "분석 실패 렌더링", { recordId, status: detail.status, message: detail.errorMessage });
  const message = detail.errorMessage || "분석을 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.";

  content.innerHTML = `<div class="state error">
    <span class="state-icon" aria-hidden="true">!</span>
    <h1>식사 분석에 실패했습니다.</h1>
    <p>${escapeHtml(message)}</p>
    <div class="flex flex-wrap justify-center gap-2 mt-3">
      <button type="button" class="btn secondary" id="retry-analysis">다시 확인</button>
      <a href="/history.html" class="btn primary">식사 기록으로 이동</a>
    </div>
  </div>`;
  document.querySelector("#retry-analysis").addEventListener("click", loadRecord);
}

async function renderCompleted(detail, savedMessage = "") {
  debugLog("MEAL_DETAIL", "분석·추천 데이터 조회 시작", { recordId, mealId: detail.mealId });
  content.innerHTML = loadingMarkup("분석 결과와 추천 배식량을 불러오는 중입니다.");

  const analysisPromise = api.getMealAnalysis(recordId);
  const recommendationPromise = detail.mealId != null
    ? api.getRecommendations(detail.mealId)
    : Promise.resolve({ recommendations: [] });
  const [analysisResult, recommendationResult] = await Promise.allSettled([
    analysisPromise,
    recommendationPromise,
  ]);

  if (analysisResult.status === "rejected") {
    debugLog("MEAL_DETAIL", "분석 결과 조회 실패", { recordId, message: analysisResult.reason?.message });
    showError("meal-content", analysisResult.reason?.message || "분석 결과를 불러오지 못했습니다.", loadRecord);
    return;
  }

  const recommendations = recommendationResult.status === "fulfilled"
    ? recommendationResult.value?.recommendations || []
    : [];
  const recommendationFailed = recommendationResult.status === "rejected";
  const items = mergeItems(detail.items, analysisResult.value?.items, recommendations);
  debugLog("MEAL_DETAIL", "분석 결과 병합 완료", {
    recordId,
    itemCount: items.length,
    recommendationCount: recommendations.length,
    recommendationFailed,
  });

  content.innerHTML = `<header class="analysis-heading">
    <div>
      <span class="eyebrow">MEAL ANALYSIS</span>
      <h1>식사 분석 결과</h1>
      <p>${escapeHtml(formatDate(detail.date))} · ${escapeHtml(formatMealType(detail.mealType))}${detail.schoolName ? ` · ${escapeHtml(detail.schoolName)}` : ""}</p>
    </div>
    ${statusBadge(detail.status)}
  </header>
  <div class="notice">ⓘ AI가 식사 전·후 사진을 바탕으로 추정한 결과이며 실제 중량과 차이가 있을 수 있습니다.</div>
  ${savedMessage ? `<div class="notice" role="status">✓ ${escapeHtml(savedMessage)}</div>` : ""}
  ${recommendationFailed ? `<div class="notice">추천 배식량을 불러오지 못했습니다. 분석 결과는 정상적으로 확인할 수 있습니다.</div>` : ""}
  <section>
    <div class="section-title">
      <div><small>MENU RESULTS</small><h2>메뉴별 분석 결과</h2></div>
      <span>${items.length}개 메뉴</span>
    </div>
    <div class="space-y-3">
      ${items.length ? items.map(resultCard).join("") : `<div class="state compact"><strong>표시할 메뉴별 분석 결과가 없습니다.</strong></div>`}
    </div>
  </section>
  ${renderCorrection(items)}`;

  bindCorrection(detail, items);
}

function mergeItems(detailItems = [], analysisItems = [], recommendations = []) {
  const details = Array.isArray(detailItems) ? detailItems : [];
  const analyses = Array.isArray(analysisItems) ? analysisItems : [];
  const sourceItems = analyses.length ? analyses : details;
  const merged = sourceItems.map((analysisItem) => {
    const detailItem = details.find((item) => sameMenuItem(item, analysisItem)) || {};
    const item = { ...detailItem, ...analysisItem };
    return {
      ...item,
      itemRecordId: item.itemRecordId ?? detailItem.itemRecordId,
      menuId: item.menuId ?? detailItem.menuId,
      menuName: item.menuName ?? detailItem.menuName,
      recommendation: recommendations.find((candidate) => sameMenuItem(candidate, item)),
    };
  });

  details.forEach((detailItem) => {
    if (!merged.some((item) => sameMenuItem(item, detailItem))) {
      merged.push({
        ...detailItem,
        recommendation: recommendations.find((candidate) => sameMenuItem(candidate, detailItem)),
      });
    }
  });

  return merged;
}

function sameMenuItem(left, right) {
  if (left?.itemRecordId != null && right?.itemRecordId != null) {
    return String(left.itemRecordId) === String(right.itemRecordId);
  }
  if (left?.menuId != null && right?.menuId != null) {
    return String(left.menuId) === String(right.menuId);
  }
  return Boolean(left?.menuName && right?.menuName && left.menuName === right.menuName);
}

function resultCard(item) {
  const percent = displayPercent(item);
  const progress = safeProgress(item.consumedPercent);
  const confidence = item.confidence != null ? formatConfidence(item.confidence) : null;
  const leftoverG = firstDefined(item.estimatedLeftoverG, item.leftoverAmountG, item.leftoverG);
  const measurements = [
    item.estimatedConsumedG != null && ["예상 섭취량", `${formatNumber(item.estimatedConsumedG)}g`],
    leftoverG != null && ["예상 잔반량", `${formatNumber(leftoverG)}g`],
    confidence != null && ["분석 신뢰도", confidence],
  ].filter(Boolean);
  const standardServing = item.standardServingG != null
    ? `기준 ${formatNumber(item.standardServingG)}g`
    : "기준 배식량 정보 없음";

  return `<article class="result-card">
    <div class="result-title">
      <div>
        <strong>${escapeHtml(item.menuName || "메뉴")}</strong>
        <small>${standardServing}${item.consumptionLevel ? ` · ${escapeHtml(consumptionLevelLabel(item.consumptionLevel))}` : ""}</small>
      </div>
      <div class="flex flex-wrap justify-end gap-1">
        ${item.isCorrected ? `<span class="review-badge">✓ 사용자 보정</span>` : ""}
        ${isLowConfidence(item.confidence) ? `<span class="review-badge">! 확인 필요</span>` : ""}
      </div>
    </div>
    <div class="result-grid">
      <div>
        <span>추정 섭취율</span>
        <strong>${escapeHtml(percent)}</strong>
        <div class="progress" role="progressbar" aria-label="${escapeHtml(item.menuName || "메뉴")} 섭취율" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
          <i style="width:${progress}%"></i>
        </div>
      </div>
      ${measurements.length ? `<dl>${measurements.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : ""}
    </div>
    ${renderNutrition(item.estimatedNutrition)}
    ${renderRecommendation(item.recommendation)}
  </article>`;
}

function renderNutrition(nutrition) {
  if (!nutrition) return "";

  const nutrients = [
    ["칼로리", nutrition.caloriesKcal, "kcal"],
    ["탄수화물", nutrition.carbohydrateG, "g"],
    ["단백질", nutrition.proteinG, "g"],
    ["지방", nutrition.fatG, "g"],
  ].filter(([, value]) => value != null);

  if (!nutrients.length) return "";

  return `<div class="border-t border-slate-100 px-5 py-4">
    <strong class="text-xs">예상 섭취 영양</strong>
    <dl class="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
      ${nutrients.map(([label, value, unit]) => `<div class="rounded-lg bg-slate-50 p-2">
        <dt class="text-[10px] text-slate-500">${label}</dt>
        <dd class="m-0 font-bold">${formatNumber(value)}${unit}</dd>
      </div>`).join("")}
    </dl>
  </div>`;
}

function renderRecommendation(recommendation) {
  if (!recommendation) return "";

  return `<div class="serving">
    <span>다음 권장 배식량<br><small>${escapeHtml(recommendation.reason || "나잇대·키·몸무게와 권장 영양소를 반영한 권장량입니다.")}</small></span>
    <strong>${formatNumber(recommendation.recommendedServingG)}g</strong>
  </div>`;
}

function renderCorrection(items) {
  const correctableItems = items.filter((item) => item.itemRecordId != null);
  if (!correctableItems.length) return "";

  return `<section class="panel correction">
    <div class="section-title">
      <div><small>USER CHECK</small><h2>분석 결과 보정</h2></div>
    </div>
    <p class="mb-4 text-sm text-slate-600">AI 추정값과 실제 섭취량이 다르면 메뉴별 섭취율을 수정할 수 있습니다.</p>
    <form id="correction-form">
      <label class="field">
        <span>메뉴</span>
        <select id="correction-item" aria-label="보정할 메뉴">
          ${correctableItems.map((item) => `<option value="${escapeHtml(item.itemRecordId)}">${escapeHtml(item.menuName || "메뉴")}</option>`).join("")}
        </select>
      </label>
      <fieldset class="field m-0 border-0 p-0">
        <legend>빠른 선택</legend>
        <div class="flex flex-wrap gap-1" role="group" aria-label="섭취율 빠른 선택">
          <button type="button" class="btn secondary small" data-percent="10">거의 먹지 않음</button>
          <button type="button" class="btn secondary small" data-percent="50">절반 정도</button>
          <button type="button" class="btn secondary small" data-percent="80">대부분</button>
          <button type="button" class="btn secondary small" data-percent="100">모두</button>
        </div>
      </fieldset>
      <label class="field">
        <span>섭취율 직접 입력 (%)</span>
        <input id="correction-percent" type="number" min="0" max="100" step="1" required inputmode="decimal">
      </label>
      <button type="submit" class="btn primary">보정 저장</button>
      <span id="correction-message" role="status" aria-live="polite"></span>
    </form>
  </section>`;
}

function bindCorrection(detail, items) {
  const form = document.querySelector("#correction-form");
  if (!form) return;

  const itemSelect = form.querySelector("#correction-item");
  const percentInput = form.querySelector("#correction-percent");
  const message = form.querySelector("#correction-message");
  const submit = form.querySelector("button[type='submit']");
  const presetButtons = [...form.querySelectorAll("[data-percent]")];

  const updateInput = () => {
    const selected = items.find((item) => String(item.itemRecordId) === itemSelect.value);
    percentInput.value = selected?.consumedPercent ?? "";
    updatePressedState();
  };
  const updatePressedState = () => {
    presetButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.percent === percentInput.value));
    });
  };

  itemSelect.addEventListener("change", updateInput);
  percentInput.addEventListener("input", updatePressedState);
  presetButtons.forEach((button) => button.addEventListener("click", () => {
    debugLog("MEAL_DETAIL", "보정 프리셋 선택", { itemRecordId: itemSelect.value, percent: Number(button.dataset.percent) });
    percentInput.value = button.dataset.percent;
    percentInput.focus();
    updatePressedState();
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    submit.disabled = true;
    message.textContent = "저장 중입니다.";
    const itemRecordId = /^\d+$/.test(itemSelect.value) ? Number(itemSelect.value) : itemSelect.value;
    const consumedRatio = Number(percentInput.value) / 100;
    debugLog("MEAL_DETAIL", "섭취율 보정 제출", { itemRecordId, consumedRatio });

    try {
      await api.correctConsumedRatio(itemRecordId, consumedRatio);
      const refreshedDetail = await api.getMealRecordDetail(recordId);
      debugLog("MEAL_DETAIL", "섭취율 보정 완료", { itemRecordId, consumedRatio });
      await renderCompleted(refreshedDetail, "섭취율 보정 결과를 저장했습니다.");
    } catch (error) {
      debugLog("MEAL_DETAIL", "섭취율 보정 실패", { itemRecordId, message: error.message });
      message.textContent = error.message;
      submit.disabled = false;
    }
  });

  updateInput();
}

function displayPercent(item) {
  if (item.consumedPercent != null) return `${item.consumedPercent}%`;
  if (item.consumedRatio != null) return formatPercentRatio(item.consumedRatio);
  return "-";
}

function safeProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number <= 1 ? formatPercentRatio(number) : `${formatNumber(number)}%`;
}

function isLowConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  return number <= 1 ? number < 0.7 : number < 70;
}

function consumptionLevelLabel(level) {
  return ({
    NONE: "거의 먹지 않음",
    LITTLE: "조금 섭취",
    HALF: "절반 정도 섭취",
    MOST: "대부분 섭취",
    ALL: "모두 섭취",
  })[level] || level;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "-");
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(number);
}

function firstDefined(...values) {
  return values.find((value) => value != null);
}
