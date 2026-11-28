import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectContentToFit } from "./containment";

// Spec #15: sentence-first metric cards, takeaway titles and legends stay inside their containers
// at desktop, narrow and large-text sizes. Long names check that sentences wrap instead of overflowing.
const long = "longunbrokenidentifier".repeat(4);
const course = { id: "f0000000-0000-4000-8000-000000000032", code: "CS1", title: "Programming 1" };

async function signIn(page: Page, info: TestInfo, id: string, role: "student" | "instructor",
  fixtures: Record<string, unknown>) {
  await page.addInitScript(({ id, enlarged }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: "layout@example.test" },
    }));
    if (enlarged) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id, enlarged: info.project.name === "large-text" });
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (path === "/profile/me") return route.fulfill({ json: {
      id, role, username: "layout-" + role, pseudonym_id: "layout-" + role, workshop_languages: ["java", "python"],
      xp_points: 125, current_level: 2, year_level: 2, semester: 1,
    } });
    if (path === "/faculty/courses") return route.fulfill({ json: { courses: [course], default_course_id: course.id } });
    const fixture = Object.entries(fixtures).find(([prefix]) => path.startsWith(prefix));
    return fixture ? route.fulfill({ json: fixture[1] }) : route.fulfill({ status: 404, json: { detail: "No fixture" } });
  });
}

test("student progress cards, first-try chart and activity legend fit", async ({ page }, info) => {
  const firstTries = Array.from({ length: 8 }, (_, i) => ({
    activity_id: `a${i}`, title: i === 0 ? `Reverse a word ${long}` : `Activity ${i}`, language: i % 2 ? "java" : "python",
    created_at: `2026-11-${String(10 + i).padStart(2, "0")}T08:00:00Z`, score_percentage: [50, 100, 67, 100, 100, 67, 100, 100][i],
    passed: [false, true, false, true, true, true, true, true][i],
  }));
  await signIn(page, info, "f0000000-0000-4000-8000-000000000031", "student", {
    "/profile/me/analytics": { student: {
      total_attempts: 14, successful_attempts: 9, pass_rate: 64, average_score: 80, best_score: 100, total_time_seconds: 3600,
      xp_points: 125, current_level: 2, xp_per_level: 250, xp_into_level: 125, xp_to_next_level: 125, level_progress_percent: 50,
      quests_completed: 13, quests_total: 21, first_try_passes: 8, active_days_30: 6, current_streak: 2, longest_streak: 4,
      activity_days: Array.from({ length: 30 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, attempts: i % 5 })),
      next_action: null, badge_count: 0, by_type: [{ activity_type: "quiz", attempts: 4, average_score: 80, pass_rate: 75 }],
      by_topic: [{ language: "python", topic: `Loops ${long}`, attempts: 3, average_score: 90 },
        { language: "java", topic: "Loops", attempts: 2, average_score: 60 }],
      score_trend: [], first_tries: firstTries, recent_attempts: [], exam_history: [], badges: [], help_pattern: null,
    } },
  });
  await page.goto("/profile?tab=activity");
  const cards = page.locator(".metric-card");
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) await expectContentToFit(page, card, [".metric-card-sentence", ".metric-card-figure"]);
  // The (i) definition opens inside the card's flow, never past a narrow screen's edge.
  await cards.first().getByRole("button", { name: /What does .* mean\?/ }).click();
  await expectContentToFit(page, cards.first(), [".metric-info-text"]);
  await expectContentToFit(page, page.locator("section", { has: page.locator("#trend-title") }), ["h2", ".insight-legend"]);
  await expectContentToFit(page, page.locator("section", { has: page.locator(".profile-activity-legend") }), [".profile-activity-legend"]);
});

