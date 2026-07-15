import { api } from "../api.js";
import { clearUser, debugLog, readUser, saveUser } from "../common.js";

const form = document.querySelector("#login-form");
const message = document.querySelector("#login-message");
const loginButton = form.querySelector('[data-auth-action="login"]');
const signupButton = form.querySelector('[data-auth-action="signup"]');
const signupFields = document.querySelector("#signup-fields");

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
  signupButton.addEventListener("click", handleSignupClick);
  signupFields.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    signupButton.click();
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const loginId = form.elements.loginId.value.trim();
  debugLog("LOGIN", "로그인 제출", { loginId });
  setBusy(true, "login");
  setMessage();

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
    setMessage(error.message || "로그인하지 못했습니다.", "error");
  } finally {
    setBusy(false);
  }
}

async function handleSignupClick() {
  if (signupFields.hidden) {
    signupFields.hidden = false;
    signupButton.setAttribute("aria-expanded", "true");
    form.elements.password.autocomplete = "new-password";
    setMessage("이름과 학번을 입력한 뒤 회원가입 버튼을 다시 눌러 주세요.", "hint");
    form.elements.name.focus();
    return;
  }

  if (!form.reportValidity()) return;

  const loginId = form.elements.loginId.value.trim();
  const password = form.elements.password.value;
  const name = form.elements.name.value.trim();
  const studentNumber = form.elements.studentNumber.value.trim();
  const missingField = [
    [name, form.elements.name, "이름을 입력해 주세요."],
    [studentNumber, form.elements.studentNumber, "학번을 입력해 주세요."],
  ].find(([value]) => !value);

  if (missingField) {
    const [, input, errorMessage] = missingField;
    setMessage(errorMessage, "error");
    input.focus();
    return;
  }

  debugLog("SIGNUP", "회원가입 제출", { loginId, studentNumber });
  setBusy(true, "signup");
  setMessage();
  let signupCompleted = false;

  try {
    const registeredUser = await api.signup({
      loginId,
      password,
      name,
      studentNumber,
      allergenCodes: [],
    });
    signupCompleted = true;
    await api.login({ loginId, password });
    const user = registeredUser?.role ? registeredUser : await api.getCurrentUser();
    saveUser(user);
    debugLog("SIGNUP", "회원가입 및 자동 로그인 성공", { userId: user.id, role: user.role });
    redirectAfterLogin(user);
  } catch (error) {
    debugLog("SIGNUP", "회원가입 처리 실패", { loginId, signupCompleted, message: error.message });
    const errorMessage = signupCompleted
      ? `회원가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인 버튼을 눌러 주세요. ${error.message || ""}`.trim()
      : error.message || "회원가입하지 못했습니다.";
    setMessage(errorMessage, "error");
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy, action = "") {
  loginButton.disabled = isBusy;
  signupButton.disabled = isBusy;
  loginButton.textContent = isBusy && action === "login" ? "로그인 중..." : "로그인";
  signupButton.textContent = isBusy && action === "signup" ? "가입 중..." : "회원가입";
}

function setMessage(text = "", type = "") {
  message.textContent = text;
  message.dataset.type = type;
}

function redirectAfterLogin(user) {
  const destination = user.role === "ADMIN" ? "/admin.html" : "/dashboard.html";
  debugLog("LOGIN", "로그인 후 이동", { destination });
  location.href = destination;
}
