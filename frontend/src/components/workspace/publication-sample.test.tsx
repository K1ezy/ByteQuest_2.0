import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import ActivityPage from "@/app/(workspace)/instructor/activities/[id]/page";
import ReviewPage from "@/app/(workspace)/instructor/review/[id]/page";
import type { ActivityDetail } from "@/lib/workspace";

const { apiRequest, setUnsaved, refreshCourses } = vi.hoisted(() => ({
  apiRequest: vi.fn(), setUnsaved: vi.fn(), refreshCourses: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "activity" }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

it.each([true, false])("checks the visible sample in the activity editor (hidden: %s)", async (isHidden) => {
  apiRequest.mockResolvedValue(draft(isHidden));
  render(<ActivityPage />);
  fireEvent.click(await screen.findByRole("button", { name: /^Preview/ }));
  const publish = screen.getByRole<HTMLButtonElement>("button", { name: "Publish activity" });
  expect(publish.disabled).toBe(isHidden);
  if (isHidden) {
    fireEvent.click(screen.getByRole("button", { name: "Go to grading cases" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Grading cases" }));
  }
});

it.each([true, false])("checks the visible sample in the draft review (hidden: %s)", async (isHidden) => {
  apiRequest.mockResolvedValue(draft(isHidden));
  render(<ReviewPage />);
  const publish = await screen.findByRole<HTMLButtonElement>("button", { name: "Approve and publish" });
  expect(publish.disabled).toBe(isHidden);
  if (isHidden) {
    expect(screen.getByRole("link", { name: "Go to grading cases" }).getAttribute("href"))
      .toBe(`#${screen.getByRole("heading", { name: "Grading cases" }).id}`);
  }
});
