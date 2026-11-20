import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OnboardingPage from "./page";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  reset: vi.fn(),
  query: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => auth.router, useSearchParams: () => auth.query }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/student-signup", () => ({ signUpStudent: auth.signUp }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signInWithPassword: auth.signIn,
  resetPasswordForEmail: auth.reset,
} }) }));

beforeEach(() => { auth.query = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function openAuth(query = "") {
  auth.query = new URLSearchParams(query);
  render(<OnboardingPage />);
  await screen.findByRole("heading", { level: 1 });
}

it.each(["", "startup_auth=1&startup_run=test"])("starts with choices and opens sign-in (%s)", async (query) => {
  await openAuth(query);
  expect(screen.queryByLabelText("Email address")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(screen.queryByLabelText("Username")).toBeNull();
  const email = screen.getByLabelText("Email address") as HTMLInputElement;
  expect(email.required).toBe(true);
  fireEvent.change(email, { target: { value: "learner@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "Reset it here" }));
  expect((screen.getByLabelText("Registered email address") as HTMLInputElement).value).toBe("learner@example.test");
});

it.each(["mode=signin", "mode=instructor", "mode=signin&reset=success"])("supports direct sign-in (%s)", async (query) => {
  await openAuth(query);
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
});

it.each(["Instructor", "Administrator"])("shows invitation instructions for %s without registration fields", async (role) => {
  await openAuth();
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  for (const option of ["Student", "Instructor", "Administrator"]) expect(screen.getByRole("button", { name: option })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: role }));
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: `${role} account` }));
  expect(screen.queryByLabelText("School ID")).toBeNull();
  expect(auth.signUp).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back to roles" }));
  fireEvent.click(screen.getByRole("button", { name: "Back to menu" }));
  expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
});

it("shows direct registration fields for Instructor in local mode", async () => {
  vi.stubEnv("NEXT_PUBLIC_LOCAL_STAFF_REGISTRATION", "true");
  await openAuth();
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  fireEvent.click(screen.getByRole("button", { name: "Instructor" }));
  expect(screen.getByLabelText("School ID")).toBeTruthy();
  expect(screen.getByLabelText("Password")).toBeTruthy();
  expect(screen.queryByLabelText("Year level")).toBeNull();
  expect(screen.queryByLabelText("Block section")).toBeNull();
});

it("shows administrator grant instructions in local mode", async () => {
  vi.stubEnv("NEXT_PUBLIC_LOCAL_STAFF_REGISTRATION", "true");
  await openAuth();
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  fireEvent.click(screen.getByRole("button", { name: "Administrator" }));
  expect(screen.getByRole("heading", { name: "Administrator account" })).toBeTruthy();
  expect(screen.getByText("infra/grant-local-instructor.ps1 -Role admin")).toBeTruthy();
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(auth.signUp).not.toHaveBeenCalled();
});

it("requires both policy panels and acknowledgments on each visit and submits once", async () => {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(300);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
  auth.signUp.mockImplementation(() => new Promise(() => {}));
  await openAuth();
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  expect(screen.queryByLabelText("School ID")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Student" }));
  // Password reset belongs to sign-in; a new account has no password to forget.
  expect(screen.queryByRole("button", { name: "Reset it here" })).toBeNull();
  for (const [label, value] of [["Username", "AdaHandle"], ["Email address", "learner@example.test"], ["Password", "password"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  const schoolId = screen.getByLabelText<HTMLInputElement>("School ID");
  fireEvent.change(schoolId, { target: { value: "26abcde" } });
  expect(schoolId.value).toBe("");
  fireEvent.change(schoolId, { target: { value: "2600123" } });
  expect(schoolId.value).toBe("26-00123");
  fireEvent.change(screen.getByLabelText("Year level"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Block section"), { target: { value: "F" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const agree = screen.getByRole<HTMLButtonElement>("button", { name: "I agree" });
  expect(agree.disabled).toBe(true);
  expect(screen.getAllByRole<HTMLInputElement>("checkbox").every((box) => box.disabled)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "I disagree" }));
  expect(auth.signUp).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  for (const policy of ["Terms of Service", "Privacy Policy"]) {
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "I agree" }).disabled).toBe(true);
    const panel = screen.getByRole("region", { name: policy });
    const check = screen.getByRole<HTMLInputElement>("checkbox", { name: `I acknowledge the ${policy}` });
    expect(check.disabled).toBe(true);
    fireEvent.scroll(panel, { target: { scrollTop: 200 } });
    expect(check.disabled).toBe(false);
    fireEvent.click(check);
  }
  const submit = screen.getByRole<HTMLButtonElement>("button", { name: "I agree" });
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(auth.signUp).toHaveBeenCalledExactlyOnceWith("learner@example.test", "password", "AdaHandle", { schoolId: "26-00123", yearLevel: 3, blockSection: "F" });
});

it("unlocks acknowledgment when the document already fits", async () => {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(100);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
  await openAuth();
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  expect(screen.queryByLabelText("School ID")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Student" }));
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Learner" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "learner@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
  fireEvent.change(screen.getByLabelText("School ID"), { target: { value: "26-00123" } });
  fireEvent.change(screen.getByLabelText("Year level"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Block section"), { target: { value: "F" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getAllByRole<HTMLInputElement>("checkbox").every((box) => !box.disabled)).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "I agree" }).disabled).toBe(true);
});

it("shows a duplicate-email error beside the agreement actions and prefills sign-in", async () => {
  auth.signUp.mockRejectedValueOnce({ code: "user_already_exists" });
  await openAuth();
  for (const name of ["Sign up", "Student"]) fireEvent.click(screen.getByRole("button", { name }));
  for (const [label, value] of Object.entries({
    Username: "Learner", "Email address": "learner@example.test", Password: "password",
    "School ID": "26-00123", "Year level": "3", "Block section": "F",
  })) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
  const agree = screen.getByRole("button", { name: "I agree" });
  fireEvent.click(agree);
  const error = await screen.findByRole("alert");
  expect(error.textContent).toContain("An account already uses this email");
  expect(agree.closest("form")?.contains(error)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("learner@example.test");
});
