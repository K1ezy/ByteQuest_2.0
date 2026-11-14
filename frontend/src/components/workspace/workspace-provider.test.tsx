import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("renders role-specific navigation and closes it on selection or Escape", () => {
  render(<AppShell profile={admin}><p>Course screen</p></AppShell>);
  const toggle = screen.getByRole("button", { name: "Menu" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  const target = screen.getByRole("link", { name: "Course & Instructor Management" });
  expect(target.getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", { name: "Quest Map" })).toBeNull();
  fireEvent.keyDown(target, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  target.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(target);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
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
