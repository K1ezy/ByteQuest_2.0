import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import QuizView from "./quiz-view";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: api, getErrorMessage: String }));
vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ role: "student", workshop_languages: ["python"] }),
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  api.mockReset();
});

it.each([false, true])("a failed quiz keeps the previous completion state (%s)", async (completed) => {
  api.mockImplementation(async (path: string) => {
    if (path === "/quests?details_for=quiz") return [{
      id: "quiz", title: "Python basics", language: "python", activity_type: "quiz", is_completed: completed,
      quiz_questions: [{ id: "q1", prompt: "What is 2 + 2?", options: [{ key: "A", text: "3" }, { key: "B", text: "4" }] }],
    }];
    if (path === "/quests/submit-quiz") return {
      score_percentage: 0, is_successful: false, xp_awarded: 0, correct_answers: 0, total_questions: 1,
    };
    throw new Error(`Unexpected request to ${path}`);
  });
  render(<QuizView activityId="quiz" />);
  fireEvent.click(await screen.findByRole("radio", { name: /A.*3/ }));
  fireEvent.click(screen.getByRole("button", { name: /review all/i }));
  const review = screen.getByRole("region", { name: /review before submitting/i });
  fireEvent.click(within(review).getByRole("button", { name: /submit/i }));
  await screen.findByText("NEEDS PRACTICE");
  expect(Boolean(screen.queryByText("✓ Completed"))).toBe(completed);
});
