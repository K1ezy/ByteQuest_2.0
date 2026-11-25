import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

test("gradebook columns stay readable and scroll inside the page", async ({ page }, info) => {
  const id = "f0000000-0000-4000-8000-000000000021";
  const course = { id: "f0000000-0000-4000-8000-000000000022", code: "PY", title: "Python Foundations" };
  const learner = "Alexandra Martínez " + "longunbrokenname".repeat(5);
  const title = "Understanding how to write and test reusable functions " + "longunbrokenidentifier".repeat(5);
  const activities = Array.from({ length: 18 }, (_, i) => ({
    activity_id: `activity-${i}`,
    title: i === 0 ? title : `Loops ${i}`,
    activity_type: "challenge",
    attempted: 1,
    passed: 1,
  }));

  await page.addInitScript(({ id, enlarged }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email: "layout-instructor@example.test" },
    }));
    if (enlarged) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id, enlarged: info.project.name === "large-text" });
  await page.route("**/api/v1/**", (route) => {
    switch (new URL(route.request().url()).pathname) {
      case "/api/v1/profile/me":
        return route.fulfill({ json: { id, role: "instructor", username: "layout-instructor" } });
      case "/api/v1/faculty/courses":
        return route.fulfill({ json: { courses: [course], default_course_id: course.id } });
      case "/api/v1/faculty/gradebook":
        return route.fulfill({ json: {
          course, activities, stuck_after_attempts: 3,
          students: [{
            student_id: "student", pseudonym: "learner", username: "alexandra", display_name: learner,
            passed_count: 1, stuck_count: 0,
            cells: { [activities[0].activity_id]: { attempts: 1, best_score: 100, passed: true, stuck: false } },
          }],
        } });
      default:
        return route.fulfill({ status: 404, json: { detail: "No fixture for this endpoint" } });
    }
  });
  await page.goto(`/instructor/performance?course=${course.id}#instructor-gradebook`);

  const gradebook = page.getByRole("region", { name: "Best score per activity" });
  const scores = gradebook.getByRole("region", { name: "Gradebook scores" });
  const heading = scores.getByRole("link", { name: `Analysis for ${title}`, exact: true });
  await expect(heading).toHaveAttribute("href", `/instructor/activities/${activities[0].activity_id}/analysis?course=${course.id}`);
  await expect(scores.getByRole("button", { name: new RegExp(learner) })).toBeVisible();
  await expect(gradebook.getByRole("button", { name: "Download CSV" })).toBeEnabled();
  await expectContentToFit(page, gradebook, [".ws-panel-head", ".ws-footnote"]);

  const narrowestActivityColumn = await scores.getByRole("columnheader").evaluateAll((columns) => {
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Math.min(...columns.slice(1, -1).map((column) => column.getBoundingClientRect().width / rootSize));
  });
  expect(narrowestActivityColumn).toBeGreaterThanOrEqual(9.99);

  const layout = await heading.evaluate((element) => {
    const title = document.createRange();
    title.selectNodeContents(element);
    const word = document.createRange();
    word.setStart(element.firstChild!, 0);
    word.setEnd(element.firstChild!, "Understanding".length);
    const cell = element.closest("th")!;
    return {
      titleLines: title.getClientRects().length,
      wordLines: word.getClientRects().length,
      overflow: cell.scrollWidth - cell.clientWidth,
    };
  });
  expect(layout.titleLines).toBeGreaterThan(1);
  expect(layout.wordLines).toBe(1);
  expect(layout.overflow).toBeLessThanOrEqual(1);

  const scrollArea = await scores.evaluate((element) => {
    const { left, right } = element.getBoundingClientRect();
    const panel = element.closest("section")!.getBoundingClientRect();
    return { contained: left >= panel.left && right <= panel.right, excess: element.scrollWidth - element.clientWidth };
  });
  expect(scrollArea.contained).toBe(true);
  expect(scrollArea.excess).toBeGreaterThan(0);
  await scores.focus();
  await expect(scores).toBeFocused();
  await scores.press("ArrowRight");
  await expect.poll(() => scores.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const total = scores.getByRole("cell", { name: "1 / 18", exact: true });
  await total.scrollIntoViewIfNeeded();
  await expect(total).toBeInViewport();
});
