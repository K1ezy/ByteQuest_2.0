import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ username: "kieser", display_name: null, enrolled_language: "python" }),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import Page from "./page";

afterEach(() => { cleanup(); mocks.apiRequest.mockReset(); });

it("keeps upcoming work on Dashboard and links to metrics in Profile", async () => {
  mocks.apiRequest.mockImplementation(async (path: string) => path === "/pilot/dashboard" ? {
    recommendation: { rationale: "More practice is recommended.", recommended_action: "remedial_practice" },
    next_activity: { id: "next", title: "Even or Odd", kind: "challenge" },
    completed: 5, total: 9, xp: 340, level: 2, pending_job_id: "job",
    due_exam: { id: "exam", title: "Practice exam", closes_at: "2099-11-24T05:00:00Z" }, notices: [],
  } : { items: [], available: false });

  render(<Page />);

  expect((await screen.findByRole("link", { name: /Continue quest/ })).getAttribute("href")).toBe("/arena/next");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Good (morning|afternoon|evening), Kieser!$/);
  expect(screen.queryByRole("link", { name: /Open exam/ })).toBeNull();
  expect(screen.getByRole("link", { name: "View submission status" }).getAttribute("href")).toBe("/submissions/job");
  expect(screen.getByRole("link", { name: "View my progress" }).getAttribute("href")).toBe("/profile?tab=activity");
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Recent attempts" })).toBeNull();
  expect(mocks.apiRequest.mock.calls.some(([path]) => String(path).startsWith("/quests/progress"))).toBe(false);
});
