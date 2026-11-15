import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import { CHOOSE_HANDLE_HREF, Leaderboard, type LeaderboardData } from "./leaderboard";

const ranked: LeaderboardData = {
  track: "python",
  entries: [
    { rank: 1, handle: "alpha", xp_points: 1200, current_level: 5, is_me: false },
    { rank: 2, handle: null, xp_points: 900, current_level: 4, is_me: false },
    { rank: 2, handle: "gamma", xp_points: 900, current_level: 4, is_me: false },
    { rank: 4, handle: "delta", xp_points: 300, current_level: 2, is_me: false },
  ],
  you: { rank: 12, handle: null, xp_points: 40, current_level: 1 },
  total_ranked: 15,
};

beforeEach(() => mocks.apiRequest.mockReset());
afterEach(cleanup);

it("shows tied ranks, anonymous learners, and the caller's own row outside the top entries", async () => {
  mocks.apiRequest.mockResolvedValue(ranked);
  render(<Leaderboard />);

  expect(await screen.findByRole("heading", { name: "You're #12 of 15 ranked learners" })).toBeTruthy();
  expect(screen.getByText(/Top learners on the Python track/)).toBeTruthy();
  const table = screen.getByRole("table", { name: "Top learners" });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(
    ["🥇 Rank 01", "🥈 Rank 02", "🥈 Rank 02", "Rank 04", "Rank 12"]);
  expect(within(rows[1]).getByText("Anonymous learner")).toBeTruthy();
  expect(within(rows[4]).getByText("You")).toBeTruthy();
  expect(rows[4].getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("link", { name: "Choose your @handle" }).getAttribute("href")).toBe(CHOOSE_HANDLE_HREF);
  expect(screen.getByText(/never names or email addresses/)).toBeTruthy();
});

it("guides an unranked learner and handles an empty track", async () => {
  mocks.apiRequest.mockResolvedValue({
    track: "java", entries: [], you: { rank: null, handle: "kezy", xp_points: 0, current_level: 1 }, total_ranked: 0,
  });
  render(<Leaderboard />);

  expect(await screen.findByRole("heading", { name: "You're not ranked yet" })).toBeTruthy();
  expect(screen.getByText("@kezy")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Choose your @handle" })).toBeNull();
  expect(screen.getByText("No one on the Java track has earned XP yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Go to Quest Map" }).getAttribute("href")).toBe("/quests");
  expect(screen.queryByRole("table")).toBeNull();
});

it("offers a retry when the leaderboard cannot load", async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error("Leaderboard offline")).mockResolvedValueOnce(ranked);
  render(<Leaderboard />);

  expect(await screen.findByText("Leaderboard offline")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("table", { name: "Top learners" })).toBeTruthy();
});
