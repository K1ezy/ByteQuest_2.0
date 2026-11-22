// Run with the disposable authenticated fixture produced by qa_mobile_exam.py.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const fixture = JSON.parse(readFileSync(0, "utf8"));
const { chromium } = await import(pathToFileURL(process.env.BQ_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({
  executablePath: process.env.BQ_EDGE_EXECUTABLE,
  headless: true,
});
const web = "http://127.0.0.1:3000";

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${web}/onboarding?mode=signin`);
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  const signin = page.getByRole("button", { name: "Sign in", exact: true });
  await signin.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Object.keys(sessionStorage).some(key => /^sb-.+-auth-token$/u.test(key)));

  await page.goto(`${web}/exams/${fixture.exam_id}`);
  const start = page.waitForResponse(response => response.request().method() === "POST"
    && response.url().endsWith(`/exams/${fixture.exam_id}/start`) && response.ok());
  await page.getByRole("button", { name: "Start exam", exact: true }).press("Enter");
  const { attempt_id: attemptId } = await (await start).json();
  const code = page.getByRole("textbox", { name: "Your code" });
  const savedStatus = page.getByRole("status").filter({ hasText: /Saved to your account/ });
  const unsavedStatus = page.getByRole("status").filter({ hasText: "Unsaved on this device" });
  const timer = page.getByRole("timer", { name: /Remaining exam time: \d+ minutes, \d+ seconds/ });
  await code.waitFor();
  await timer.waitFor();
  assert.equal(await savedStatus.getAttribute("aria-atomic"), "true");
  const client = await context.newCDPSession(page);
  const { nodes } = await client.send("Accessibility.getFullAXTree");
  assert.ok(nodes.some(node => node.role?.value === "timer" && /minutes, .* seconds/u.test(node.name?.value || "")));
  assert.ok(nodes.some(node => node.role?.value === "textbox" && node.name?.value === "Your code"));
  assert.ok(await page.getByRole("status").filter({ hasText: /(minutes|seconds) or less remaining/ }).count());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await code.focus();
  assert.ok(await code.evaluate(node => document.activeElement === node));
  await page.keyboard.press("Tab");
  assert.ok(await code.evaluate(node => document.activeElement !== node));
  console.log("PASS 390 px Edge exam: keyboard sign-in, accessible timer and code field, status regions, and reflow.");

  const acceptedSave = () => page.waitForResponse(response => response.request().method() === "PUT"
    && response.url().endsWith(`/exams/attempts/${attemptId}/answers`) && response.ok(), { timeout: 15000 });
  let accepted = acceptedSave();
  await page.getByRole("button", { name: "Next", exact: true }).press("Enter");
  for (const question of [1, 2, 3]) {
    await page.getByRole("group", { name: `QA question ${question}?` })
      .getByRole("radio", { name: "A. Right" }).press("Space");
  }
  await accepted;
  await page.getByRole("button", { name: "Previous", exact: true }).press("Enter");
  console.log("PASS keyboard task navigation and three saved quiz answers.");
  accepted = acceptedSave();
  await code.fill(fixture.initial);
  await accepted;
  await savedStatus.waitFor();
  await context.setOffline(true);
  await code.fill(fixture.final);
  await unsavedStatus.waitFor({ timeout: 10000 });
  assert.equal(await code.inputValue(), fixture.final);
  accepted = acceptedSave();
  await context.setOffline(false);
  await accepted;
  await savedStatus.waitFor();
  await page.reload();
  await code.waitFor();
  assert.equal(await code.inputValue(), fixture.final);
  console.log("PASS offline edit, truthful unsaved status, reconnect save, and restored answer after reload.");

  await page.getByText("Time ended; latest server-saved answers submitted", { exact: true }).first().waitFor({ timeout: 80000 });
  await page.getByRole("heading", { name: /Grading in progress|Exam submitted/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS deadline feedback and transition to grading on the mobile viewport.");
} finally {
  await browser.close();
}
