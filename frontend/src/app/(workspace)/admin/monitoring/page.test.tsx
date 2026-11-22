import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(), replace: vi.fn(), useApi: vi.fn(), retryJob: vi.fn(), reloadHistory: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }), usePathname: () => "/admin/monitoring", useSearchParams: () => mocks.params,
}));
vi.mock("@/components/workspace/workspace-provider", () => ({
  WorkspaceSuspense: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/workspace/ui", async orig => ({ ...await orig<typeof import("@/components/workspace/ui")>(), useApi: mocks.useApi }));
vi.mock("@/lib/workspace", async orig => ({ ...await orig<typeof import("@/lib/workspace")>(), retryJob: mocks.retryJob }));

import Page from "./page";

const job = (overrides: object) => ({
  id: "job-1", service: "rag_index", job_type: "pdf_extraction", status: "failed", attempts: 1, max_attempts: 3,
  retryable: true, cause: "The search index could not be created.", trace_id: "RAG-RETRY01", document_id: "doc-1",
  document_title: "Loops lesson", material_id: "doc-1", created_at: "2026-11-20T02:00:00Z", updated_at: null,
  last_checked_at: "2026-11-20T02:05:00Z", ...overrides,
});
const monitoring = {
  services: [], overall: "healthy", checked_at: "2026-11-22T03:00:00Z", audit: [],
  jobs: [job({}), job({ id: "job-2", retryable: false, trace_id: "RAG-BLOCK01", document_title: "Scanned notes", material_id: "doc-2" })],
  job_counts: { all: 2, failed: 2, retryable: 1, running: 0 }, filter_options: { services: [] },
};

beforeEach(() => {
  Object.values(mocks).forEach(mock => typeof mock === "function" && mock.mockReset());
  mocks.params = new URLSearchParams("status=failed");
  mocks.useApi.mockImplementation((path: string | null) => path?.startsWith("/admin/audit")
    ? { data: { items: [{ id: "a1", action: "material.retry_failed", summary: "Retry for “Loops lesson” failed", actor_role: "admin", created_at: "2026-11-21T02:00:00Z" }] }, reload: mocks.reloadHistory }
    : path ? { data: monitoring, reload: vi.fn(), loading: false } : { data: null, reload: vi.fn() });
});
afterEach(cleanup);

it("opens a job's detail from its row and keeps the list's filters in the URL", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Review and retry" }));
  expect(mocks.replace).toHaveBeenCalledWith("/admin/monitoring?status=failed&job=job-1", { scroll: false });
  expect(screen.getByRole("button", { name: "Details" })).toBeTruthy();
});

it("names the one job a retry affects, then shows the outcome and the material's audit history", async () => {
  mocks.params = new URLSearchParams("status=failed&job=job-1");
  mocks.retryJob.mockResolvedValue({ message: "Retry finished with a failure: still unreadable", job: job({ id: "job-3", attempts: 2 }) });
  render(<Page />);
  const drawer = screen.getByRole("dialog");
  expect(within(drawer).getByText(/Retrying reprocesses only/).textContent).toContain("Loops lesson");
  expect(within(drawer).getByText("Retry for “Loops lesson” failed")).toBeTruthy();
  expect(mocks.useApi).toHaveBeenCalledWith("/admin/audit?entity_id=doc-1");
  fireEvent.click(within(drawer).getByRole("button", { name: "Retry this job" }));
  await waitFor(() => expect(mocks.retryJob).toHaveBeenCalledWith("job-1"));
  expect(await within(drawer).findByText("Retry finished with a failure: still unreadable")).toBeTruthy();
  expect(mocks.reloadHistory).toHaveBeenCalled();
  expect(mocks.replace).toHaveBeenLastCalledWith("/admin/monitoring?status=failed&job=job-3", { scroll: false });
});

it("offers no retry for a failure the platform marks not retryable", () => {
  mocks.params = new URLSearchParams("job=job-2");
  render(<Page />);
  const drawer = screen.getByRole("dialog");
  expect(within(drawer).queryByRole("button", { name: "Retry this job" })).toBeNull();
  expect(within(drawer).getByText(/can't be retried/)).toBeTruthy();
});

it("copies a trace ID with one click", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Copy trace RAG-RETRY01" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("RAG-RETRY01"));
  expect(await screen.findByText("Copied")).toBeTruthy();
});
