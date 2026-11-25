import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataRow, InlineEmpty, InlineError, PageHeader, Section, StatStrip, StatusBadge } from "./course-ui";
import type { Profile } from "@/lib/types";
import { CourseSwitcher, InstructorCourseShell, InstructorShell } from "./course-shell";

const location = vi.hoisted(() => ({ pathname: "/instructor" }));
vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));
vi.mock("@/components/account-menu", () => ({ AccountMenu: () => <button>Account</button> }));
vi.mock("@/components/chat/chat-shell", () => ({ ChatShell: () => <button>Chat assistant</button> }));
vi.mock("@/components/workspace/workspace-provider", () => ({ useWorkspace: () => ({
  courseId: "one", courses: [{ id: "one", title: "Course One" }],
  courseHref: (href: string) => href, setCourse: vi.fn(), profile: {},
}) }));

afterEach(() => { cleanup(); location.pathname = "/instructor"; });

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

it("uses the instructor navigation for a workshop without course context", () => {
  location.pathname = "/workshops/example/people";
  const profile = { id: "instructor", role: "instructor" } as Profile;
  render(<InstructorShell profile={profile} scope={<span>Workshop scope</span>}><h1>People</h1></InstructorShell>);

  expect(screen.getByText("Workshop scope")).toBeTruthy();
  expect(screen.queryByLabelText("Choose course")).toBeNull();
  expect(screen.getByRole("link", { name: "Recent course activity" })).toBeTruthy();
  const nav = within(screen.getByRole("navigation", { name: "Instructor" }));
  expect(nav.getByRole("link", { name: "Workshops" }).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", { name: "Activities" }).getAttribute("href")).toBe("/instructor/activities");
  expect(screen.getAllByRole("main")).toHaveLength(1);
});

it("names each page the same on desktop and phone, and reaches every page from More", () => {
  render(<InstructorCourseShell><p>Dashboard contents</p></InstructorCourseShell>);
  const pages = [
    "Dashboard", "Activities", "Workshops", "Materials", "Announcements", "Performance and Predictions", "Student Progress", "Gradebook", "Gamification", "Model evaluation",
  ];
  const desktop = within(screen.getByRole("navigation", { name: "Instructor" }));
  expect(desktop.getAllByRole("link").map((link) => link.textContent)).toEqual(pages);
  expect(desktop.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe("page");
  expect(desktop.getByRole("link", { name: "Workshops" }).getAttribute("href")).toBe("/workshops");
  const phone = within(screen.getByRole("navigation", { name: "Instructor navigation" }));
  expect(phone.getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Activities", "Performance and Predictions", "Student Progress"]);
  // jsdom doesn't implement native modal dialogs.
  const { showModal, close } = HTMLDialogElement.prototype;
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
  try {
    fireEvent.click(phone.getByRole("button", { name: "More" }));
    const more = within(screen.getByRole("navigation", { name: "All instructor pages" }));
    expect(more.getAllByRole("link").map((link) => link.textContent)).toEqual(pages);
    fireEvent.click(more.getByRole("link", { name: "Materials" }));
    expect(screen.queryByRole("navigation", { name: "All instructor pages" })).toBeNull();
    expect(document.activeElement).toBe(phone.getByRole("button", { name: "More" }));
  } finally {
    Object.assign(HTMLDialogElement.prototype, { showModal, close });
  }
});
