import { expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useNow } from "@/components/workspace/ui";
import { timeGreeting } from "./greeting";

it("uses the chosen username and changes the greeting at local day boundaries", () => {
  const at = (hour: number) => new Date(2026, 10, 12, hour, 0);
  expect(timeGreeting("kieser", at(4))).toBe("Good evening, Kieser!");
  expect(timeGreeting("kieser", at(5))).toBe("Good morning, Kieser!");
  expect(timeGreeting("kieser", at(11))).toBe("Good morning, Kieser!");
  expect(timeGreeting("kieser", at(12))).toBe("Good afternoon, Kieser!");
  expect(timeGreeting("kieser", at(18))).toBe("Good evening, Kieser!");
});

it("refreshes at the minute boundary and after a tab regains focus", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(2026, 10, 12, 11, 59, 30));
    function Greeting() {
      return <h1>{timeGreeting("kieser", useNow())}</h1>;
    }
    render(<Greeting />);
    expect(screen.getByRole("heading").textContent).toBe("Good morning, Kieser!");
    act(() => vi.advanceTimersByTime(30_100));
    expect(screen.getByRole("heading").textContent).toBe("Good afternoon, Kieser!");
    vi.setSystemTime(new Date(2026, 10, 12, 18, 0, 5));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByRole("heading").textContent).toBe("Good evening, Kieser!");
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

it("omits the name when none is available", () => {
  expect(timeGreeting("", new Date(2026, 10, 12, 9, 0))).toBe("Good morning!");
});
