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

function serveExam(dueInMs: number, graceMs: number, gradingStartsAtCutoff = false) {
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
        status: Date.now() >= dueAt + (gradingStartsAtCutoff ? graceMs : 0) ? "grading" : "active",
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

it("locks editing during the grace window and enters grading without a reload", async () => {
  serveExam(1500, 1500, true);
  render(<ExamPage />);

  const answer = await screen.findByRole<HTMLInputElement>("radio", { name: /Correct/ });
  await screen.findByText("Time ended; finalizing saved answers", undefined, { timeout: 3000 });
  expect(answer.disabled).toBe(true);
  await screen.findByRole("heading", { name: "Grading in progress" }, { timeout: 4500 });
  expect(screen.getByText("Time ended; latest server-saved answers submitted")).toBeTruthy();
}, 8000);

/** An exam with time to spare, starting from a given server revision and answers. */
function serveActiveExam(start: { revision: number; answers: Record<string, unknown> }) {
  let saved = start.answers;
  let revision = start.revision;
  const dueAt = Date.now() + 10 * 60_000;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const serverNow = new Date().toISOString();
    if (path === "/exams/exam-1") {
      return {
        id: "exam-1", title: "Calm exam", opens_at: serverNow, closes_at: serverNow, duration_minutes: 30,
        can_start: false, latest_attempt_id: "attempt-1", latest_status: "active", results_released: false,
        server_now: serverNow,
      };
    }
    if (path === "/exams/attempts/attempt-1/answers" && init?.method === "PUT") {
      saved = JSON.parse(String(init.body)).answers;
      revision += 1;
      return { revision, last_saved_at: serverNow, server_now: serverNow, status: "active" };
    }
    if (path === "/exams/attempts/attempt-1") {
      return {
        id: "attempt-1", exam_id: "exam-1", title: "Calm exam", status: "active",
        due_at: new Date(dueAt).toISOString(), revision, last_saved_at: serverNow, server_now: serverNow,
        answers: saved,
        items: [{
          id: "item-1", position: 0, points: 10, kind: "quiz", title: "Loops", problem_statement: "Answer.",
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

it("shows a released exam result when the learner returns to its open page", async () => {
  serveActiveExam({ revision: 1, answers: {} });
  const serve = mocks.apiRequest.getMockImplementation()!;
  let released = false;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const response = await serve(path, init);
    if (path !== "/exams/attempts/attempt-1") return response;
    return { ...response, status: "submitted", results_released: released,
      result: released ? { score: 9, max_score: 10, items: [] } : null };
  });

  const windowEvents = vi.spyOn(window, "addEventListener");
  try {
    render(<ExamPage />);
    await screen.findByText("Your instructor will release scores after the exam closes.");
    expect(screen.queryByText("Score: 9 / 10")).toBeNull();
    await waitFor(() => expect(windowEvents).toHaveBeenCalledWith("focus", expect.any(Function)));

    released = true;
    fireEvent.focus(window);
    await screen.findByText("Score: 9 / 10");
    expect(answerSaves()).toHaveLength(0);
  } finally {
    windowEvents.mockRestore();
  }
});

async function seedUnsyncedSnapshot(baseRevision: number, answers: Record<string, unknown>) {
  const { writeUnsyncedExamSnapshot } = await import("@/lib/supabase");
  writeUnsyncedExamSnapshot({
    userId: "student-1", attemptId: "attempt-1", baseRevision, editSeq: 3,
    updatedAtClientIso: new Date().toISOString(), answers: answers as Record<string, Record<string, string>>,
  });
}

function savedBodies() {
  return answerSaves().map(([, init]) => JSON.parse(String(init?.body)));
}

it("autosaves an answer after a short pause", async () => {
  serveActiveExam({ revision: 0, answers: {} });
  render(<ExamPage />);
  fireEvent.click(await screen.findByRole("radio", { name: /Correct/ }));
  await waitFor(() => expect(answerSaves()).toHaveLength(1), { timeout: 4000 });
  expect(savedBodies()[0]).toEqual({ expected_revision: 0, answers: { "item-1": { q1: "A" } } });
  await screen.findByText(/Saved to your account/);
});

it("restores this tab's unsaved answers after a reload and saves them", async () => {
  serveActiveExam({ revision: 0, answers: {} });
  await seedUnsyncedSnapshot(0, { "item-1": { q1: "B" } });
  render(<ExamPage />);
  await waitFor(() => expect(answerSaves()).toHaveLength(1));
  expect(savedBodies()[0]).toEqual({ expected_revision: 0, answers: { "item-1": { q1: "B" } } });
  expect((await screen.findByRole<HTMLInputElement>("radio", { name: /Incorrect/ })).checked).toBe(true);
});

it("asks which copy to keep when the account moved on, and can keep this device's answers", async () => {
  serveActiveExam({ revision: 2, answers: { "item-1": { q1: "A" } } });
  await seedUnsyncedSnapshot(0, { "item-1": { q1: "B" } });
  render(<ExamPage />);
  fireEvent.click(await screen.findByRole("button", { name: /Use this device’s unsaved answers/ }));
  await waitFor(() => expect(answerSaves()).toHaveLength(1));
  expect(savedBodies()[0]).toEqual({ expected_revision: 2, answers: { "item-1": { q1: "B" } } });
});

it("can keep the account's saved answers instead, without saving", async () => {
  serveActiveExam({ revision: 2, answers: { "item-1": { q1: "A" } } });
  await seedUnsyncedSnapshot(0, { "item-1": { q1: "B" } });
  render(<ExamPage />);
  fireEvent.click(await screen.findByRole("button", { name: /Keep account’s saved answers/ }));
  await waitFor(() => expect(screen.getByRole<HTMLInputElement>("radio", { name: /Correct/ }).checked).toBe(true));
  expect(answerSaves()).toHaveLength(0);
  expect(sessionStorage.length).toBe(0);
});

it("moves to conflict resolution when another tab saved first", async () => {
  serveActiveExam({ revision: 0, answers: {} });
  const serve = mocks.apiRequest.getMockImplementation()!;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "PUT") throw new ApiError("Answers changed in another tab.", 409);
    if (path === "/exams/attempts/attempt-1") {
      return { ...(await serve(path, init)), revision: 5, answers: { "item-1": { q1: "B" } } };
    }
    return serve(path, init);
  });
  render(<ExamPage />);
  fireEvent.click(await screen.findByRole("radio", { name: /Correct/ }));
  await screen.findByRole("button", { name: /Use this device’s unsaved answers/ }, { timeout: 4000 });
});

it("rejects an attempt returned for a different account during session hydration", async () => {
  serveActiveExam({ revision: 0, answers: {} });
  const serve = mocks.apiRequest.getMockImplementation()!;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const response = await serve(path, init);
    return path === "/exams/attempts/attempt-1" ? { ...response, student_id: "student-2" } : response;
  });
  render(<ExamPage />);
  await screen.findByRole("heading", { name: "Sign in to resume your exam attempt" });
  expect(screen.queryByRole("radio")).toBeNull();
  expect(answerSaves()).toHaveLength(0);
});

