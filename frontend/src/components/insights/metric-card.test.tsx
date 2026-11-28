import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MetricCard } from "./metric-card";

afterEach(cleanup);

it("leads with the sentence, then the value and label, with a definition one click away", () => {
  render(<MetricCard sentence="You passed 13 of 21 activities. 8 more are open." value="62%" metric="student_activities_passed" />);
  const card = screen.getByRole("region", { name: "Activities passed" });
  expect(card.firstElementChild?.textContent).toBe("You passed 13 of 21 activities. 8 more are open.");
  expect(card.textContent).toContain("62% Activities passed");

  const info = screen.getByRole("button", { name: "What does Activities passed mean?" });
  const note = screen.getByRole("note", { hidden: true });
  expect(note.hidden).toBe(true);
  fireEvent.click(info);
  expect(info.getAttribute("aria-expanded")).toBe("true");
  expect(note.hidden).toBe(false);
  expect(note.textContent).toContain("passed at least once");
  fireEvent.keyDown(info, { key: "Escape" });
  expect(note.hidden).toBe(true);
});

it("opens the definition on hover too", () => {
  render(<MetricCard sentence="8 of the 13 you passed went through on the first try." value="8" metric="first_try_passes" />);
  fireEvent.mouseEnter(screen.getByRole("button", { name: /Passed on the first try/ }));
  expect(screen.getByRole("note").textContent).toContain("first attempt");
});

it("stays open when a hover is followed by a click", () => {
  render(<MetricCard sentence="x" value="1" metric="first_try_passes" />);
  const info = screen.getByRole("button", { name: /Passed on the first try/ });
  fireEvent.mouseEnter(info);
  fireEvent.click(info);
  fireEvent.mouseLeave(info);
  expect(screen.getByRole("note").hidden).toBe(false);
});

it("shows the change since last week only when there is one", () => {
  const { rerender } = render(<MetricCard sentence="4 of 21 learners haven't started." value={4} metric="not_started" change="↓ 3 fewer since last week" />);
  expect(screen.getByText("↓ 3 fewer since last week")).toBeTruthy();
  rerender(<MetricCard sentence="4 of 21 learners haven't started." value={4} metric="not_started" change="" />);
  expect(screen.queryByText(/since last week/)).toBeNull();
});
