import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataRow, InlineEmpty, InlineError, PageHeader, Section, StatStrip, StatusBadge } from "./course-ui";
import { CourseSwitcher, InstructorCourseShell } from "./course-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/instructor" }));
vi.mock("@/components/account-menu", () => ({ AccountMenu: () => <button>Account</button> }));
vi.mock("@/components/chat/chat-shell", () => ({ ChatShell: () => <button>Chat assistant</button> }));
vi.mock("@/components/workspace/workspace-provider", () => ({ useWorkspace: () => ({
  courseId: "one", courses: [{ id: "one", title: "Course One" }],
  courseHref: (href: string) => href, setCourse: vi.fn(), profile: {},
}) }));

afterEach(cleanup);

it("renders the heading, one stat strip, and independent row actions in reading order", () => {
  const retry = vi.fn();
  const { container } = render(<>
    <PageHeader title="Good morning" subtitle="1 thing needs you today" actions={<button>New activity</button>} />
    <StatStrip items={[{ label: "Enrolled", value: 3, note: "In this course" }, { label: "Active", value: 2, change: { current: 2, previous: 3 } }]} />
    <Section title="Needs your attention" id="attention"><ul>
      <DataRow status={<StatusBadge tone="danger">Failed</StatusBadge>} title="Material PDF" href="/instructor/materials"
        description="Safe PDF" action={<button type="button" onClick={retry}>Retry</button>} />
    </ul></Section>
  </>);
  expect(screen.getByRole("heading", { name: "Good morning", level: 1 })).toBeTruthy();
  expect(container.querySelectorAll(".ic-stats")).toHaveLength(1);
  expect(screen.getByText("1 vs last week").classList.contains("down")).toBe(true);
  const row = within(screen.getByRole("listitem"));
  const title = row.getByRole("link", { name: "Material PDF" });
  const button = row.getByRole("button", { name: "Retry" });
  expect(title.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(title.getAttribute("href")).toBe("/instructor/materials");
  expect(row.getByText("Failed").classList.contains("danger")).toBe(true);
  fireEvent.click(button);
  expect(retry).toHaveBeenCalledOnce();
});

it("renders an inline error with retry without replacing neighboring content", () => {
  const retry = vi.fn();
  render(<><InlineEmpty>Nothing opens in the next 14 days.</InlineEmpty><InlineError onRetry={retry} /></>);
  expect(screen.getByText("Nothing opens in the next 14 days.")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Couldn't load this section.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
});

it("switches courses through a labeled control and restores focus", () => {
  const select = vi.fn();
  const { container } = render(<CourseSwitcher selected="one" onSelect={select} courses={[{ id: "one", title: "One" }, { id: "two", title: "Two" }]} />);
  const trigger = screen.getByLabelText("Choose course");
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: "Two" }));
  expect(select).toHaveBeenCalledWith("two");
  expect(container.querySelector("details")?.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("groups desktop navigation while preserving the phone destinations", () => {
  render(<InstructorCourseShell><p>Dashboard contents</p></InstructorCourseShell>);
  const desktop = within(screen.getByRole("navigation", { name: "Instructor" }));
  expect(desktop.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Dashboard", "Activities", "Review drafts", "Materials", "Exams", "Announcements", "Progress", "Gradebook", "Gamification", "Machine learning",
  ]);
  expect(desktop.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  expect(within(screen.getByRole("navigation", { name: "Instructor navigation" })).getAllByRole("link")).toHaveLength(5);
});
