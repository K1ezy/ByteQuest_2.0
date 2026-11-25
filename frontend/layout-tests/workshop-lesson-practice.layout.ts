import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

const studentId = "f0000000-0000-4000-8000-000000000021";
const workshopId = "f0000000-0000-4000-8000-000000000022";
const lessonId = "f0000000-0000-4000-8000-000000000023";
const pendingId = "f0000000-0000-4000-8000-000000000024";
const base = `/workshops/${workshopId}/materials`;
const identifier = "loop_iteration_example_".repeat(5);
const title = `Tracing a loop that counts the even numbers in a list ${identifier}`;
const description = `Read the examples before you trace each iteration by hand and explain why the counter changes. ${identifier}`;

test("Workshop lesson download and both Chat Assistant practice flows fit", async ({ page }, info) => {
  await page.addInitScript(({ id, enlarged }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: "layout-student@example.test" },
    }));
    if (enlarged) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id: studentId, enlarged: info.project.name === "large-text" });

  const lesson = { document_id: lessonId, title, description, practice_status: "ready" };
  const calls: { kind: string; question: string }[] = [];
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case "/api/v1/profile/me":
        return route.fulfill({ json: { id: studentId, role: "student", username: "layout-student", enrolled_language: "python" } });
      case `/api/v1/workshops/${workshopId}`:
        return route.fulfill({ json: {
          id: workshopId, name: "Python Workshop", language: "python", owner_name: "Instructor",
          owned_by_me: false, is_owner: false, archived: false, activities: [],
        } });
      case `/api/v1${base}`:
        return route.fulfill({ json: [lesson, { document_id: pendingId, title: "Preparing lesson", description: null, practice_status: "indexing" }] });
      case `/api/v1${base}/${lessonId}`:
        return route.fulfill({ json: lesson });
      case `/api/v1${base}/${lessonId}/download`:
        return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4" });
      case "/api/v1/chat/status":
        return route.fulfill({ json: {
          role: "student", status: "enrollment_required", language: "python", history_enabled: true,
          limits: { max_messages: 12, max_message_chars: 4000, max_total_chars: 16000 },
        } });
      case "/api/v1/chat/messages": {
        const body = route.request().postDataJSON();
        expect(body.practice).toMatchObject({ workshop_id: workshopId, document_id: lessonId });
        const question = body.messages.at(-1).content;
        calls.push({ kind: body.practice.kind, question });
        if (body.messages.length > 1) {
          return route.fulfill({ json: { reply: "Correct. A loop repeats a block of statements.", sources: [] } });
        }
        const reply = body.practice.kind === "quiz"
          ? `1. Which statement changes the counter during an iteration of this loop?\nA. Add one\nB. Print the result\n${identifier}`
          : "Write a function that counts even numbers in a list.\n\nInput\n```text\n1 2 4\n```\nExpected output\n```text\n2\n```";
        return route.fulfill({ json: { reply, sources: [{ document_title: title, page_number: 2 }] } });
      }
      default:
        return route.fulfill({ json: {} });
    }
  });

  await page.goto(base);
  const materials = page.getByRole("region", { name: "Study materials" });
  await expect(materials.getByText("Preparing the lesson for Chat Assistant.")).toBeVisible();
  await expectContentToFit(page, materials, ["h3", ".workshop-lesson p", ".workshop-lesson-actions", ".workshop-lesson-actions .button"]);
  const pdfDownload = page.waitForEvent("download");
  await materials.getByRole("button", { name: "Download PDF" }).first().click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
  await materials.getByRole("link", { name: "Practice with Chat Assistant" }).click();

  await expectContentToFit(page, page.locator(".chat-practice-intro"), ["h2", "p", ".chat-suggestions button"]);
  await page.getByRole("button", { name: "Generate quiz" }).click();
  const quiz = page.locator(".chat-message-assistant").first();
  await expect(quiz).toContainText("Which statement changes the counter");
  await expect(quiz).toContainText("p. 2");
  await expectContentToFit(page, quiz, [".chat-bubble", ".chat-sources li"]);
  await page.getByRole("textbox", { name: "Your answers" }).fill("1. A");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Correct. A loop repeats a block of statements.")).toBeVisible();
  await expectContentToFit(page, page.locator(".chat-dock").filter({ has: page.getByLabel("Your answers") }), ["label", "textarea", "button"]);

  await page.getByRole("button", { name: "New practice" }).click();
  await page.getByRole("button", { name: "Generate coding challenge" }).click();
  await expect(page.getByText("Write a function that counts even numbers in a list.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy code" })).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "Your code or question" })).toBeVisible();
  expect(calls).toEqual([
    { kind: "quiz", question: "Generate a practice quiz from this lesson." },
    { kind: "quiz", question: "1. A" },
    { kind: "challenge", question: "Generate a coding challenge from this lesson." },
  ]);
  await page.getByRole("link", { name: /Workshop materials/ }).click();
  await expect(page.getByRole("heading", { name: "Study materials" })).toBeVisible();
});
