import { api, validateMealImage } from "../api.js";
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
  text,
} from "../common.js";

const photoTypes = ["before", "after"];
const state = {
  meal: null,
  localToday: getSeoulDate(),
  dateMatches: false,
  files: { before: null, after: null },
  previewUrls: { before: "", after: "" },
  uploaded: { before: false, after: false },
  recordId: null,
  controller: null,
  submitting: false,
  cancelRequested: false,
};

init();

async function init() {
  debugLog("MEAL_UPLOAD", "페이지 초기화", { today: state.localToday });
  const user = await requireUser();
  if (!user) return;
  initShell(user);
  bindUploadForm();
  await loadTodayMeal();
}

function bindUploadForm() {
  photoTypes.forEach(bindPhotoField);
  document.querySelector("#upload-form")?.addEventListener("submit", handleSubmit);
  document.querySelector("#cancel-upload")?.addEventListener("click", cancelUpload);
  document.querySelector("#retry-upload")?.addEventListener("click", startUpload);
  debugLog("MEAL_UPLOAD", "업로드 입력 이벤트 연결 완료");
}

function bindPhotoField(type) {
  const input = document.querySelector(`#${type}-input`);
  const dropzone = document.querySelector(`#${type}-dropzone`);
  const removeButton = document.querySelector(`#${type}-remove`);

  input?.addEventListener("change", () => selectFile(type, input.files?.[0]));
  removeButton?.addEventListener("click", () => clearFile(type));
  dropzone?.addEventListener("keydown", (event) => {
    if (event.target !== dropzone || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    input?.click();
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (!state.submitting) dropzone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });
  dropzone?.addEventListener("drop", (event) => {
    if (state.submitting) return;
    selectFile(type, event.dataTransfer?.files?.[0]);
  });
}

async function loadTodayMeal() {
  debugLog("MEAL_UPLOAD", "오늘 급식 조회 시작");
  const loading = document.querySelector("#upload-loading");
  loading.innerHTML = '<span class="spinner" aria-hidden="true"></span><strong>오늘의 급식을 불러오고 있습니다.</strong>';
  show("upload-loading");
  hide("upload-form");

  try {
    state.meal = await api.getTodayMeal("LUNCH");
    renderTodayMeal(state.meal);
    hide("upload-loading");
    show("upload-form");
    updateSubmitState();
    debugLog("MEAL_UPLOAD", "오늘 급식 표시 완료", {
      mealId: state.meal?.mealId,
      mealDate: normalizeDate(state.meal?.date),
      dateMatches: state.dateMatches,
      menuCount: state.meal?.menuItems?.length || 0,
    });
  } catch (error) {
    debugLog("MEAL_UPLOAD", "오늘 급식 조회 실패", { message: error.message });
    showError("upload-loading", error.message, loadTodayMeal);
  }
}

function renderTodayMeal(meal) {
  const mealDate = normalizeDate(meal?.date);
  state.dateMatches = Boolean(meal?.mealId && mealDate === state.localToday);
  text("upload-date", mealDate ? formatDate(mealDate) : formatDate(state.localToday));
  text("school-name", meal?.schoolName || "제공 기관 미등록");
  text("meal-type", formatMealType(meal?.mealType || "LUNCH"));

  const menus = Array.isArray(meal?.menuItems) ? meal.menuItems : [];
  document.querySelector("#menu-chips").innerHTML = menus.length
    ? menus.map((menu) => {
      const allergens = allergenNames(menu.allergens);
      const detail = [formatGrams(menu.standardServingG), allergens].filter(Boolean).join(" · ");
      return `<span>${escapeHtml(menu.name)}<small>${escapeHtml(detail)}</small></span>`;
    }).join("")
    : "<span>등록된 메뉴가 없습니다.</span>";

  const warning = document.querySelector("#date-warning");
  if (!meal?.mealId) {
    warning.textContent = "오늘 등록된 점심 급식이 없어 사진을 업로드할 수 없습니다.";
    show("date-warning");
  } else if (!state.dateMatches) {
    warning.textContent = `급식 날짜(${mealDate || "미등록"})가 오늘(${state.localToday})과 달라 업로드할 수 없습니다.`;
    show("date-warning");
  } else {
    warning.textContent = "";
    hide("date-warning");
  }
}

function selectFile(type, file) {
  if (!file || state.submitting) return;
  debugLog("MEAL_UPLOAD", "사진 선택", { type: type.toUpperCase(), name: file.name, size: file.size });
  clearFileError(type);

  try {
    const result = validateMealImage(file);
    if (typeof result === "string" || result === false || result?.valid === false) {
      throw new Error(typeof result === "string" ? result : result?.message || "사용할 수 없는 이미지 파일입니다.");
    }
  } catch (error) {
    debugLog("MEAL_UPLOAD", "사진 검증 실패", { type: type.toUpperCase(), message: error.message });
    showFileError(type, error.message);
    resetInput(type);
    return;
  }

  revokePreview(type);
  state.files[type] = file;
  state.uploaded[type] = false;
  state.previewUrls[type] = URL.createObjectURL(file);
  document.querySelector(`#${type}-preview-image`).src = state.previewUrls[type];
  text(`${type}-preview-label`, `${file.name} · 클릭하여 교체`);
  hide(`${type}-empty`);
  show(`${type}-preview`);
  show(`${type}-remove`);
  hideUploadError();
  updateSubmitState();
}

function clearFile(type) {
  if (state.submitting) return;
  debugLog("MEAL_UPLOAD", "선택 사진 삭제", { type: type.toUpperCase() });
  revokePreview(type);
  state.files[type] = null;
  state.uploaded[type] = false;
  resetInput(type);
  document.querySelector(`#${type}-preview-image`).removeAttribute("src");
  text(`${type}-preview-label`, "");
  show(`${type}-empty`);
  hide(`${type}-preview`);
  hide(`${type}-remove`);
  clearFileError(type);
  hideUploadError();
  updateSubmitState();
}

function handleSubmit(event) {
  event.preventDefault();
  startUpload();
}

async function startUpload() {
  if (state.submitting || !canSubmit()) return;
  state.submitting = true;
  state.cancelRequested = false;
  state.controller = new AbortController();
  setFormLocked(true);
  hideUploadError();
  show("upload-progress");
  setProgress(0, "업로드 준비 중");

  try {
    if (!state.recordId) {
      setProgress(3, "식사 기록 생성 중");
      debugLog("MEAL_UPLOAD", "식사 기록 생성 요청", { mealId: state.meal.mealId });
      const record = await api.prepareMealRecordForUpload(state.meal.mealId);
      state.recordId = record.recordId;
      debugLog("MEAL_UPLOAD", "식사 기록 생성 완료", { recordId: state.recordId, status: record.status });
    } else {
      debugLog("MEAL_UPLOAD", "기존 식사 기록으로 재시도", { recordId: state.recordId });
    }
    throwIfCancelled();

    if (!state.uploaded.before) {
      setProgress(5, "식사 전 사진 업로드 중");
      await uploadPhoto("before", 5, 45);
      state.uploaded.before = true;
    } else {
      setProgress(45, "식사 전 사진 업로드 완료");
    }
    throwIfCancelled();

    if (!state.uploaded.after) {
      setProgress(45, "식사 후 사진 업로드 중");
      await uploadPhoto("after", 45, 88);
      state.uploaded.after = true;
    } else {
      setProgress(88, "식사 후 사진 업로드 완료");
    }
    throwIfCancelled();

    setProgress(92, "AI 분석 요청 중");
    setCancelEnabled(false);
    debugLog("MEAL_UPLOAD", "분석 요청", { recordId: state.recordId });
    const analysis = await api.analyzeMealRecord(state.recordId);
    const recordId = analysis?.recordId || state.recordId;
    setProgress(100, "분석 요청 완료");
    debugLog("MEAL_UPLOAD", "업로드 및 분석 요청 완료", { recordId, status: analysis?.status });
    location.href = `/meal.html?id=${encodeURIComponent(recordId)}`;
  } catch (error) {
    const cancelled = isCancellation(error) || state.cancelRequested;
    const message = cancelled ? "업로드가 취소되었습니다. 준비된 단계부터 다시 시도할 수 있습니다." : error.message;
    debugLog("MEAL_UPLOAD", cancelled ? "업로드 취소" : "업로드 실패", {
      recordId: state.recordId,
      message,
      beforeUploaded: state.uploaded.before,
      afterUploaded: state.uploaded.after,
    });
    showUploadError(message);
  } finally {
    state.submitting = false;
    state.controller = null;
    state.cancelRequested = false;
    setFormLocked(false);
    setCancelEnabled(true);
    updateSubmitState();
  }
}

async function uploadPhoto(type, start, end) {
  const apiType = type.toUpperCase();
  debugLog("MEAL_UPLOAD", "사진 업로드 시작", { recordId: state.recordId, type: apiType });
  await api.uploadMealImage(state.recordId, apiType, state.files[type], {
    signal: state.controller.signal,
    onProgress: (progress) => {
      const filePercent = normalizeProgress(progress);
      const overall = start + ((end - start) * filePercent / 100);
      setProgress(overall, `${type === "before" ? "식사 전" : "식사 후"} 사진 업로드 중`);
    },
  });
  setProgress(end, `${type === "before" ? "식사 전" : "식사 후"} 사진 업로드 완료`);
  debugLog("MEAL_UPLOAD", "사진 업로드 완료", { recordId: state.recordId, type: apiType });
}

function cancelUpload() {
  if (!state.submitting) return;
  debugLog("MEAL_UPLOAD", "업로드 취소 요청", { recordId: state.recordId });
  state.cancelRequested = true;
  state.controller?.abort();
  setCancelEnabled(false);
  text("upload-stage", "업로드 취소 중");
}

function canSubmit() {
  return Boolean(state.meal?.mealId && state.dateMatches && state.files.before && state.files.after);
}

function updateSubmitState() {
  const submit = document.querySelector("#upload-submit");
  if (submit) submit.disabled = state.submitting || !canSubmit();
}

function setFormLocked(locked) {
  photoTypes.forEach((type) => {
    const input = document.querySelector(`#${type}-input`);
    const remove = document.querySelector(`#${type}-remove`);
    const dropzone = document.querySelector(`#${type}-dropzone`);
    if (input) input.disabled = locked;
    if (remove) remove.disabled = locked;
    dropzone?.setAttribute("aria-disabled", String(locked));
  });
}

function setProgress(value, stage) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const bar = document.querySelector("#upload-progress-bar");
  const track = document.querySelector("#upload-progress-track");
  if (bar) bar.style.width = `${percent}%`;
  track?.setAttribute("aria-valuenow", String(percent));
  text("upload-percent", `${percent}%`);
  text("upload-stage", stage);
}

