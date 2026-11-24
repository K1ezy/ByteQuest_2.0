import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AccessibilityProvider } from "@/components/accessibility-provider";
import { AppShell } from "@/components/app-shell";
import { MenuPositionSetting } from "@/components/workspace/dockable-navigation";
import { authReturnTo, questRedirect } from "@/lib/navigation";
import type { Profile } from "@/lib/types";

const route = vi.hoisted(() => ({ path: "/admin/courses", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(route.search),
}));
vi.mock("@/components/chat/chat-shell", () => ({ ChatShell: () => null }));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ signOut: vi.fn() }) }));

const admin = { id: "admin-a", role: "admin", enrolled_language: "python" } as Profile;
const student = { ...admin, id: "student-b", role: "student" } as Profile;
afterEach(() => { cleanup(); route.path = "/admin/courses"; route.search = ""; });

it("renders the role's destinations once, with the current page marked", () => {
  const view = render(<AppShell profile={admin}><p>Course screen</p></AppShell>);
  // One navigation landmark serves as the desktop sidebar and the phone tab bar.
  const navigation = screen.getByRole("navigation", { name: "Administrator navigation" });
  expect(within(navigation).getAllByRole("link")).toHaveLength(5);
  const target = within(navigation).getByRole("link", { name: /^Course & Instructor Management/ });
  expect(target.getAttribute("aria-current")).toBe("page");
  expect(within(target).getByText("Courses")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Quest Map/ })).toBeNull();
  // The rail is the only navigation: no separate Menu toggle or drawer repeats it.
  expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  // Menu position lives in Accessibility settings and moves the open navigation immediately.
  const setting = within(render(<MenuPositionSetting ownerId={admin.id} />).container);
  fireEvent.click(setting.getByRole("button", { name: "Move right" }));
  expect(setting.getByRole("button", { name: "Move right" }).getAttribute("aria-pressed")).toBe("true");
  expect(view.container.querySelector(".bq-dock")?.getAttribute("data-side")).toBe("right");
  view.rerender(<AppShell profile={student}><p>Student screen</p></AppShell>);
  expect(view.container.querySelector(".bq-dock")?.getAttribute("data-side")).toBe("left");
  view.rerender(<AppShell profile={admin}><p>Course screen</p></AppShell>);
  expect(view.container.querySelector(".bq-dock")?.getAttribute("data-side")).toBe("right");
});

it("opens Accessibility over the current page and closes it from the space around the card", () => {
  // jsdom doesn't implement native modal dialogs.
  const { showModal, close } = HTMLDialogElement.prototype;
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; this.dispatchEvent(new Event("close")); };
  try {
    render(<AccessibilityProvider><AppShell profile={student}><p>Quest screen</p></AppShell></AccessibilityProvider>);
    const trigger = screen.getByRole("button", { name: "Account" });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("region", { name: "Account" })).getByRole("button", { name: "Accessibility" }));
    const dialog = screen.getByRole("dialog", { name: "Accessibility settings" });
    expect(within(dialog).getByRole("group", { name: "Menu position" })).toBeTruthy();
    expect(screen.getByText("Quest screen")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("heading", { name: "Accessibility settings" }));
    expect(screen.queryByRole("dialog", { name: "Accessibility settings" })).not.toBeNull();
    fireEvent.click(dialog);  // the backdrop and the space around the card
    expect(screen.queryByRole("dialog", { name: "Accessibility settings" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByText("Quest screen")).toBeTruthy();
  } finally {
    Object.assign(HTMLDialogElement.prototype, { showModal, close });
  }
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
  expect(authReturnTo(student, "/quests?category=exams")).toBe("/quests?category=exams");
  expect(authReturnTo(admin, "/quests?category=exams")).toBeNull();
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

it("returns a focus page to the filtered list it was opened from", () => {
  route.path = "/quests"; route.search = "category=code-challenge";
  const view = render(<AppShell profile={student}><p>Quest screen</p></AppShell>);
  route.path = "/arena/quest-1"; route.search = "";
  view.rerender(<AppShell profile={student}><p>Arena</p></AppShell>);
  expect(screen.getByRole("link", { name: "Back to Quest Map" }).getAttribute("href")).toBe("/quests?category=code-challenge");
  // Submission status is part of the attempt, so the next challenge still returns to the list.
  route.path = "/submissions/job-1";
  view.rerender(<AppShell profile={student}><p>Status</p></AppShell>);
  route.path = "/arena/quest-2";
  view.rerender(<AppShell profile={student}><p>Arena</p></AppShell>);
  expect(screen.getByRole("link", { name: "Back to Quest Map" }).getAttribute("href")).toBe("/quests?category=code-challenge");
  route.path = "/workshops/w-1/activities";
  view.rerender(<AppShell profile={student}><p>Workshop</p></AppShell>);
  route.path = "/quiz/quest-3";
  view.rerender(<AppShell profile={student}><p>Quiz</p></AppShell>);
  expect(screen.getByRole("link", { name: "Back to Workshops" }).getAttribute("href")).toBe("/workshops/w-1/activities");
  route.path = "/exams/exam-1";
  view.rerender(<AppShell profile={student}><p>Exam</p></AppShell>);
  expect(screen.getByRole("link", { name: "Back to Exams" }).getAttribute("href")).toBe("/quests?category=exams");
});