it("exposes a readable countdown and announces time milestones separately from saves", async () => {
  serveExam(90_000, 15_000);
  render(<ExamPage />);
  const timer = await screen.findByRole("timer", { name: /Remaining exam time: \d+ minutes, \d+ seconds/ });
  expect(timer.getAttribute("aria-live")).toBeNull();
  const timeNotice = await screen.findByText("Two minutes or less remaining.");
  expect(timeNotice.getAttribute("role")).toBe("status");
  const save = screen.getByText("Saved to your account", { exact: true });
  expect(save.getAttribute("role")).toBe("status");
  expect(save.getAttribute("aria-atomic")).toBe("true");
});

it("reviews unanswered tasks before the final submit and lets the learner go back", async () => {
  serveActiveExam({ revision: 0, answers: {} });
  render(<ExamPage />);
  await screen.findByRole("radio", { name: /Correct/ });
  fireEvent.click(screen.getAllByRole("button", { name: "Submit exam" })[0]);
  const dialog = await screen.findByRole("dialog", { name: "Submit exam?" });
  expect(dialog.textContent).toContain("1 of 1 task has no answer yet.");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  const writes = (mocks.apiRequest.mock.calls as Call[]).filter(([, init]) => init?.method && init.method !== "GET");
  expect(writes).toHaveLength(0);
});

it("offers a retake only when the exam info already knows the submitted attempt", async () => {
  const serve = (latestAttemptId: string | null) => mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const serverNow = new Date().toISOString();
    if (path === "/exams/exam-1") {
      return { id: "exam-1", title: "Retake exam", opens_at: serverNow, closes_at: serverNow, duration_minutes: 30,
        can_start: true, latest_attempt_id: latestAttemptId, latest_status: latestAttemptId ? "submitted" : null,
        results_released: false, server_now: serverNow };
    }
    if (path === "/exams/exam-1/start" && init?.method === "POST") return { attempt_id: "attempt-1" };
    if (path === "/exams/attempts/attempt-1") {
      return { id: "attempt-1", exam_id: "exam-1", title: "Retake exam", status: "submitted",
        due_at: serverNow, revision: 1, last_saved_at: serverNow, server_now: serverNow, answers: {},
        items: [], results_released: false, result: null, score: null };
    }
    throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
  });

  // Info loaded before the first attempt still says can_start; after it, no retake is on offer.
  serve(null);
  render(<ExamPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Start exam" }));
  await screen.findByText("Your instructor will release scores after the exam closes.");
  expect(screen.queryByRole("button", { name: "Start granted retake" })).toBeNull();
  cleanup();

  // A granted retake: the info names the submitted attempt and still allows a start.
  serve("attempt-1");
  render(<ExamPage />);
  expect(await screen.findByRole("button", { name: "Start granted retake" })).toBeTruthy();
});

it("does not claim time ran out when reopening an attempt the learner submitted", async () => {
  serveActiveExam({ revision: 1, answers: {} });
  const serve = mocks.apiRequest.getMockImplementation()!;
  mocks.apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const response = await serve(path, init);
    return path === "/exams/attempts/attempt-1" ? { ...response, status: "submitted" } : response;
  });
  render(<ExamPage />);
  await screen.findByRole("heading", { name: "Exam submitted" });
  expect(screen.queryByText(/Time ended/)).toBeNull();
});
