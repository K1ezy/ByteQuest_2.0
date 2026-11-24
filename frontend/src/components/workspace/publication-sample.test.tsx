import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import ActivityPage from "@/app/(workspace)/instructor/activities/[id]/page";
import { ApiError } from "@/lib/api";
import type { ActivityDetail } from "@/lib/workspace";

const { apiRequest, setUnsaved, refreshCourses } = vi.hoisted(() => ({
  apiRequest: vi.fn(), setUnsaved: vi.fn(), refreshCourses: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "activity" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/api", async (original) => ({ ...await original<typeof import("@/lib/api")>(), apiRequest }));
vi.mock("@/components/workspace/workspace-provider", () => ({
  safeReturnTo: (_value: string | null, fallback: string) => fallback,
  useWorkspace: () => ({ courseId: "course", setUnsaved, refreshCourses }),
  WorkspaceSuspense: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  apiRequest.mockReset();
});

function draft(isHidden: boolean): ActivityDetail {
  const sample = { order_index: 0, stdin: "Python", expected_stdout: "Pyt\non" };
  const preview = {
    activity_id: "activity", activity_type: "challenge" as const,
    title: "Strings exercise", topic_concept: "Strings", state: "draft",
    problem_statement: "Print the first three and the last two letters.", difficulty_level: 2,
    xp_reward: 30, opens_at: null, closes_at: null,
  };
  return {
    ...preview,
    course_id: "course", course: { id: "course", code: "PY", title: "Python" },
    review_status: "draft", judge0_verified: true, reviewed_by: null,
    content_version: 1, version_number: 1, version_of: null, published_at: null,
    archived_at: null, created_at: null, source_document_id: null,
    generation: { model_version: null, prompt_version: null, generated_at: null, citation_count: 0 },
    citations: [], reference_solution_code: "word = input()\nprint(word[:3])\nprint(word[-2:])",
    student_preview: { ...preview, sample_cases: isHidden ? [] : [sample], hidden_case_count: isHidden ? 1 : 0 },
    test_cases: [{ ...sample, is_hidden: isHidden, time_limit_ms: 2000, memory_limit_kb: 256000, weight: 1 }],
  };
}

it.each([true, false])("guides the instructor through the visible sample check (hidden: %s)", async (isHidden) => {
  apiRequest.mockImplementation((path: string) => Promise.resolve(path.endsWith("/hints") ? { items: [] } : draft(isHidden)));
  render(<ActivityPage />);
  if (isHidden) {
    const fix = await screen.findByRole("link", { name: "Make a grading case visible" });
    expect(screen.queryByRole("button", { name: "Publish activity" })).toBeNull();
    fireEvent.click(fix);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Grading cases" }));
  } else {
    fireEvent.click(await screen.findByRole("button", { name: "Review student preview" }));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Publish activity" }).disabled).toBe(false);
  }
});

it("serializes autosaves and keeps text typed while the prior revision is saving", async () => {
  const initial = draft(false);
  let resolveFirst!: (value: unknown) => void;
  const firstResponse = new Promise((resolve) => { resolveFirst = resolve; });
  const requests: Record<string, unknown>[] = [];
  apiRequest.mockImplementation((path: string, options?: RequestInit) => {
    if (path.endsWith("/hints")) return Promise.resolve({ items: [] });
    if (options?.method !== "PATCH") return Promise.resolve(initial);
    const change = JSON.parse(String(options.body));
    requests.push(change);
    if (requests.length === 1) return firstResponse;
    return Promise.resolve({ activity: { ...initial, ...change, content_version: 3 } });
  });
  render(<ActivityPage />);
  const title = await screen.findByRole<HTMLInputElement>("textbox", { name: /^Title$/ });
  fireEvent.change(title, { target: { value: "Revision one" } });
  await waitFor(() => expect(requests).toHaveLength(1));
  fireEvent.change(title, { target: { value: "Revision two" } });
  resolveFirst({ activity: { ...initial, title: "Revision one", content_version: 2 } });
  await waitFor(() => expect(requests).toHaveLength(2), { timeout: 1800 });
  expect(requests).toEqual([
    { title: "Revision one", content_version: 1 },
    { title: "Revision two", content_version: 2 },
  ]);
  expect(title.value).toBe("Revision two");
  await screen.findByText("Saved · just now");
});

it("keeps edits and pauses autosave when another tab saved first", async () => {
  const initial = draft(false);
  const patch = vi.fn().mockRejectedValue(new ApiError("The saved version changed.", 409, "version_conflict"));
  apiRequest.mockImplementation((path: string, options?: RequestInit) => {
    if (path.endsWith("/hints")) return Promise.resolve({ items: [] });
    if (options?.method === "PATCH") return patch();
    return Promise.resolve(initial);
  });
  render(<ActivityPage />);
  const title = await screen.findByRole<HTMLInputElement>("textbox", { name: /^Title$/ });
  fireEvent.change(title, { target: { value: "Keep this edit" } });
  await screen.findByRole("button", { name: "Reload saved version" });
  expect(title.value).toBe("Keep this edit");
  expect(patch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Publish activity" })).toBeNull();
});
