import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MechanicIntro, MechanicTeaser } from "./mechanic-rollout";

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

it("keeps the unlock day visible before practice starts", () => {
  render(<MechanicTeaser mechanic="codex" day={0} unlock={{ unlocked: false, unlock_day: 21, unlocks_on: null }} />);
  expect(screen.getByText("Unlocks on day 21")).toBeTruthy();
  expect(screen.queryByText(/Unlocks in/)).toBeNull();
});

it("remembers an intro dismissal only for the current learner and mechanic", () => {
  const intro = () => <MechanicIntro mechanic="codex" userId="ana" />;
  const first = render(intro());
  expect(screen.getByText("Turn bugs into progress.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Debugger's Codex introduction" }));
  first.unmount();
  render(intro());
  expect(screen.queryByText("Turn bugs into progress.")).toBeNull();
  render(<MechanicIntro mechanic="codex" userId="ben" />);
  expect(screen.getByText("Turn bugs into progress.")).toBeTruthy();
  render(<MechanicIntro mechanic="memory" userId="ana" />);
  expect(screen.getByText("Keep what you learned fresh with short Recall quests.")).toBeTruthy();
});

it("lets the learner dismiss an intro while browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  render(<MechanicIntro mechanic="codex" userId="ana" />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Debugger's Codex introduction" }));
  expect(screen.queryByText("Turn bugs into progress.")).toBeNull();
});
