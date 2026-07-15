import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: {
    hasSession: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
  clearUser: vi.fn(),
  debugLog: vi.fn(),
  readUser: vi.fn(),
  saveUser: vi.fn(),
}));

vi.mock("../src/api.js", () => ({ api: mocks.api }));
vi.mock("../src/common.js", () => ({
  clearUser: mocks.clearUser,
  debugLog: mocks.debugLog,
  readUser: mocks.readUser,
  saveUser: mocks.saveUser,
}));

describe("로그인 화면 회원가입", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.api.hasSession.mockReturnValue(false);
    mocks.api.signup.mockImplementation(() => new Promise(() => { }));

    document.body.innerHTML = `
      <form id="login-form">
        <input name="loginId" required>
        <input name="password" type="password" minlength="8" required>
        <div id="signup-fields" hidden>
          <input name="name">
          <input name="studentNumber">
        </div>
        <p id="login-message"></p>
        <button type="submit" data-auth-action="login">로그인</button>
        <button type="button" data-auth-action="signup" aria-expanded="false">회원가입</button>
      </form>
    `;
    document.querySelector("#login-form").reportValidity = vi.fn(() => true);

    await import("../src/pages/login.js");
  });

  it("회원가입 버튼을 처음 누르면 추가 필드를 표시한다", () => {
    const signupButton = document.querySelector('[data-auth-action="signup"]');
    const signupFields = document.querySelector("#signup-fields");

    signupButton.click();

    expect(signupFields.hidden).toBe(false);
    expect(signupButton.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#login-message").textContent).toContain("이름과 학번");
  });

  it("기존 아이디와 비밀번호를 공유해 회원가입 요청을 보낸다", async () => {
    const form = document.querySelector("#login-form");
    const signupButton = document.querySelector('[data-auth-action="signup"]');
    form.elements.loginId.value = "student02";
    form.elements.password.value = "Password123!";

    signupButton.click();
    form.elements.name.value = "김학생";
    form.elements.studentNumber.value = "20260001";
    signupButton.click();
    await Promise.resolve();

    expect(mocks.api.signup).toHaveBeenCalledWith({
      loginId: "student02",
      password: "Password123!",
      name: "김학생",
      studentNumber: "20260001",
      allergenCodes: [],
    });
  });
});
