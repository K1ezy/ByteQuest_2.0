import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

const studentId = "f0000000-0000-4000-8000-000000000001";
const workshopId = "f0000000-0000-4000-8000-000000000002";
const quizId = "f0000000-0000-4000-8000-000000000003";
const workshopName = `An intermediate Python Workshop for students practising functions and loops ${"PracticeIdentifier".repeat(12)}`;
const quiz = {
  id: quizId, title: "Functions concept check", activity_type: "quiz", language: "python",
  topic_concept: "Functions", difficulty_level: 1, sequence_order: 1, xp_reward: 20,
  is_completed: false, can_open: true, added_at: "2026-11-25T10:00:00Z",
  quiz_questions: [{ id: "q1", prompt: "Which keyword defines a function?", options: [{ key: "a", text: "def" }, { key: "b", text: "class" }] }],
};
const challenge = {
  ...quiz, id: "challenge", title: "Write a function", activity_type: "challenge", sequence_order: 2,
  is_completed: true, completed_at: "2026-11-24T10:00:00Z",
};
const workshop = {
  id: workshopId, name: workshopName, language: "python", owner_name: "Layout instructor",
  is_owner: false, archived: false,
  activities: [quiz, challenge].map(({ id, added_at }, index) => ({ activity_id: id, added_at, topic: "Functions", position: index })),
};
const javaQuiz = { ...quiz, id: "java-quiz", title: "Java concept check", language: "java" };
const javaWorkshop = { ...workshop, id: "f0000000-0000-4000-8000-000000000004", name: "Java Workshop", language: "java",
  activities: [{ activity_id: javaQuiz.id, added_at: javaQuiz.added_at, topic: "Functions", position: 0 }] };

test("a learner can find a shared quest, open it from its Workshop and return", async ({ page }, info) => {
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
    if (path.endsWith("/profile/me")) return route.fulfill({ json: {
      id: studentId, role: "student", username: "layout-test", pseudonym_id: "layout-student",
      workshop_languages: ["java", "python"], xp_points: 0, current_level: 1,
    } });
    if (path.endsWith("/quests")) return route.fulfill({ json: [quiz, challenge, javaQuiz] });
    if (path.endsWith(`/workshops/${workshopId}/activities`)) return route.fulfill({ json: [quiz, challenge] });
    if (path.endsWith(`/workshops/${workshopId}`)) return route.fulfill({ json: workshop });
    if (path.endsWith("/workshops")) return route.fulfill({ json: [workshop, javaWorkshop] });
    return route.abort();
  });

  await page.goto("/quests");
  const quizCard = page.locator(`#quest-${quizId}`);
  const workshopLink = quizCard.getByRole("link", { name: workshopName });
  await expect(workshopLink).toBeVisible();
  await expect(page.getByRole("heading", { name: challenge.title })).toBeVisible();
  await expect(page.getByText("✓ Completed before sharing")).toBeVisible();
  // Every Workshop language is listed together, each card labelled with its language (ADR 0001).
  await expect(page.getByRole("heading", { name: javaQuiz.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "All track practice" })).toHaveCount(0);
  await expectContentToFit(page, quizCard, ["h2", ".quest-language", ".quest-workshop-sources", ".quest-workshop-sources a", ".quest-card-actions"]);
  const languages = page.getByRole("group", { name: "Language" });
  await expectContentToFit(page, languages, ["button"]);

  const questNavigation = "**/quests?*";
  await page.route(questNavigation, (route) => route.abort());
  const allButton = languages.getByRole("button", { name: "All languages" });
  const javaButton = languages.getByRole("button", { name: "Java" });
  await javaButton.click();
  await expect(javaButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: quiz.title })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: javaQuiz.title })).toBeVisible();
  await allButton.click();
  await expect(allButton).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(javaButton).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(allButton).toHaveAttribute("aria-pressed", "true");
  await page.unroute(questNavigation);

  await workshopLink.click();
  await expect(page).toHaveURL(`/workshops/${workshopId}/activities#quest-${quizId}`);
  await expect(quizCard).toBeFocused();
  await expect(page.getByText("✓ Completed before sharing")).toBeVisible();
  await quizCard.getByRole("link", { name: "Start quiz" }).click();
  await expect(page.getByText(quiz.quiz_questions[0].prompt)).toBeVisible();
  await page.getByRole("link", { name: "Back to Workshops" }).click();
  await expect(page.getByRole("heading", { name: quiz.title })).toBeVisible();
});
