import { api } from "../api.js";
import {
  debugLog,
  escapeHtml,
  formatPercentRatio,
  initShell,
  requireUser,
  text,
} from "../common.js";

const user = await requireUser({ adminOnly: true });

if (user) {
  debugLog("ADMIN", "페이지 초기화", { userId: user.id });
  initShell(user);
  initAdmin();
}

function initAdmin() {
  const dateForm = document.querySelector("#admin-date-form");
  const summaryForm = document.querySelector("#summary-filter");
  const summaryPagination = document.querySelector("#summary-pagination");
  const mealScheduleForm = document.querySelector("#meal-schedule-form");
  const newMenuDisclosure = document.querySelector("#new-menu-disclosure");
  const mealMenuSelect = document.querySelector("#meal-menu-select");
  const addMealMenuButton = document.querySelector("#add-meal-menu");
  const addNewMealMenuButton = document.querySelector("#add-new-meal-menu");
  const selectedMealMenuList = document.querySelector("#selected-meal-menu-list");
  const mealScheduleSubmit = document.querySelector("#meal-schedule-submit");
  const menuForm = document.querySelector("#menu-form");
  const searchForm = document.querySelector("#menu-search-form");
  const menuList = document.querySelector("#admin-menu-list");
  const menuPagination = document.querySelector("#menu-pagination");
  const cancelMenuEditButton = document.querySelector("#cancel-menu-edit");
  const selectedMealMenus = new Map();
  let availableMenus = [];
  let summaryItems = [];
  let summaryPage = 1;
  let menuPage = 1;
  let draftMenuSequence = 0;
  let mealRegistrationBusy = false;
  const summaryPageSize = 10;
  const menuPageSize = 10;
  const today = toLocalDateInput(new Date());
  const monthStart = `${today.slice(0, 8)}01`;

  dateForm.date.value = today;
  mealScheduleForm.elements.mealDate.value = today;
  summaryForm.startDate.value = monthStart;
  summaryForm.endDate.value = today;

  dateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    debugLog("ADMIN", "날짜별 통계 조회 제출", { date: dateForm.date.value });
    loadDashboard();
  });
  summaryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (summaryForm.startDate.value > summaryForm.endDate.value) {
      debugLog("ADMIN", "잘못된 통계 조회 기간", { startDate: summaryForm.startDate.value, endDate: summaryForm.endDate.value });
      summaryForm.endDate.setCustomValidity("종료일은 시작일보다 빠를 수 없습니다.");
      summaryForm.endDate.reportValidity();
      return;
    }
    summaryForm.endDate.setCustomValidity("");
    summaryPage = 1;
    debugLog("ADMIN", "메뉴 통계 기간 조회 제출", { startDate: summaryForm.startDate.value, endDate: summaryForm.endDate.value });
    loadSummary();
  });
  summaryForm.addEventListener("input", () => summaryForm.endDate.setCustomValidity(""));
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    debugLog("ADMIN", "메뉴 검색 제출", { keyword: searchForm.keyword.value.trim() });
    menuPage = 1;
    loadMenus();
  });
  mealScheduleForm.addEventListener("submit", submitMealSchedule);
  addMealMenuButton.addEventListener("click", addSelectedMealMenu);
  addNewMealMenuButton.addEventListener("click", addNewMealMenuDraft);
  mealScheduleForm.addEventListener("input", clearDraftFieldError);
  selectedMealMenuList.addEventListener("click", removeSelectedMealMenu);
  menuForm.addEventListener("submit", submitMenu);
  cancelMenuEditButton.addEventListener("click", cancelMenuEdit);
  menuList.addEventListener("click", beginMenuEdit);
  summaryPagination.addEventListener("click", changeSummaryPage);
  menuPagination.addEventListener("click", changeMenuPage);

  const allergenLoadPromise = loadAllergens();
  Promise.all([loadDashboard(), loadSummary(), allergenLoadPromise, loadMenus(), loadMealMenuOptions()]);

  async function loadDashboard() {
    debugLog("ADMIN", "날짜별 통계 조회 시작", { date: dateForm.date.value });
    setMetricLoading();
    try {
      const data = await api.getAdminDashboard(dateForm.date.value);
      text("total-users", formatNumber(data.totalUsers));
      text("meal-record-count", formatNumber(data.mealRecordCount));
      text("completed-analysis-count", formatNumber(data.completedAnalysisCount));
      text("admin-average-intake", formatPercentRatio(data.averageConsumedRatio));
      text("admin-average-leftover", formatPercentRatio(data.averageLeftoverRatio));
      debugLog("ADMIN", "날짜별 통계 조회 완료", { date: data.date, mealRecordCount: data.mealRecordCount, completedAnalysisCount: data.completedAnalysisCount });
    } catch (error) {
      debugLog("ADMIN", "날짜별 통계 조회 실패", { message: error.message });
      setMetricError(error.message);
    }
  }

  async function loadSummary() {
    debugLog("ADMIN", "메뉴별 잔반 통계 조회 시작", { startDate: summaryForm.startDate.value, endDate: summaryForm.endDate.value });
    const body = document.querySelector("#menu-statistics");
    body.innerHTML = '<tr><td colspan="4">통계를 불러오는 중입니다.</td></tr>';
    summaryPagination.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const data = await api.getLeftoverSummary({
        startDate: summaryForm.startDate.value,
        endDate: summaryForm.endDate.value,
      });
      summaryItems = data.menuSummary;
      renderSummaryPage();
      debugLog("ADMIN", "메뉴별 잔반 통계 조회 완료", { count: summaryItems.length });
    } catch (error) {
      summaryItems = [];
      debugLog("ADMIN", "메뉴별 잔반 통계 조회 실패", { message: error.message });
      body.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
      summaryPagination.innerHTML = '<span class="pagination-summary">통계 페이지를 불러오지 못했습니다.</span>';
    }
  }

  function changeSummaryPage(event) {
    const button = event.target.closest("[data-summary-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.summaryPage);
    if (!Number.isInteger(page) || page < 1 || page === summaryPage) return;
    summaryPage = page;
    renderSummaryPage();
  }

  function renderSummaryPage() {
    const body = document.querySelector("#menu-statistics");
    const totalPages = Math.max(1, Math.ceil(summaryItems.length / summaryPageSize));
    summaryPage = Math.min(summaryPage, totalPages);
    const start = (summaryPage - 1) * summaryPageSize;
    const visibleItems = summaryItems.slice(start, start + summaryPageSize);
    body.innerHTML = visibleItems.length
      ? visibleItems.map(summaryRow).join("")
      : '<tr><td colspan="4">선택한 기간의 집계 데이터가 없습니다.</td></tr>';
    renderSummaryPagination(totalPages);
  }

  function renderSummaryPagination(totalPages) {
    const pageItems = paginationItems(summaryPage, totalPages);
    summaryPagination.innerHTML = `
      <button type="button" class="pagination-button" data-summary-page="${summaryPage - 1}"${summaryPage === 1 ? " disabled" : ""}>이전</button>
      <span class="pagination-pages">
        ${pageItems.map((page) => page === null
          ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
          : `<button type="button" class="pagination-button${page === summaryPage ? " active" : ""}" data-summary-page="${page}"${page === summaryPage ? ' aria-current="page"' : ""}>${page}</button>`).join("")}
      </span>
      <button type="button" class="pagination-button" data-summary-page="${summaryPage + 1}"${summaryPage === totalPages ? " disabled" : ""}>다음</button>
      <span class="pagination-summary">${summaryPage} / ${totalPages} 페이지 · 총 ${formatNumber(summaryItems.length)}개</span>`;
  }

  async function loadAllergens() {
    debugLog("ADMIN", "알레르기 태그 조회 시작");
    const editContainer = document.querySelector("#allergen-options");
    const draftContainer = document.querySelector("#draft-allergen-options");
    try {
      const allergens = await api.getAllergens();
      editContainer.innerHTML = allergens.length
        ? allergens.map((item) => allergenOption(item, "allergenCodes", true)).join("")
        : '<span class="muted-text">선택할 알레르기 태그가 없습니다.</span>';
      draftContainer.innerHTML = allergens.length
        ? allergens.map((item) => allergenOption(item, "draftAllergenCodes")).join("")
        : '<span class="muted-text">선택할 알레르기 태그가 없습니다.</span>';
      debugLog("ADMIN", "알레르기 태그 조회 완료", { count: allergens.length });
    } catch (error) {
      debugLog("ADMIN", "알레르기 태그 조회 실패", { message: error.message });
      const message = `<span class="field-error">${escapeHtml(error.message)}</span>`;
      editContainer.innerHTML = message;
      draftContainer.innerHTML = message;
    }
  }

  async function loadMenus() {
    const keyword = searchForm.keyword.value.trim();
    debugLog("ADMIN", "메뉴 목록 조회 시작", { page: menuPage, size: menuPageSize, keyword });
    const body = document.querySelector("#admin-menu-list");
    body.innerHTML = '<tr><td colspan="5">메뉴를 불러오는 중입니다.</td></tr>';
    menuPagination.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const data = await api.getMenus({ page: menuPage, size: menuPageSize, keyword });
      const totalPages = Math.max(1, Math.ceil(data.totalCount / menuPageSize));
      if (menuPage > totalPages) {
        menuPage = totalPages;
        await loadMenus();
        return;
      }
      text("menu-total-count", `${formatNumber(data.totalCount)}개`);
      body.innerHTML = data.items.length
        ? data.items.map(menuRow).join("")
        : '<tr><td colspan="5">검색 결과가 없습니다.</td></tr>';
      renderMenuPagination(totalPages, data.totalCount);
      debugLog("ADMIN", "메뉴 목록 조회 완료", { page: menuPage, totalPages, count: data.items.length, totalCount: data.totalCount });
    } catch (error) {
      debugLog("ADMIN", "메뉴 목록 조회 실패", { message: error.message });
      body.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
      menuPagination.innerHTML = '<span class="pagination-summary">메뉴 페이지를 불러오지 못했습니다.</span>';
    }
  }

  function changeMenuPage(event) {
    const button = event.target.closest("[data-menu-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.menuPage);
    if (!Number.isInteger(page) || page < 1 || page === menuPage) return;
    menuPage = page;
    loadMenus();
  }

  function renderMenuPagination(totalPages, totalCount) {
    const pageItems = paginationItems(menuPage, totalPages);
    menuPagination.innerHTML = `
      <button type="button" class="pagination-button" data-menu-page="${menuPage - 1}"${menuPage === 1 ? " disabled" : ""}>이전</button>
      <span class="pagination-pages">
        ${pageItems.map((page) => page === null
          ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
          : `<button type="button" class="pagination-button${page === menuPage ? " active" : ""}" data-menu-page="${page}"${page === menuPage ? ' aria-current="page"' : ""}>${page}</button>`).join("")}
      </span>
      <button type="button" class="pagination-button" data-menu-page="${menuPage + 1}"${menuPage === totalPages ? " disabled" : ""}>다음</button>
      <span class="pagination-summary">${menuPage} / ${totalPages} 페이지 · 총 ${formatNumber(totalCount)}개</span>`;
  }

  async function loadMealMenuOptions() {
    debugLog("ADMIN", "식단 메뉴 선택 목록 조회 시작");
    mealMenuSelect.disabled = true;
    addMealMenuButton.disabled = true;
    mealMenuSelect.innerHTML = '<option value="">메뉴를 불러오는 중입니다.</option>';
    try {
      const data = await api.getMenus({ page: 1, size: 100 });
      availableMenus = data.items;
      const menusById = new Map(availableMenus.map((menu) => [String(menu.menuId), menu]));
      for (const [key, entry] of selectedMealMenus) {
        if (entry.kind !== "existing") continue;
        const latestMenu = menusById.get(String(entry.menuId));
        if (latestMenu) selectedMealMenus.set(key, existingMealMenuEntry(latestMenu));
      }
      mealMenuSelect.innerHTML = availableMenus.length
        ? `<option value="">메뉴를 선택하세요.</option>${availableMenus.map(mealMenuOption).join("")}`
        : '<option value="">등록된 메뉴가 없습니다.</option>';
      mealMenuSelect.disabled = mealRegistrationBusy || availableMenus.length === 0;
      addMealMenuButton.disabled = mealRegistrationBusy || availableMenus.length === 0;
      renderSelectedMealMenus();
      debugLog("ADMIN", "식단 메뉴 선택 목록 조회 완료", { count: availableMenus.length });
    } catch (error) {
      availableMenus = [];
      mealMenuSelect.innerHTML = '<option value="">메뉴 목록을 불러오지 못했습니다.</option>';
      text("meal-schedule-message", error.message);
      debugLog("ADMIN", "식단 메뉴 선택 목록 조회 실패", { message: error.message });
    }
  }

  function addSelectedMealMenu() {
    const menuId = String(mealMenuSelect.value);
    const menu = availableMenus.find((item) => String(item.menuId) === menuId);
    if (!menu) {
      text("meal-schedule-message", "추가할 메뉴를 선택해 주세요.");
      mealMenuSelect.focus();
      return;
    }
    const key = `existing:${menuId}`;
    if (selectedMealMenus.has(key)) {
      text("meal-schedule-message", "이미 식단에 추가된 메뉴입니다.");
      return;
    }
    selectedMealMenus.set(key, existingMealMenuEntry(menu));
    mealMenuSelect.value = "";
    text("meal-schedule-message", `${menu.name} 메뉴를 추가했습니다.`);
    debugLog("ADMIN", "식단 메뉴 아이템 추가", { menuId: menu.menuId, name: menu.name, selectedCount: selectedMealMenus.size });
    renderSelectedMealMenus();
  }

  function addNewMealMenuDraft() {
    newMenuDisclosure.open = true;
    const menu = readNewMenuDraft();
    if (!menu) return false;

    const normalizedName = menu.name.toLocaleLowerCase("ko-KR");
    const duplicateSelected = [...selectedMealMenus.values()]
      .some((entry) => entry.name.toLocaleLowerCase("ko-KR") === normalizedName);
    const duplicateCatalog = availableMenus
      .some((entry) => entry.name.toLocaleLowerCase("ko-KR") === normalizedName);
    if (duplicateSelected || duplicateCatalog) {
      text("new-menu-draft-message", duplicateSelected
        ? "같은 이름의 메뉴가 이미 이번 식단에 추가되어 있습니다."
        : "이미 등록된 메뉴명입니다. 왼쪽의 기존 메뉴에서 선택해 주세요.");
      mealScheduleForm.elements.draftMenuName.focus();
      return false;
    }

    const key = `draft:${++draftMenuSequence}`;
    selectedMealMenus.set(key, {
      kind: "new",
      key,
      name: menu.name,
      standardServingG: menu.standardServingG,
      menu,
    });
    resetNewMenuDraft();
    newMenuDisclosure.open = false;
    text("new-menu-draft-message", `${menu.name} 메뉴 초안을 식단에 추가했습니다.`);
    text("meal-schedule-message", "새 메뉴는 아래 최종 등록 버튼을 누를 때 생성됩니다.");
    debugLog("ADMIN", "새 메뉴 초안 식단 추가", { key, name: menu.name, selectedCount: selectedMealMenus.size });
    renderSelectedMealMenus();
    return true;
  }

  function readNewMenuDraft() {
    const fields = {
      name: mealScheduleForm.elements.draftMenuName,
      standardServingG: mealScheduleForm.elements.draftStandardServingG,
      caloriesKcal: mealScheduleForm.elements.draftCaloriesKcal,
      carbohydrateG: mealScheduleForm.elements.draftCarbohydrateG,
      proteinG: mealScheduleForm.elements.draftProteinG,
      fatG: mealScheduleForm.elements.draftFatG,
      ingredients: mealScheduleForm.elements.draftIngredients,
    };
    const requiredValues = [
      [fields.name, fields.name.value.trim() !== "", "메뉴명을 입력해 주세요."],
      [fields.standardServingG, Number(fields.standardServingG.value) > 0, "기준 배식량을 1g 이상 입력해 주세요."],
      [fields.caloriesKcal, isNonNegativeNumber(fields.caloriesKcal.value), "열량을 0 이상의 숫자로 입력해 주세요."],
      [fields.carbohydrateG, isNonNegativeNumber(fields.carbohydrateG.value), "탄수화물을 0 이상의 숫자로 입력해 주세요."],
      [fields.proteinG, isNonNegativeNumber(fields.proteinG.value), "단백질을 0 이상의 숫자로 입력해 주세요."],
      [fields.fatG, isNonNegativeNumber(fields.fatG.value), "지방을 0 이상의 숫자로 입력해 주세요."],
      [fields.ingredients, parseIngredients(fields.ingredients.value).length > 0, "원재료를 하나 이상 입력해 주세요."],
    ];
    const invalid = requiredValues.find(([, valid]) => !valid);
    if (invalid) {
      const [field, , message] = invalid;
      field.setCustomValidity(message);
      field.reportValidity();
      text("new-menu-draft-message", message);
      return null;
    }

    return {
      name: fields.name.value.trim(),
      standardServingG: Number(fields.standardServingG.value),
      nutrition: {
        caloriesKcal: Number(fields.caloriesKcal.value),
        carbohydrateG: Number(fields.carbohydrateG.value),
        proteinG: Number(fields.proteinG.value),
        fatG: Number(fields.fatG.value),
      },
      ingredients: parseIngredients(fields.ingredients.value),
      allergenCodes: [...mealScheduleForm.querySelectorAll('input[name="draftAllergenCodes"]:checked')]
        .map((input) => input.value),
    };
  }

  function clearDraftFieldError(event) {
    if (!event.target.name?.startsWith("draft")) return;
    event.target.setCustomValidity?.("");
    text("new-menu-draft-message", "");
  }

  function resetNewMenuDraft() {
    [
      "draftMenuName",
      "draftStandardServingG",
      "draftCaloriesKcal",
      "draftCarbohydrateG",
      "draftProteinG",
      "draftFatG",
      "draftIngredients",
    ].forEach((name) => {
      const field = mealScheduleForm.elements[name];
      field.value = "";
      field.setCustomValidity("");
    });
    mealScheduleForm.querySelectorAll('input[name="draftAllergenCodes"]').forEach((input) => {
      input.checked = false;
    });
  }

  function removeSelectedMealMenu(event) {
    const button = event.target.closest("[data-remove-meal-menu-id]");
    if (!button) return;
    const key = button.dataset.removeMealMenuId;
    const menu = selectedMealMenus.get(key);
    selectedMealMenus.delete(key);
    text("meal-schedule-message", menu ? `${menu.name} 메뉴를 제외했습니다.` : "메뉴를 제외했습니다.");
    debugLog("ADMIN", "식단 메뉴 아이템 삭제", { key, selectedCount: selectedMealMenus.size });
    renderSelectedMealMenus();
  }

  function renderSelectedMealMenus() {
    const items = [...selectedMealMenus.entries()];
    text("selected-meal-menu-count", `${items.length}개`);
    selectedMealMenuList.innerHTML = items.length
      ? items.map(([key, menu]) => selectedMealMenuRow(key, menu)).join("")
      : '<tr><td colspan="4">기존 메뉴를 선택하거나 새 메뉴를 작성해 추가해 주세요.</td></tr>';
    mealScheduleSubmit.disabled = mealRegistrationBusy || items.length === 0;
  }

  async function submitMealSchedule(event) {
    event.preventDefault();
    if (mealRegistrationBusy) return;
    const mealDate = mealScheduleForm.elements.mealDate.value;
    const schoolName = mealScheduleForm.elements.schoolName.value.trim();
    if (hasNewMenuDraftContent() && !addNewMealMenuDraft()) return;
    if (!selectedMealMenus.size) {
      text("meal-schedule-message", "식단에 등록할 메뉴를 하나 이상 추가해 주세요.");
      return;
    }
    const newMenuCount = [...selectedMealMenus.values()].filter((entry) => entry.kind === "new").length;
    debugLog("ADMIN", "통합 식단 등록 제출", { mealDate, mealType: "LUNCH", schoolName, selectedCount: selectedMealMenus.size, newMenuCount });
    setMealRegistrationBusy(true);
    let catalogChanged = false;
    try {
      for (const [key, entry] of [...selectedMealMenus.entries()]) {
        if (entry.kind !== "new") continue;
        text("meal-schedule-message", `${entry.name} 새 메뉴를 생성하고 있습니다.`);
        const created = await api.createAdminMenu(entry.menu);
        selectedMealMenus.delete(key);
        selectedMealMenus.set(`existing:${created.menuId}`, existingMealMenuEntry(created));
        catalogChanged = true;
        renderSelectedMealMenus();
        debugLog("ADMIN", "식단 등록용 새 메뉴 생성 완료", { draftKey: key, menuId: created.menuId, name: created.name });
      }

      const menuIds = [...selectedMealMenus.values()].map((entry) => Number(entry.menuId));
      const request = { mealDate, mealType: "LUNCH", schoolName, menuIds };
      text("meal-schedule-message", "모든 메뉴를 해당 일자의 점심 식단에 등록하고 있습니다.");
      await api.createAdminMeal(request);
      selectedMealMenus.clear();
      renderSelectedMealMenus();
      text("meal-schedule-message", `${mealDate} 점심 식단과 메뉴 ${menuIds.length}개를 등록했습니다.`);
      debugLog("ADMIN", "통합 식단 등록 완료", { mealDate, menuCount: menuIds.length, newMenuCount });
    } catch (error) {
      text("meal-schedule-message", error.message);
      debugLog("ADMIN", "통합 식단 등록 실패", { mealDate, message: error.message });
    } finally {
      if (catalogChanged) await Promise.all([loadMenus(), loadMealMenuOptions()]);
      setMealRegistrationBusy(false);
      renderSelectedMealMenus();
    }
  }

  function setMealRegistrationBusy(busy) {
    mealRegistrationBusy = busy;
    mealScheduleForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = busy;
    });
    if (!busy) {
      mealMenuSelect.disabled = availableMenus.length === 0;
      addMealMenuButton.disabled = availableMenus.length === 0;
      addNewMealMenuButton.disabled = false;
      mealScheduleSubmit.disabled = selectedMealMenus.size === 0;
    }
  }

  function hasNewMenuDraftContent() {
    const fieldNames = [
      "draftMenuName",
      "draftStandardServingG",
      "draftCaloriesKcal",
      "draftCarbohydrateG",
      "draftProteinG",
      "draftFatG",
      "draftIngredients",
    ];
    return fieldNames.some((name) => String(mealScheduleForm.elements[name].value).trim() !== "")
      || Boolean(mealScheduleForm.querySelector('input[name="draftAllergenCodes"]:checked'));
  }

  async function beginMenuEdit(event) {
    const button = event.target.closest("[data-edit-menu-id]");
    if (!button) return;
    const menuId = Number(button.dataset.editMenuId);
    button.disabled = true;
    text("menu-form-message", "메뉴 상세 정보를 불러오고 있습니다.");
    debugLog("ADMIN", "메뉴 수정 상세 조회 시작", { menuId });
    try {
      await allergenLoadPromise;
      const menu = await api.getMenu(menuId);
      setMenuEditorEnabled(true);
      fillMenuForm(menu);
      text("menu-form-message", `${menu.name} 메뉴를 수정할 수 있습니다.`);
      menuForm.scrollIntoView({ behavior: "smooth", block: "start" });
      debugLog("ADMIN", "메뉴 수정 상세 조회 완료", { menuId, name: menu.name });
    } catch (error) {
      text("menu-form-message", error.message);
      debugLog("ADMIN", "메뉴 수정 상세 조회 실패", { menuId, message: error.message });
    } finally {
      button.disabled = false;
    }
  }

  function fillMenuForm(menu) {
    menuForm.elements.menuId.value = menu.menuId;
    menuForm.elements.name.value = menu.name || "";
    menuForm.elements.standardServingG.value = menu.standardServingG ?? "";
    menuForm.elements.caloriesKcal.value = menu.nutrition?.caloriesKcal ?? "";
    menuForm.elements.carbohydrateG.value = menu.nutrition?.carbohydrateG ?? "";
    menuForm.elements.proteinG.value = menu.nutrition?.proteinG ?? "";
    menuForm.elements.fatG.value = menu.nutrition?.fatG ?? "";
    menuForm.elements.ingredients.value = menu.ingredients?.join(", ") || "";
    const allergenCodes = new Set((menu.allergens || []).map((item) => item.code).filter(Boolean));
    menuForm.querySelectorAll('input[name="allergenCodes"]').forEach((input) => {
      input.checked = allergenCodes.has(input.value);
    });
  }

  function cancelMenuEdit() {
    const menuId = menuForm.elements.menuId.value;
    resetMenuEditor();
    text("menu-form-message", "메뉴 수정을 취소했습니다.");
    debugLog("ADMIN", "메뉴 수정 취소", { menuId });
  }

  function resetMenuEditor() {
    menuForm.reset();
    menuForm.elements.menuId.value = "";
    menuForm.elements.name.placeholder = "수정할 메뉴를 선택하세요";
    setMenuEditorEnabled(false);
  }

  function setMenuEditorEnabled(enabled) {
    menuForm.querySelectorAll("input:not([type='hidden']), textarea").forEach((control) => {
      control.disabled = !enabled;
    });
    menuForm.querySelector("#menu-submit").disabled = !enabled;
    cancelMenuEditButton.hidden = !enabled;
    cancelMenuEditButton.disabled = !enabled;
  }

  async function submitMenu(event) {
    event.preventDefault();
    const submit = menuForm.querySelector('button[type="submit"]');
    const formData = new FormData(menuForm);
    const ingredients = String(formData.get("ingredients"))
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const menu = {
      name: String(formData.get("name")).trim(),
      standardServingG: Number(formData.get("standardServingG")),
      nutrition: {
        caloriesKcal: Number(formData.get("caloriesKcal")),
        carbohydrateG: Number(formData.get("carbohydrateG")),
        proteinG: Number(formData.get("proteinG")),
        fatG: Number(formData.get("fatG")),
      },
      ingredients,
      allergenCodes: formData.getAll("allergenCodes").map(String),
    };
    const menuId = Number(formData.get("menuId")) || null;
    if (!menuId) {
      text("menu-form-message", "등록 메뉴 목록에서 수정할 메뉴를 먼저 선택해 주세요.");
      return;
    }
    debugLog("ADMIN", "메뉴 수정 제출", { menuId, name: menu.name, ingredientCount: ingredients.length, allergenCount: menu.allergenCodes.length });

    submit.disabled = true;
    cancelMenuEditButton.disabled = true;
    text("menu-form-message", "메뉴를 수정하고 있습니다.");
    try {
      await api.updateAdminMenu(menuId, menu);
      resetMenuEditor();
      text("menu-form-message", "메뉴를 수정했습니다.");
      debugLog("ADMIN", "메뉴 수정 완료", { menuId, name: menu.name });
      await Promise.all([loadMenus(), loadMealMenuOptions()]);
    } catch (error) {
      debugLog("ADMIN", "메뉴 수정 실패", { menuId, name: menu.name, message: error.message });
      text("menu-form-message", error.message);
    } finally {
      const editorActive = Boolean(menuForm.elements.menuId.value);
      submit.disabled = !editorActive;
      cancelMenuEditButton.disabled = !editorActive;
    }
  }
}

function paginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) items.push(null);
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push(null);
  items.push(totalPages);
  return items;
}

function summaryRow(item) {
  const consumed = formatPercentRatio(item.averageConsumedRatio);
  const leftover = formatPercentRatio(item.averageLeftoverRatio);
  const tone = consumptionTone(item.averageConsumedRatio);
  return `<tr>
    <td><strong>${escapeHtml(item.menuName)}</strong></td>
    <td>${formatNumber(item.analysisCount)}회</td>
    <td><span class="table-bar"><i class="consumption-${tone}" style="width:${ratioWidth(item.averageConsumedRatio)}%"></i></span><b>${consumed}</b></td>
    <td><b>${leftover}</b></td>
  </tr>`;
}

function menuRow(menu) {
  const ingredients = menu.ingredients?.join(", ") || "-";
  const allergens = menu.allergens?.map((item) => item.name).filter(Boolean).join(", ") || "없음";
  return `<tr>
    <td><strong>${escapeHtml(menu.name)}</strong></td>
    <td>${formatNumber(menu.standardServingG)}g</td>
    <td>${escapeHtml(ingredients)}</td>
    <td>${escapeHtml(allergens)}</td>
    <td><button type="button" class="btn secondary" data-edit-menu-id="${escapeHtml(menu.menuId)}" aria-label="${escapeHtml(menu.name)} 메뉴 수정">수정</button></td>
  </tr>`;
}

