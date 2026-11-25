import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

const studentId = "f0000000-0000-4000-8000-000000000025";
const workshopId = "f0000000-0000-4000-8000-000000000026";
const filename = `Tracing a counter through loops ${"long_unbroken_lesson_name_".repeat(6)}.pdf`;
const pdf = { filename, excerpts: [
  { page_number: 4, text: "Start the counter at zero before the loop." },
  { page_number: 27, text: "Split an email address at @ to get its domain." },
] };

test("student PDF attached in the floating chat stays available on the full page", async ({ page }, info) => {
  await page.addInitScript(({ id, enlarged }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: "layout-student@example.test" },
    }));
    if (enlarged) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id: studentId, enlarged: info.project.name === "large-text" });

  const sent: string[] = [];
  let uploads = 0;
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    switch (new URL(request.url()).pathname) {
      case "/api/v1/profile/me":
        return route.fulfill({ json: { id: studentId, role: "student", username: "layout-student", enrolled_language: "python" } });
      case `/api/v1/workshops/${workshopId}`:
        return route.fulfill({ json: {
          id: workshopId, name: "Python Workshop", language: "python", owner_name: "Instructor",
          owned_by_me: false, is_owner: false, archived: false, activities: [],
        } });
      case `/api/v1/workshops/${workshopId}/materials`:
        return route.fulfill({ json: [] });
      case "/api/v1/chat/status":
        return route.fulfill({ json: {
          role: "student", status: "enrollment_required", language: "python", history_enabled: true,
          pdf_upload_max_bytes: 10 * 1024 ** 2,
          limits: { max_messages: 12, max_message_chars: 4000, max_total_chars: 16000 },
        } });
      case "/api/v1/chat/attachments/pdf":
        uploads += 1;
        expect(request.headers()["content-type"]).toContain("multipart/form-data");
        return route.fulfill({ json: pdf });
      case "/api/v1/chat/messages": {
        const body = request.postDataJSON();
        const question = body.messages.at(-1).content;
        sent.push(question);
        if (question.includes("page 27")) {
          expect(body.attachment).toEqual({ filename, excerpts: [pdf.excerpts[1]] });
          return route.fulfill({ json: {
            reply: "Split the address at the at-sign to find the domain.",
            sources: [], consulted_sources: [{ document_title: filename, page_number: 27 }],
          } });
        }
        expect(body.attachment).toEqual(pdf);
        return route.fulfill({ json: {
          reply: "A counter starts at zero before you enter the loop.",
          sources: [{ document_title: filename, page_number: 4 }],
        } });
      }
      case "/api/v1/chat/conversations":
        expect(request.method()).toBe("GET");
        return route.fulfill({ json: { items: [], next_offset: null } });
      default:
        return route.fulfill({ json: {} });
    }
  });

  await page.goto(`/workshops/${workshopId}/materials`);
  await page.getByRole("button", { name: "Open Chat Assistant" }).click();
  const file = { name: filename, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") };
  const floating = page.getByRole("dialog", { name: "Chat Assistant" });
  await expect(floating.getByRole("button", { name: "Upload PDF" })).toBeVisible();
  await floating.locator('input[type="file"]').setInputFiles(file);
  await expect(floating.locator(".chat-pdf-name")).toContainText(filename);
  await expectContentToFit(page, floating.locator(".chat-pdf-row"), [".chat-pdf-name", "button"]);
  await floating.getByRole("button", { name: "Summarize PDF" }).click();
  await floating.getByRole("button", { name: "Send" }).click();
  await expect(floating.getByText("A counter starts at zero before you enter the loop.")).toBeVisible();
  await floating.getByRole("button", { name: "Open full page" }).click();

  await expect(page).toHaveURL(/\/chat$/);
  const chat = page.locator(".chat-conversation-page");
  await expect(chat.getByText("Temporary PDF chat")).toBeVisible();
  await expect(chat.getByText("A counter starts at zero before you enter the loop.")).toBeVisible();
  await expectContentToFit(page, chat.locator(".chat-pdf-row"), [".chat-pdf-name", "button"]);
  await chat.getByRole("textbox", { name: "Your question" }).fill("Briefly explain page 27.");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.locator(".chat-message-assistant")).toHaveCount(2);
  await expect(chat.getByText("Pages consulted")).toBeVisible();
  await expect(chat.locator(".chat-sources").last()).toContainText("p. 27");
  await expectContentToFit(page, chat.locator(".chat-sources").last(), ["summary", "li"]);
  expect(sent).toEqual(["Summarize the key ideas in this PDF.", "Briefly explain page 27."]);
  expect(uploads).toBe(1);

  await page.reload();
  await expect(chat.getByRole("button", { name: "Upload PDF" })).toBeVisible();
  await expect(chat.locator(".chat-message")).toHaveCount(0);
  await chat.locator('input[type="file"]').setInputFiles(file);
  await expect(chat.getByRole("button", { name: "Generate quiz" })).toBeVisible();
  expect(uploads).toBe(2);
});
