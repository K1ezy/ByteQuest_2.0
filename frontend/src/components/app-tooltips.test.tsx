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

it("labels icon-only controls visually without repeating their name as a description", () => {
  render(<>
    <a href="/instructor#recent" aria-label="Recent course activity"><svg aria-hidden="true" /></a>
    <button aria-label="Close dialog">Close</button>
    <AppTooltips />
  </>);
  const icon = screen.getByRole("link", { name: "Recent course activity" });
  fireEvent.pointerOver(icon, { pointerType: "mouse" });
  advance(350);
  expect(screen.getByRole("tooltip").textContent).toBe("Recent course activity");
  expect(icon.hasAttribute("aria-describedby")).toBe(false);

  fireEvent.pointerOut(icon, { pointerType: "mouse", relatedTarget: document.body });
  advance(180);
  fireEvent.pointerOver(screen.getByRole("button", { name: "Close dialog" }), { pointerType: "mouse" });
  advance(350);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("opens plain-text help on tap and leaves a link's native long press alone", () => {
  render(<>
    <span data-tooltip="3 or more attempts without passing">2 stuck</span>
    <a href="/quests" data-tooltip="Open the Quest Map.">Quests</a>
    <AppTooltips />
  </>);
  const chip = screen.getByText("2 stuck");
  fireEvent.pointerDown(chip, { pointerType: "touch" });
  fireEvent.pointerUp(chip, { pointerType: "touch" });
  fireEvent.click(chip, { detail: 1 });
  expect(screen.getByRole("tooltip").textContent).toBe("3 or more attempts without passing");

  fireEvent.pointerDown(chip, { pointerType: "touch" });
  fireEvent.click(chip, { detail: 1 });
  expect(screen.queryByRole("tooltip")).toBeNull();

  const link = screen.getByRole("link", { name: "Quests" });
  fireEvent.pointerDown(link, { pointerType: "touch" });
  advance(550);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(fireEvent.contextMenu(link)).toBe(true);
});
