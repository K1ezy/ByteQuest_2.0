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

test("Workshop lessons stay downloadable and old practice links open regular chat", async ({ page }, info) => {
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
      default:
        return route.fulfill({ json: {} });
    }
  });

  await page.goto(base);
  const materials = page.getByRole("region", { name: "Study materials" });
  await expect(materials.getByRole("heading", { name: title })).toBeVisible();
  await expect(materials.getByRole("link", { name: "Practice with Chat Assistant" })).toHaveCount(0);
  await expectContentToFit(page, materials, ["h3", ".workshop-lesson p", ".workshop-lesson-actions", ".workshop-lesson-actions .button"]);
  const pdfDownload = page.waitForEvent("download");
  await materials.getByRole("button", { name: "Download PDF" }).first().click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
  await page.goto(`/chat?workshop=${workshopId}&lesson=${lessonId}`);
  await expect(page.getByRole("heading", { name: "Chat Assistant", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate quiz", exact: true })).toHaveCount(0);
});
