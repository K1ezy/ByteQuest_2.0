import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "@/components/app-shell";
import { authReturnTo, questRedirect } from "@/lib/navigation";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/courses",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/chat/chat-shell", () => ({ ChatShell: () => null }));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn() }) }));

const admin = { role: "admin", enrolled_language: "python" } as Profile;
const student = { ...admin, role: "student" } as Profile;
afterEach(cleanup);

it("renders the role's destinations once, with the current page marked", () => {
  render(<AppShell profile={admin}><p>Course screen</p></AppShell>);
  // One navigation landmark serves as the desktop sidebar and the phone tab bar.
  const navigation = screen.getByRole("navigation", { name: "Administrator navigation" });
  expect(within(navigation).getAllByRole("link")).toHaveLength(5);
  const target = within(navigation).getByRole("link", { name: /^Course & Instructor Management/ });
  expect(target.getAttribute("aria-current")).toBe("page");
  expect(within(target).getByText("Courses")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Quest Map/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
});

it("opens the account menu and closes it on Escape or a tap outside", () => {
  render(<AppShell profile={student}><p>Quest screen</p></AppShell>);
  const trigger = screen.getByRole("button", { name: "Account" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();

  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const panel = screen.getByRole("region", { name: "Account" });
  expect(within(panel).getByRole("link", { name: "Profile" }).getAttribute("href")).toBe("/profile");
  expect(within(panel).getByText("PYTHON")).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);

  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByText("Quest screen"));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("keeps exam return paths internal and role appropriate", () => {
  expect(authReturnTo(student, "/exams/exam-id?resume=1")).toBe("/exams/exam-id?resume=1");
  expect(authReturnTo(admin, "/exams/exam-id")).toBeNull();
  expect(authReturnTo(student, "//example.test")).toBeNull();
  expect(authReturnTo(student, "/admin")).toBeNull();
  expect(authReturnTo(admin, "/faculty/review/draft-id")).toBeNull();
  expect(authReturnTo({ ...admin, role: "instructor" }, "/faculty/review/draft-id?course=one"))
    .toBe("/instructor/review/draft-id?course=one");
});

it("resolves legacy role links and retains workshop filters", () => {
  for (const [role, target] of [["student", "/quests"], ["instructor", "/instructor"], ["admin", "/admin/teaching"]] as const) {
    expect(questRedirect(new URLSearchParams("view=faculty"), role)).toBe(target);
  }
  expect(questRedirect(new URLSearchParams("group=one&category=code-challenge"))).toBe("/workshops?group=one&category=code-challenge");
});