test("instructor performance cards, class trend and outlook legend fit", async ({ page }, info) => {
  const week = (date: string, challenge: number, n: number) =>
    ({ date, quiz: 70, challenge, exam: null, quiz_count: n, challenge_count: n, exam_count: 0 });
  const forecast = { id: "f1", target_activity_id: "t1", target_activity: `Count vowels ${long}`, target_topic: "loops",
    probability: 0.38, label: "May need support", model_version: "v1", captured_at: "2026-11-28T08:00:00Z" };
  await signIn(page, info, "f0000000-0000-4000-8000-000000000033", "instructor", {
    "/faculty/performance": {
      course, activities: [], students: [{ student_id: "s1", pseudonym: "learner", username: "ada", display_name: `Ada ${long}`,
        workshop_languages: ["python"], completed_count: 1, total_activities: 2, attempt_count: 3, latest_score: 60 }],
      summary: { active_learners: 21, published_activities: 8, average_score: 66, latest_activity_title: `Loops ${long}`,
        average_completion_percent: 62, need_follow_up: 4, last_week: { need_follow_up: 7, active_7d: 12 } },
    },
    "/faculty/ml": {
      course, period: "all", trend_scale: "weekly", aggregation_timezone: "UTC",
      readiness: { status: "ready", forecasts_available: true, active_model_version: "v1" },
      summary: { active_learners: 21, graded_events: 120, average_score: 66, forecast_count: 1, forecast_denominator: 1, need_support: 1 },
      trend: [week("2026-10-26", 50, 9), week("2026-11-02", 55, 8), week("2026-11-09", 90, 2),
        week("2026-11-16", 61, 7), week("2026-11-23", 66, 9), week("2026-11-30", 70, 8)],
      students: [{ student_id: "s1", forecast_status: "available", forecast }],
    },
  });
  await page.goto(`/instructor/performance?course=${course.id}`);
  const summary = page.locator(".instructor-summary");
  await expectContentToFit(page, summary, [".metric-card-sentence", ".metric-card-change"]);
  await expect(page.getByRole("heading", { name: /^First-try challenge scores are/ })).toBeVisible();
  await expectContentToFit(page, page.locator(".outlook-legend"), [".tag"]);
});

test("activity analysis and gamification cards fit", async ({ page }, info) => {
  await signIn(page, info, "f0000000-0000-4000-8000-000000000034", "instructor", {
    "/faculty/activities/act1/analysis": {
      activity_id: "act1", title: `Loop bounds ${long}`, activity_type: "challenge", course,
      class_size: 6, attempted: 4, passed: 2, pass_rate: 0.5, first_try_pass_rate: 0.25,
      median_attempts_to_pass: 2, stuck: 1, stuck_after_attempts: 3, not_started: 2,
      pass_mark_percent: 80, excludes_exam_attempts: true,
      score_distribution: [{ label: "80–100%", count: 2 }],
      error_categories: [{ category: "logic_error", label: "Wrong output", count: 4 }], hint_use: { learners: 1, passed: 0 },
    },
    "/faculty/gamification-insights": {
      course_id: course.id, course_code: course.code, course_title: course.title, generated_at: "2026-11-15T08:00:00Z",
      enrolled: 12, active: 9, weekly: [0, 1, 2, 3, 4, 5].map((w) => ({ week: w, eligible: 9, active: 5 + (w % 3), events: 20 })),
      rollout: { codex_unlock_day: 7, memory_unlock_day: 35 },
      solve_quality: { solved: 10, stars: { "1": 2, "2": 3, "3": 5 }, self_solved_rate: 0.8 },
      help_seeking: { hinted: 6, tried_before_hint: 4, rate: 0.667 }, topics: [],
      memory: { submitted: 0, passed: 0, pass_rate: null, stages: [] },
    },
  });
  await page.goto(`/instructor/activities/act1/analysis?course=${course.id}`);
  const analysis = page.getByRole("group", { name: "Activity statistics" });
  await expectContentToFit(page, analysis, [".metric-card-sentence"]);
  await page.goto(`/instructor/gamification?course=${course.id}`);
  const gamification = page.getByRole("group", { name: "Gamification statistics" });
  await expectContentToFit(page, gamification, [".metric-card-sentence"]);
  await expect(page.getByRole("heading", { name: /^Weekly active shares are/ })).toBeVisible();
});
