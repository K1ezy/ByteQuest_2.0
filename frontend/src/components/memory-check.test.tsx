import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { MemoryCheck } from "./memory-check";

afterEach(() => { cleanup(); mocks.api.mockReset(); mocks.push.mockReset(); });

it("opens the API's earliest due recall from the memory check", async () => {
  mocks.api.mockResolvedValueOnce({
    due_count: 2,
    concepts: [{ state: "fading", concept: "Loops" }, { state: "due", concept: "Arrays" }],
  }).mockResolvedValueOnce({ id: "review" });
  render(<MemoryCheck userId="student" />);
  expect(await screen.findByText("2 concepts are due for a quick recall.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start review" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/reviews/review"));
  expect(mocks.api).toHaveBeenLastCalledWith("/reviews/start", {
    method: "POST", body: JSON.stringify({ concept: "Loops" }),
  });
});

it("shows a loading skeleton and lets the learner retry a memory check error", async () => {
  mocks.api.mockRejectedValueOnce(new Error("Service unavailable")).mockResolvedValueOnce({ due_count: 0, concepts: [] });
  render(<MemoryCheck userId="student" />);
  expect(screen.getByRole("status", { name: "Loading memory checks" })).toBeTruthy();
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Memory check" })).toBeNull());
});

it("shows a locked Mastery Memory teaser and the API-scheduled countdown", async () => {
  mocks.api.mockResolvedValueOnce({
    due_count: 0, concepts: [], locked: true, day: 31,
    unlock: { unlocked: false, unlock_day: 35, unlocks_on: "2026-11-19" },
  });
  render(<MemoryCheck userId="student" />);
  expect(await screen.findByRole("heading", { name: "Mastery Memory" })).toBeTruthy();
  expect(screen.getByText("Unlocks on day 35")).toBeTruthy();
  expect(screen.getByText("Unlocks in 4 days")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start review" })).toBeNull();
});
