import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppTooltips } from "./app-tooltips";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

it("opens on keyboard focus, preserves existing descriptions, and dismisses without moving focus", () => {
  render(<>
    <button aria-describedby="original" data-tooltip="Enter your instructor's code.">Join Workshop</button>
    <span id="original">A workshop requires an invitation.</span>
    <AppTooltips />
  </>);
  const button = screen.getByRole("button", { name: "Join Workshop" });
  act(() => button.focus());
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.textContent).toBe("Enter your instructor's code.");
  expect(button.getAttribute("aria-describedby")).toBe(`original ${tooltip.id}`);

  fireEvent.keyDown(button, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute("aria-describedby")).toBe("original");
});

it("stays visible when the pointer crosses from the trigger to the tooltip", () => {
  render(<><button data-tooltip="Show only completed quests.">Done</button><AppTooltips /></>);
  const button = screen.getByRole("button", { name: "Done" });
  fireEvent.pointerOver(button, { pointerType: "mouse" });
  advance(350);
  const tooltip = screen.getByRole("tooltip");
  fireEvent.pointerOut(button, { pointerType: "mouse", relatedTarget: document.body });
  advance(80);
  fireEvent.pointerOver(tooltip, { pointerType: "mouse" });
  advance(200);
  expect(screen.getByRole("tooltip")).toBe(tooltip);

  fireEvent.pointerOut(tooltip, { pointerType: "mouse", relatedTarget: document.body });
  advance(180);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("explains a touch long press without firing the action and lets a normal tap through", () => {
  const action = vi.fn();
  render(<><button onClick={action} data-tooltip="Check for new grades.">Refresh</button><AppTooltips /></>);
  const button = screen.getByRole("button", { name: "Refresh" });
  fireEvent.pointerDown(button, { pointerType: "touch" });
  advance(550);
  fireEvent.pointerUp(button, { pointerType: "touch" });
  fireEvent.click(button, { detail: 1 });
  expect(action).not.toHaveBeenCalled();
  expect(screen.getByRole("tooltip").textContent).toBe("Check for new grades.");

  fireEvent.pointerDown(button, { pointerType: "touch" });
  fireEvent.pointerUp(button, { pointerType: "touch" });
  fireEvent.click(button, { detail: 1 });
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
