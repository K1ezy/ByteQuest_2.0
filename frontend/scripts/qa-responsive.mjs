import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fixture = JSON.parse(readFileSync(0, "utf8"));
const { chromium } = await import(pathToFileURL(process.env.BQ_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.BQ_EDGE_EXECUTABLE, headless: true });
const web = "http://127.0.0.1:3000";
const output = process.env.BQ_RESPONSIVE_OUTPUT;
if (output) mkdirSync(output, { recursive: true });

const viewports = [
  ["narrow", 320, 640, 3],
  ["1080x2340", 360, 780, 3],
  ["1080x2400", 360, 800, 3],
  ["1080x2424", 360, 808, 3],
  ["1080x2640", 360, 880, 3],
  ["1080x2772", 360, 924, 3],
  ["wide-phone", 412, 915, 2.625],
  ["landscape", 800, 360, 3],
  ["desktop", 1440, 900, 1],
];
const failures = [];

async function measure(page, label, selector) {
  const layout = await page.evaluate((selector) => {
    const field = selector ? document.querySelector(selector) : null;
    const bounds = field?.getBoundingClientRect();
    const rootWidth = document.documentElement.clientWidth;
    const overflowElements = [...document.querySelectorAll("main *")].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.right > rootWidth + 1;
    }).slice(0, 5).map(node => node.getAttribute("class") || node.tagName);
    return { viewport: [rootWidth, innerHeight], dpr: devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth, overflowElements,
      field: bounds ? { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) } : null };
  }, selector);
  console.log(`${label} ${JSON.stringify(layout)}`);
  if (layout.scrollWidth > layout.viewport[0] + 1) failures.push(`${label} widens the document`);
  if (layout.field && (layout.field.x < 0 || layout.field.x + layout.field.width > layout.viewport[0] + 1)) {
    failures.push(`${label} clips its main control`);
  }
}

async function capture(page, name) {
  if (output) await page.screenshot({ path: join(output, `${name}.png`), animations: "disabled", scale: "css" });
}

async function open(page, path, ready) {
  await page.goto(web + path);
  await page.locator(ready).first().waitFor();
}

async function signIn(page, role) {
  await open(page, "/onboarding?mode=signin", "#auth-heading");
  const { email, password } = fixture.accounts[role];
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForFunction(() => Object.keys(sessionStorage).some(key => /^sb-.+-auth-token$/u.test(key)));
}