function setCancelEnabled(enabled) {
  const button = document.querySelector("#cancel-upload");
  if (button) button.disabled = !enabled;
}

function normalizeProgress(progress) {
  if (typeof progress === "number") return clampPercent(progress <= 1 ? progress * 100 : progress);
  if (Number.isFinite(progress?.percent)) return clampPercent(progress.percent <= 1 ? progress.percent * 100 : progress.percent);
  if (Number.isFinite(progress?.loaded) && Number.isFinite(progress?.total) && progress.total > 0) {
    return clampPercent((progress.loaded / progress.total) * 100);
  }
  return 0;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function showUploadError(message) {
  text("upload-error-message", message || "서버 요청 중 오류가 발생했습니다.");
  show("upload-error");
  show("retry-upload");
  hide("upload-progress");
}

function hideUploadError() {
  hide("upload-error");
}

function showFileError(type, message) {
  text(`${type}-error`, message || "이미지 파일을 확인해 주세요.");
}

function clearFileError(type) {
  text(`${type}-error`, "");
}

function resetInput(type) {
  const input = document.querySelector(`#${type}-input`);
  if (input) input.value = "";
}

function revokePreview(type) {
  if (state.previewUrls[type]) URL.revokeObjectURL(state.previewUrls[type]);
  state.previewUrls[type] = "";
}

function throwIfCancelled() {
  if (!state.cancelRequested) return;
  throw new DOMException("Upload cancelled", "AbortError");
}

function isCancellation(error) {
  return error?.name === "AbortError" || ["ABORTED", "UPLOAD_ABORTED", "REQUEST_ABORTED"].includes(error?.code);
}

function getSeoulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDate(value) {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || "";
}

function allergenNames(allergens) {
  if (!Array.isArray(allergens)) return "";
  return allergens.map((item) => typeof item === "object" ? item.name : item).filter(Boolean).join(", ");
}

function formatGrams(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}g` : "";
}
