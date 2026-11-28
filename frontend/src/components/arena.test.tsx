import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api";
import Arena from "./arena";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@monaco-editor/react", () => ({ loader: { config: vi.fn() } }));
vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ id: "student", role: "student", workshop_languages: ["python"] }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  apiRequest: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

it("resumes the original sample run after a lost connection and a reload", async () => {
  let submitted = 0;
  let reconnected = false;
  vi.mocked(apiRequest).mockImplementation(async (path, init) => {
    if (path === "/quests?details_for=challenge") return [{
      id: "challenge", title: "Count readings", activity_type: "challenge", difficulty: 1,
      starter_code: "print(0)", problem_statement: "Count the positive readings.",
    }];
    if (path === "/pilot/drafts/challenge") return null;
    if (path === "/pilot/activities/challenge/hints") return { remaining: 5, reviewed: [], ai_hints: [] };
    if (path === "/submission-jobs" && init?.method === "POST") {
      submitted++;
      return { id: "sample", status: "queued", result: null };
    }
    if (path === "/submission-jobs/sample") {
      if (!reconnected) throw new ApiError("Connection dropped.", 0, "network_error");
      return { id: "sample", activity_id: "challenge", dry_run_only: true, status: "completed", result: {
        mode: "dry_run", evaluation: { is_successful: true, test_results: [] },
      } };
    }
    throw new Error(`Unexpected request ${path}`);
  });

  const arena = render(<Arena activityId="challenge" />);
  const run = await screen.findByRole("button", { name: "Run sample" });
  await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(run);
  const results = within(screen.getByRole("region", { name: "Results" }));
  await results.findByText("Sample run queued");
  await results.findByText("Connection interrupted. Checking this sample run again soon.", {}, { timeout: 4000 });
  arena.unmount();

  reconnected = true;
  render(<Arena activityId="challenge" />);
  await screen.findByText("Practice run, no attempt recorded.", {}, { timeout: 4000 });
  expect(submitted).toBe(1);
});

it("reuses a hint request after a dropped response and keeps the recovered hint if refresh fails", async () => {
  const keys: string[] = [];
  const hint = "Trace the counter on the zero from the sample.";
  vi.mocked(apiRequest).mockImplementation(async (path, init) => {
    if (path === "/quests?details_for=challenge") return [{
      id: "challenge", title: "Count readings", activity_type: "challenge", difficulty: 1,
      starter_code: "print(0)", problem_statement: "Count the positive readings.",
    }];
    if (path === "/pilot/drafts/challenge") return null;
    if (path === "/submission-jobs") return {
      id: "sample", status: "completed", result: {
        mode: "dry_run", evaluation: { is_successful: false, test_results: [] },
      },
    };
    if (path === "/pilot/activities/challenge/hints/reveal") {
      keys.push(JSON.parse(String(init?.body)).request_key);
      if (keys.length === 1) throw new ApiError("Connection dropped.", 0, "network_error");
      return { body: hint, remaining: 4 };
    }
    if (path === "/pilot/activities/challenge/hints") {
      if (keys.length === 2) throw new ApiError("Could not refresh saved hints.", 0, "network_error");
      return { remaining: 5, reviewed: [], ai_hints: [] };
    }
    throw new Error(`Unexpected request ${path}`);
  });

  render(<Arena activityId="challenge" />);
  const run = await screen.findByRole("button", { name: "Run sample" });
  await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Get an AI hint" }));
  await screen.findByText("Connection dropped.");
  fireEvent.click(screen.getByRole("button", { name: "Get an AI hint" }));

  await screen.findByText(hint);
  await screen.findByText("Could not refresh saved hints.");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
});

it("shows the saved visible grading cases instead of examples typed into the statement", async () => {
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === "/quests?details_for=challenge") return [{
      id: "challenge", title: "Double it", activity_type: "challenge", difficulty: 1, starter_code: "",
      problem_statement: "Print twice the number.\nExample input: 9\nExample output: 99",
      sample_cases: [{ stdin: "4", expected_stdout: "8" }, { stdin: "", expected_stdout: "0" }],
    }];
    if (path === "/pilot/drafts/challenge") return null;
    if (path === "/pilot/activities/challenge/hints") return { remaining: 5, reviewed: [], ai_hints: [] };
    throw new Error(`Unexpected request ${path}`);
  });

  render(<Arena activityId="challenge" />);
  const examples = within(await screen.findByRole("region", { name: "Examples" }));
  expect(examples.getByText("8")).toBeTruthy();
  expect(examples.getByText("(no input)")).toBeTruthy();
  expect(screen.queryByText("99")).toBeNull();
});