async function studentViewport([name, width, height, deviceScaleFactor]) {
  const mobile = name !== "desktop";
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage();
    page.on("pageerror", error => failures.push(`${name} page error: ${error.message}`));
    await signIn(page, "student");
    await open(page, "/dashboard", ".dashboard-hub h1");
    await measure(page, `${name} dashboard`, "#app-navigation");
    const tabs = page.locator("#app-navigation a");
    assert.equal(await tabs.count(), 5);
    if (mobile) assert.ok(await tabs.evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44)));
    if (mobile) {
      await page.locator('#app-navigation a[href="/quests"]').tap();
      await page.locator(".quest-map-toolbar").waitFor();
    } else {
      await open(page, "/quests", ".quest-map-toolbar");
    }
    await measure(page, `${name} quests`, ".quest-search input");
    if (["1080x2400", "landscape"].includes(name)) {
      await page.getByRole("button", { name: "Open Chat Assistant" }).tap();
      await page.locator(".chat-input").focus();
      if (name === "1080x2400") await page.setViewportSize({ width, height: 340 });
      await measure(page, `${name} chat compact`, ".chat-panel");
      const chatVisible = await page.locator(".chat-panel").evaluate(panel => {
        const bounds = panel.getBoundingClientRect();
        const composer = panel.querySelector(".chat-input").getBoundingClientRect();
        return bounds.top >= -1 && composer.top >= bounds.top && composer.bottom <= innerHeight + 1;
      });
      if (!chatVisible) failures.push(`${name} chat composer is outside the viewport`);
      await capture(page, `${name}-chat`);
      await page.keyboard.press("Escape");
      await page.locator(".chat-panel").waitFor({ state: "hidden" });
      if (name === "1080x2400") await page.setViewportSize({ width, height });
    }
    const editorSelector = mobile ? ".arena-touch-editor" : ".arena-editor .monaco-editor";
    await open(page, `/arena/${fixture.challenge_id}`, editorSelector);
    await measure(page, `${name} arena`, ".arena-editor");
    if (mobile) {
      await page.getByRole("link", { name: "Editor", exact: true }).tap();
      await page.waitForFunction(() => document.querySelector(".arena-editor").getBoundingClientRect().top < innerHeight / 2);
      const editor = page.locator(editorSelector);
      await editor.waitFor();
      if (name === "1080x2400") {
        const code = `${fixture.code}\n# ${"long_code_line_".repeat(12)}\n`;
        const savedDraft = page.waitForResponse(response => response.request().method() === "PUT"
          && response.url().endsWith(`/pilot/drafts/${fixture.challenge_id}`) && response.ok());
        let samplePosts = 0;
        page.on("request", request => {
          if (request.method() === "POST" && request.url().endsWith("/submission-jobs")) samplePosts++;
        });
        await page.route("**/submission-jobs/*", route => route.abort(), { times: 1 });
        await editor.fill(code);
        await measure(page, `${name} arena long code`, ".arena-touch-editor");
        await page.getByRole("button", { name: "Run sample", exact: true }).tap();
        await page.locator(".arena-results").getByText(/Checking this sample run again soon/).waitFor();
        await savedDraft;
        await page.reload();
        await editor.waitFor();
        await page.locator(".arena-verdict.good").getByText(/2 of 2 example cases passed/).waitFor();
        assert.equal(samplePosts, 1);
        console.log("PASS accepted sample run recovered after a lost status response and reload with one POST.");
        await page.waitForFunction((expected) => document.querySelector(".arena-touch-editor").value === expected, code);
        await page.getByRole("link", { name: "Editor", exact: true }).tap();
      }
    }
    if (["narrow", "1080x2400", "landscape", "desktop"].includes(name)) await capture(page, `${name}-arena`);
    await open(page, `/quiz/${fixture.quiz_id}`, ".pilot-question, fieldset");
    await measure(page, `${name} quiz`, "fieldset");
    await open(page, `/exams/${fixture.exam_id}`, ".pilot-dashboard h1");
    const start = page.getByRole("button", { name: "Start exam", exact: true });
    if (await start.isVisible()) await start.click();
    await page.getByRole("textbox", { name: "Your code" }).waitFor();
    await measure(page, `${name} exam`, ".pilot-code");
    if (name !== "landscape") {
      const inView = await page.locator(".pilot-code").evaluate(field => field.getBoundingClientRect().top + 32 < innerHeight);
      if (!inView) failures.push(`${name} exam editor starts below the first viewport`);
    }
    if (["narrow", "1080x2400", "landscape", "desktop"].includes(name)) await capture(page, `${name}-exam`);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("radio", { name: "A. Right" }).first().waitFor();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
  } finally {
    await context.close();
  }
}

try {
  const signInPage = await browser.newPage({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await open(signInPage, "/onboarding?mode=signin", "#auth-heading");
  await measure(signInPage, "narrow sign in", ".auth-form-card");
  await signInPage.close();
  for (const viewport of viewports) await studentViewport(viewport);
  for (const [role, routes] of [
    ["instructor", [["/instructor", "h1"], ["/instructor/exams", "h1"], ["/instructor/performance", "h1"]]],
    ["admin", [["/admin", "h1"], ["/admin/accounts", "h1"], ["/admin/courses", "h1"]]],
  ]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await signIn(page, role);
    for (const [path, ready] of routes) {
      await open(page, `${path}?course=${fixture.course_id}`, `#main-content ${ready}`);
      await measure(page, `1080x2400 ${path}`, "#app-navigation");
    }
    await page.close();
  }
  assert.deepEqual(failures, []);
  console.log("PASS localhost responsive viewport matrix.");
} finally {
  await browser.close();
}
