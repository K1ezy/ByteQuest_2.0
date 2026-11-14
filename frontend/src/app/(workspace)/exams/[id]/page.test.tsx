import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "exam-1" }) }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});
vi.mock("@/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/supabase")>();
  return { ...original, resolveAuthenticatedUserId: vi.fn(async () => "student-1") };
});

import { ApiError } from "@/lib/api";
import ExamPage from "./page";

type Call = [string, RequestInit | undefined];

function answerSaves(): Call[] {
  return (mocks.apiRequest.mock.calls as Call[]).filter(
    ([path, init]) => path === "/exams/attempts/attempt-1/answers" && init?.method === "PUT",
  );
}

/** The final save must land before the page reloads the attempt it shows as submitted. */
async function expectSavedBeforeFinalLoad() {
  await screen.findByText(/Time ended; latest server-saved answers submitted/, undefined, { timeout: 4000 });
  const calls = mocks.apiRequest.mock.calls as Call[];
  const lastSave = calls.map(([path, init]) => path.endsWith("/answers") && init?.method === "PUT").lastIndexOf(true);
  const lastLoad = calls.map(([path, init]) => path === "/exams/attempts/attempt-1" && !init?.method).lastIndexOf(true);
  expect(lastSave).toBeGreaterThan(-1);
  expect(lastLoad).toBeGreaterThan(lastSave);
}

function serveExam(dueInMs: number, graceMs: number) {
  const dueAt = Date.now() + dueInMs;
  let saved: Record<string, unknown> = {};
  let revision = 0;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const serverNow = new Date().toISOString();
    if (path === "/exams/exam-1") {
      return {
        id: "exam-1", title: "Deadline exam", opens_at: serverNow, closes_at: serverNow,
        duration_minutes: 30, can_start: false, latest_attempt_id: "attempt-1",
        latest_status: "active", results_released: false, server_now: serverNow,
      };
    }
    if (path === "/exams/attempts/attempt-1/answers" && init?.method === "PUT") {
      saved = JSON.parse(String(init.body)).answers;
      revision += 1;
      return { revision, last_saved_at: serverNow, server_now: serverNow, status: "active" };
    }
    if (path === "/exams/attempts/attempt-1") {
      return {
        id: "attempt-1", exam_id: "exam-1", title: "Deadline exam",
        status: Date.now() >= dueAt ? "grading" : "active",
        due_at: new Date(dueAt).toISOString(),
        answers_accepted_until: new Date(dueAt + graceMs).toISOString(),
        revision, last_saved_at: null, server_now: serverNow, answers: saved,
        items: [{
          id: "item-1", position: 0, points: 10, kind: "quiz", title: "Loops",
          problem_statement: "Answer the question.",
          questions: [{ id: "q1", prompt: "Pick one", options: [
            { key: "A", text: "Correct" }, { key: "B", text: "Incorrect" },
          ] }],
        }],
        results_released: false, result: null, score: null,
      };
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
  });
}

afterEach(() => {
  cleanup();
  mocks.apiRequest.mockReset();
  sessionStorage.clear();
});

it("saves an answer typed just before time runs out instead of discarding it", async () => {
  // Due in 1.5 s: the 2.5 s autosave debounce can never fire first, so only a
  // deadline save can deliver this answer.
  serveExam(1500, 15_000);
  render(<ExamPage />);

  fireEvent.click(await screen.findByRole("radio", { name: /Correct/ }));

  await waitFor(() => expect(answerSaves()).toHaveLength(1), { timeout: 4000 });
  const body = JSON.parse(String(answerSaves()[0][1]?.body));
  expect(body.answers).toEqual({ "item-1": { q1: "A" } });
  await expectSavedBeforeFinalLoad();
});

it("keeps retrying the deadline save until the server's cutoff when the connection drops", async () => {
  serveExam(1500, 15_000);
  const serve = mocks.apiRequest.getMockImplementation()!;
  let dropped = false;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "PUT" && !dropped) {
      dropped = true;
      throw new ApiError("Network request failed", 0);
    }
    return serve(path, init);
  });
  render(<ExamPage />);

  fireEvent.click(await screen.findByRole("radio", { name: /Correct/ }));

  await waitFor(() => expect(answerSaves().length).toBeGreaterThanOrEqual(2), { timeout: 6000 });
  const lastBody = JSON.parse(String(answerSaves().at(-1)?.[1]?.body));
  expect(lastBody.answers).toEqual({ "item-1": { q1: "A" } });
  await expectSavedBeforeFinalLoad();
}, 10_000);
