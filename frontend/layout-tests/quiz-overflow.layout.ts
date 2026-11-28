import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

const quizId = "9ba1b933-4fac-43a8-82c3-1bcf7673c950";
const studentId = "f0000000-0000-4000-8000-000000000001";
const identifier = "nested_function_".repeat(22);
const prompt = "Which reserved word is used to define a function in Python according to the excerpt?";
const quest = {
  id: quizId, title: "Python Defining and Calling Functions Assessment",
  activity_type: "quiz", language: "python", topic_concept: "Defining and calling functions",
  difficulty_level: 2, position: 9, xp_reward: 25, is_completed: false,
  quiz_questions: [
    { id: "prompt", prompt, options: [{ key: "a", text: `An answer containing the identifier ${identifier}` }, { key: "b", text: "def" }] },
    { id: "identifier", prompt: `What does the identifier ${identifier} represent in this example?`,
      options: [{ key: "a", text: "A function" }, { key: "b", text: "A module" }] },
  ],
};

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(({ id, enlarge }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: "layout@example.test" },
    }));
    if (enlarge) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id: studentId, enlarge: info.project.name === "large-text" });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/profile/me")) {
      return route.fulfill({ json: {
        id: studentId, role: "student", username: "layout-test", pseudonym_id: "layout-student",
        workshop_languages: ["python"], xp_points: 0, current_level: 1,
      } });
    }
    if (path.endsWith("/quests")) return route.fulfill({ json: [quest] });
    return route.abort();
  });
  await page.goto(`/quiz/${quizId}`);
});

test("prompts, options and navigation stay inside the question card", async ({ page }) => {
  const card = page.locator(".quiz-step-card");
  await expect(card.locator("#question-prompt")).toHaveText(prompt);
  const targets = [".quiz-step-header", "#question-prompt", ".quiz-option-radio-label", ".quiz-option-radio-label span", ".quiz-nav-actions button"];
  await expectContentToFit(page, card, targets);
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(card.locator("#question-prompt")).toContainText(identifier);
  await expectContentToFit(page, card, targets);
});

test("long prompts, selected answers and submit controls stay inside review", async ({ page }) => {
  await page.getByRole("radio", { name: /An answer containing/ }).check();
  await page.getByRole("button", { name: /Review all/ }).click();
  const card = page.getByRole("region", { name: "Review before submitting" });
  await expect(card.locator(".answer-preview").first()).toContainText(identifier);
  await expectContentToFit(page, card, [
    ".quiz-step-header", ".notice", ".quiz-review-item", ".prompt-preview", ".answer-preview", "button",
  ]);
  await expect(card.getByRole("button", { name: "Submit quiz for grading" })).toBeDisabled();
  await card.getByRole("button", { name: "Jump to question 2" }).click();
  await expect(page.getByRole("radiogroup")).toContainText("A function");
});