function mealMenuOption(menu) {
  return `<option value="${escapeHtml(menu.menuId)}">${escapeHtml(menu.name)} · ${formatNumber(menu.standardServingG)}g</option>`;
}

function allergenOption(item, name, disabled = false) {
  return `<label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(item.code)}"${disabled ? " disabled" : ""}><span>${escapeHtml(item.name)}</span></label>`;
}

function existingMealMenuEntry(menu) {
  return {
    kind: "existing",
    menuId: Number(menu.menuId),
    name: menu.name,
    standardServingG: menu.standardServingG,
  };
}

function selectedMealMenuRow(key, menu) {
  const typeLabel = menu.kind === "new" ? "새 메뉴 · 미저장" : "등록 메뉴";
  const typeClass = menu.kind === "new" ? "new" : "existing";
  return `<tr>
    <td><strong>${escapeHtml(menu.name)}</strong></td>
    <td><span class="menu-source ${typeClass}">${typeLabel}</span></td>
    <td>${formatNumber(menu.standardServingG)}g</td>
    <td><button type="button" class="btn secondary" data-remove-meal-menu-id="${escapeHtml(key)}" aria-label="${escapeHtml(menu.name)} 식단에서 삭제">삭제</button></td>
  </tr>`;
}

function parseIngredients(value) {
  return String(value)
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isNonNegativeNumber(value) {
  return String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function setMetricLoading() {
  ["total-users", "meal-record-count", "completed-analysis-count", "admin-average-intake", "admin-average-leftover"].forEach((id) => text(id, "-"));
}

function setMetricError(message) {
  setMetricLoading();
  text("completed-analysis-count", message);
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "-";
}

function ratioWidth(value) {
  const ratio = Number(value);
  return Number.isFinite(ratio) ? Math.min(100, Math.max(0, ratio * 100)) : 0;
}

function consumptionTone(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return "neutral";
  if (ratio >= .8) return "high";
  if (ratio >= .5) return "medium";
  return "low";
}

function toLocalDateInput(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}
