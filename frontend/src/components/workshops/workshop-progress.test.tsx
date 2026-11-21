import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./workshop-layout", () => ({ useWorkshop: () => ({ workshop: { id: "w" } }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { WorkshopProgress } from "./workshop-progress";

afterEach(cleanup);

it("renders the three practice states in an accessible student-by-activity table", async () => {
  mocks.api.mockResolvedValueOnce({
    activities: [{ id: "a", title: "Loops" }, { id: "b", title: "Lists" }, { id: "c", title: "Functions" }],
    students: [{ id: "s", username: "learner", display_name: "Test Student", completion_percent: 33,
      states: { a: "solved", b: "attempted", c: "not_started" } }],
  });
  render(<WorkshopProgress />);
  const table = within(await screen.findByRole("table", { name: "Practice activity progress by student" }));
  expect(table.getByRole("columnheader", { name: "Loops" })).toBeTruthy();
  expect(table.getByRole("rowheader", { name: /@learner/ })).toBeTruthy();
  for (const name of ["Solved", "Attempted", "Not started", "33%"]) {
    expect(table.getByRole("cell", { name })).toBeTruthy();
  }
});
