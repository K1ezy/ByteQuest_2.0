import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...await orig<typeof import("@/lib/api")>(), apiRequest: api.request }));

import { ResearchConsentCard } from "./research-consent";
import ResearchPage from "@/app/(workspace)/account/research/page";

const status = (choice: string | null, available = true) =>
  ({ available, version: "dev-placeholder", text: "Development text: replace with the approved form.", choice });

function serving(state: ReturnType<typeof status>) {
  api.request.mockImplementation((path: string, init?: RequestInit) =>
    Promise.resolve(init?.method === "POST" ? { ok: true } : state));
}

beforeEach(() => api.request.mockReset());
afterEach(cleanup);

it("asks once with equally weighted answers and no reward", async () => {
  serving(status(null));
  render(<ResearchConsentCard />);
  const agree = await screen.findByRole("button", { name: "I agree" });
  const decline = screen.getByRole("button", { name: "No, thanks" });
  expect(agree.className).toBe(decline.className);
  expect(screen.getByRole("link", { name: "Read more" }).getAttribute("href")).toBe("/account/research");
  expect(screen.queryByText(/reward|bonus/i)).toBeNull();

  fireEvent.click(decline);
  await waitFor(() => expect(api.request).toHaveBeenCalledWith("/pilot/research/consent",
    { method: "POST", body: JSON.stringify({ choice: "declined", document_version: "dev-placeholder" }) }));
  expect(await screen.findByText(/Nothing changes for you/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "I agree" })).toBeNull();
});

it("never shows the card once answered or while the study is closed", async () => {
  serving(status("declined"));
  const answered = render(<ResearchConsentCard />);
  await waitFor(() => expect(api.request).toHaveBeenCalled());
  expect(answered.container.innerHTML).toBe("");
  cleanup();
  serving(status(null, false));
  const closed = render(<ResearchConsentCard />);
  await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2));
  expect(closed.container.innerHTML).toBe("");
});

it("explains research use and confirms before withdrawing", async () => {
  serving(status("accepted"));
  render(<ResearchPage />);
  expect(await screen.findByText("You agreed")).toBeTruthy();
  expect(screen.getByText(/Your code, your chats with the tutor/)).toBeTruthy();
  expect(screen.getByText(/Data already exported before you withdrew stays in that export/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "I agree to research use" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Withdraw from research" }));
  fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
  await waitFor(() => expect(api.request).toHaveBeenCalledWith("/pilot/research/consent",
    { method: "POST", body: JSON.stringify({ choice: "withdrawn", document_version: "dev-placeholder" }) }));
});

it("offers no withdrawal to a student who never agreed", async () => {
  serving(status(null));
  render(<ResearchPage />);
  expect(await screen.findByRole("button", { name: "I agree to research use" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Withdraw from research" })).toBeNull();
});
