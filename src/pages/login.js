import { api } from "../api.js";
import { clearUser, debugLog, readUser, saveUser } from "../common.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");

init();

async function init() {
  debugLog("LOGIN", "페이지 초기화");
  if (api.hasSession()) {
    debugLog("LOGIN", "기존 세션 확인");
    try {
      const user = readUser() || saveUser(await api.getCurrentUser());
      debugLog("LOGIN", "기존 세션 유효", { userId: user.id, role: user.role });
      redirectAfterLogin(user);
      return;
    } catch (error) {
      debugLog("LOGIN", "기존 세션 확인 실패", { message: error.message });
      clearUser();
    }
  }

  document.querySelectorAll("[data-demo-account]").forEach((button) => {
    button.addEventListener("click", () => {
      debugLog("LOGIN", "데모 계정 입력", { accountType: button.dataset.demoAccount });
      form.elements.loginId.value = button.dataset.demoAccount === "admin" ? "admin01" : "student01";
      form.elements.password.value = "Password123!";
      form.elements.loginId.focus();
    });
  });

  form.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();
  const loginId = form.elements.loginId.value.trim();
  debugLog("LOGIN", "로그인 제출", { loginId });
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "로그인 중...";
  message.textContent = "";

  try {
    const result = await api.login({
      loginId,
      password: form.elements.password.value,
    });
    const user = result?.role ? result : await api.getCurrentUser();
    saveUser(user);
    debugLog("LOGIN", "로그인 성공", { userId: user.id, role: user.role });
    redirectAfterLogin(user);
  } catch (error) {
    debugLog("LOGIN", "로그인 실패", { loginId, message: error.message });
    message.textContent = error.message || "로그인하지 못했습니다.";
  } finally {
    submit.disabled = false;
    submit.textContent = "로그인";
  }
}

function redirectAfterLogin(user) {
  const destination = user.role === "ADMIN" ? "/admin.html" : "/dashboard.html";
  debugLog("LOGIN", "로그인 후 이동", { destination });
  location.href = destination;
}
