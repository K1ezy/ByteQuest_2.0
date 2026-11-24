import { expect, test, type Page } from "@playwright/test";
import type { ActivityDetail, ActivityListItem, FacultyDashboard, MaterialSummary } from "../src/lib/workspace";
import { expectContentToFit } from "./containment";

const instructorId = "f0000000-0000-4000-8000-000000000001";
const defaultCourse = { id: "f0000000-0000-4000-8000-000000000002", title: "Intro to Java", code: "JAVA" };
const course = { id: "f0000000-0000-4000-8000-000000000003", title: "Python Foundations", code: "PY" };
const documentId = "f0000000-0000-4000-8000-000000000004";
const draftId = "f0000000-0000-4000-8000-000000000005";
const manualId = "f0000000-0000-4000-8000-000000000006";
const scope = `course=${course.id}`;
const timestamp = "2026-11-25T08:00:00Z";
const identifier = "reusable_nested_function_".repeat(7);
const title = `Defining and calling functions in a program with input and output ${identifier}`;
const instructions = "Use the examples from the reading to choose the correct answer about defining a function.";

const material: MaterialSummary = {
  document_id: documentId, document_family_id: documentId, title, filename: "functions.pdf", course_id: course.id,
  topic_concept: "Functions", language: "python", version_number: 1, is_current: true, archived_at: null,
  processing_status: "completed", state: "ready", processing_error: null, total_chunks: 2, file_size_bytes: 1024,
  indexed_at: timestamp, created_at: timestamp, draft_count: 0, can_retry: false,
};
const processing: MaterialSummary = { ...material, processing_status: "processing", state: "processing", total_chunks: 0 };
const unreadable: MaterialSummary = {
  ...processing, state: "needs_review", processing_status: "needs_review",
  processing_error: "No searchable text. Choose a PDF with selectable text.",
};
const question = { id: "q1", prompt: "Which keyword defines a function?", options: [{ key: "A", text: "def" }, { key: "B", text: "return" }] };
const gradingCase = {
  order_index: 0, stdin: "4", expected_stdout: "8", time_limit_ms: 2000, memory_limit_kb: 256000, is_hidden: false, weight: 1,
};
const preview = {
  activity_id: draftId, activity_type: "quiz" as const, title, topic_concept: "Functions", problem_statement: instructions,
  difficulty_level: 2, xp_reward: 30, state: "draft", opens_at: null, closes_at: null, questions: [question],
};
const draft: ActivityDetail = {
  ...preview, language: "python", course_id: course.id, course,
  review_status: "draft", draft_state: "pending", judge0_verified: false, reviewed_by: null, content_version: 1,
  version_number: 1, version_of: null, published_at: null, archived_at: null, created_at: timestamp,
  source_document_id: documentId, material, citations: [], student_preview: preview,
  generation: { model_version: null, prompt_version: null, generated_at: timestamp, citation_count: 0 },
  quiz_questions: { questions: [{ ...question, correct_answer: "A" }] },
};
const dashboard: FacultyDashboard = {
  course, action_queue: [], upcoming: [], recent_changes: [],
  queue_hrefs: { drafts: "/instructor/activities", materials: "/instructor/materials", activities: "/instructor/activities", performance: "/instructor/performance" },
  counts: { drafts_awaiting_review: 0, materials_needing_attention: 0, upcoming_activities: 0, class_progress_percent: 0, active_learners: 0 },
  class_snapshot: { active_learners: 0, published_activities: 0, average_completion_percent: 0, average_score: null, need_follow_up: 0, active_7d: 0, attempts_7d: 0 },
};

function projectActivity(detail: ActivityDetail): ActivityDetail {
  const issues: string[] = [];
  if (detail.review_status === "draft") {
    if (detail.activity_type === "quiz" && (detail.quiz_questions?.questions.length ?? 0) < 3) issues.push("invalid_quiz");
    if (detail.activity_type === "challenge") {
      if (!detail.test_cases?.length) issues.push("missing_tests");
      if (!detail.exam_only && !detail.test_cases?.some((item) => !item.is_hidden)) issues.push("missing_sample");
      if (!detail.judge0_verified) issues.push("not_verified");
    }
  }
  return { ...detail, publication_issues: issues };
}

function listItem(detail: ActivityDetail): ActivityListItem {
  return {
    ...projectActivity(detail), state: detail.state as ActivityListItem["state"], generated: Boolean(detail.source_document_id),
    question_count: detail.quiz_questions?.questions.length ?? 0, test_case_count: detail.test_cases?.length ?? 0,
    grading_locked: false, attempt_count: 0,
  };
}

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(({ id, enlarge }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token", refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: "layout-instructor@example.test" },
    }));
    if (enlarge) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id: instructorId, enlarge: info.project.name === "large-text" });

  let source: MaterialSummary | null = null;
  let generationAttempts = 0;
  const activities = new Map<string, ActivityDetail>();
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const path = pathname.replace("/api/v1", "");
    if (path === "/profile/me") return route.fulfill({ json: {
      id: instructorId, role: "instructor", username: "layout-instructor", enrolled_language: "python",
    } });
    if (path === "/faculty/courses") return route.fulfill({ json: { courses: [defaultCourse, course], default_course_id: defaultCourse.id } });
    if (path === "/faculty/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/faculty/gamification-insights") return route.fulfill({ json: { topics: [] } });
    if (path === "/faculty/activities") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        expect(body.course_id).toBe(course.id);
        expect(body).not.toHaveProperty("quiz_questions");
        const manual: ActivityDetail = {
          ...draft, ...body, activity_id: manualId, source_document_id: null, material: null, quiz_questions: null,
          student_preview: { ...preview, activity_id: manualId, title: body.title, activity_type: body.activity_type, questions: [] },
        };
        activities.set(manualId, manual);
        return route.fulfill({ json: { activity: projectActivity(manual), message: "Draft saved" } });
      }
      const state = searchParams.get("status");
      const search = searchParams.get("search");
      const review = searchParams.get("review");
      const records = [...activities.values()];
      const items = searchParams.get("course_id") === course.id
        ? records.filter((item) => (!state || state === "all" || item.state === state)
          && (!review || review === "all" || (review === "published" ? item.review_status === "published" : item.state === "draft"))
          && (review !== "needs-review" || item.source_document_id)
          && (!search || item.title?.includes(search))).map(listItem) : [];
      return route.fulfill({ json: { items, total: items.length, counts: {}, filters: { materials: [{ document_id: documentId, title }] } } });
    }
    const activityMatch = /^\/faculty\/activities\/([^/]+)(?:\/(verify|publish|hints))?$/.exec(path);
    const draftPublishMatch = /^\/faculty\/drafts\/([^/]+)\/approve$/.exec(path);
    if (activityMatch || draftPublishMatch) {
      const id = (activityMatch || draftPublishMatch)![1];
      const action = draftPublishMatch ? "publish" : activityMatch?.[2];
      if (action === "hints") return route.fulfill({ json: { items: [] } });
      const detail = activities.get(id);
      if (!detail) return route.fulfill({ status: 404, json: { detail: "Unknown activity." } });
      if (action === "publish") {
        const generated = Boolean(detail.source_document_id);
        expect(detail.review_status).toBe("draft");
        expect(projectActivity(detail).publication_issues).toEqual([]);
        expect(request.postDataJSON()).toEqual({
          confirm: true, [generated ? "student_preview_confirmed" : "preview_confirmed"]: true, content_version: detail.content_version,
        });
        const updated = { ...detail, review_status: "published", state: detail.opens_at ? "scheduled" : "open", published_at: timestamp };
        activities.set(id, updated);
        return route.fulfill({ json: { activity: projectActivity(updated), review_status: "published", message: "Activity published." } });
      }
      if (action === "verify") {
        expect(detail.reference_solution_code).toContain("print");
        expect(detail.test_cases?.[0]).toMatchObject({ expected_stdout: "8", is_hidden: false });
        const updated = { ...detail, judge0_verified: true };
        activities.set(id, updated);
        return route.fulfill({ json: { activity: projectActivity(updated), message: "Verification passed." } });
      }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        expect(body.content_version).toBe(detail.content_version);
        const updated = {
          ...detail, ...body, content_version: detail.content_version + 1,
          judge0_verified: body.reference_solution_code || body.test_cases ? false : detail.judge0_verified,
        };
        activities.set(id, updated);
        return route.fulfill({ json: { activity: projectActivity(updated), message: "Activity saved." } });
      }
      return route.fulfill({ json: projectActivity(detail) });
    }
    if (path === "/faculty/materials") {
      expect(request.method() === "POST" ? request.postData() : searchParams.get("course_id")).toContain(course.id);
      if (request.method() === "POST") {
        source = request.postData()?.includes("scan.pdf") ? unreadable : processing;
        return route.fulfill({ status: 201, json: { material: source, message: "PDF saved." } });
      }
      const items = source ? [source] : [];
      return route.fulfill({ json: { course, items, total: items.length, counts: {}, filters: { statuses: [] }, max_upload_bytes: 2 ** 20 } });
    }
    if (path === `/instructor/documents/${documentId}/generate-quiz`) {
      expect(request.postData()).toContain('name="instructor_instructions"');
      expect(request.postData()).toContain("Focus on tracing nested functions.");
      if (++generationAttempts === 1) return route.fulfill({ status: 503, json: { detail: "Gemini is temporarily unavailable." } });
      activities.set(draftId, {
        ...draft, quiz_questions: { questions: [1, 2, 3].map((index) => ({ ...question, id: `q${index}`, correct_answer: "A" })) },
      });
      return route.fulfill({ json: { activity_id: draftId, activity_type: "quiz" } });
    }
    if (path === `/instructor/documents/${documentId}/generate-challenge`) {
      activities.set(draftId, {
        ...draft, activity_type: "challenge", judge0_verified: true, quiz_questions: null,
        citations: [{ id: "citation", chunk_id: "chunk", page_number: 12, document_id: documentId, document_title: title, version_number: 1, available: true, excerpt: instructions + " " + identifier }],
        reference_solution_code: "print(int(input()) * 2)", test_cases: [gradingCase],
        student_preview: { ...preview, activity_type: "challenge", questions: undefined, sample_cases: [gradingCase] },
      });
      return route.fulfill({ json: { activity_id: draftId, activity_type: "challenge" } });
    }
    return route.abort();
  });
  await page.route("**/layout/finish-indexing", (route) => {
    source = material;
    return route.fulfill({ status: 204 });
  });
});

for (const kind of ["quiz", "challenge"] as const) {
  test(`manual ${kind} lands in Activities, autosaves and returns to the same row after publish`, async ({ page }) => {
    if (kind === "quiz") {
      await page.goto(`/instructor?${scope}`);
      await page.getByRole("link", { name: "View activities", exact: true }).click();
      await page.getByRole("link", { name: "New Activity", exact: true }).press("Enter");
      const choices = page.locator(".ic-authoring-choices");
      await expectContentToFit(page, choices, ["h2", "p", "a"]);
      await choices.getByRole("link", { name: "Create manually" }).click();
    } else await page.goto(`/instructor/activities?create=1&${scope}`);

    const form = page.getByRole("region", { name: "Activity details" });
    await form.getByLabel("Type", { exact: true }).selectOption(kind);
    await form.getByLabel("Title", { exact: true }).fill(title);
    await form.getByLabel("Topic or concept").fill("Functions");
    await form.getByLabel("Student instructions").fill(instructions);
    if (kind === "challenge") await form.getByLabel("Reference solution (instructors only)").fill("print(int(input()) * 2)");
    await form.getByRole("button", { name: "Create activity", exact: true }).click();
    await openHighlighted(page, manualId);
    await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
    await expectContentToFit(page, page.locator(".ic-activity-editor-header"), ["h1", ".ic-activity-meta"]);
    await expect(page.locator(".ic-readiness")).toBeInViewport();
    const contentHeading = page.getByRole("heading", { name: kind === "quiz" ? "Quiz content" : "Coding content", exact: true });
    await expect(contentHeading).toBeVisible();
    await page.getByRole("link", { name: kind === "quiz" ? "Complete 3–10 questions" : "Add grading cases", exact: true }).click();
    await expect(contentHeading).toBeFocused();

    if (kind === "quiz") {
      for (const index of [1, 2, 3]) {
        await page.getByRole("button", { name: "Add question" }).click();
        const field = page.getByRole("group", { name: `Question ${index}`, exact: true });
        await field.getByLabel("Question text").fill(`Which option defines a function in example ${index}?`);
        await field.getByLabel("Option A").fill("def");
        await field.getByLabel("Option B").fill("return");
      }
      await expect(page.getByRole("button", { name: "Review student preview", exact: true })).toBeEnabled();
      const revised = `Practice for beginners ${identifier}`;
      await page.getByLabel("Title", { exact: true }).fill(revised);
      await page.getByRole("link", { name: "← Activities", exact: true }).click();
      await expect(page.locator(`#activity-${manualId}.is-highlighted`)).toContainText(revised);
      await openHighlighted(page, manualId);
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(revised);
    } else {
      await page.getByRole("button", { name: "Add case", exact: true }).click();
      await page.getByLabel("Input", { exact: true }).fill("4");
      await page.getByLabel("Expected output").fill("8");
      await page.getByLabel("Hidden from students").uncheck();
      await page.getByRole("button", { name: "Add case", exact: true }).click();
      await page.getByLabel("Input", { exact: true }).last().fill("512");
      await page.getByLabel("Expected output").last().fill("1024");
      await page.getByRole("button", { name: "Verify with Judge0", exact: true }).click();
      await expect(page.getByText("Verification passed.", { exact: true })).toBeVisible();
    }

    const opens = page.getByLabel("Opens at", { exact: true });
    if (kind === "challenge") {
      const schedule = page.waitForRequest((req) => req.method() === "PATCH" && req.postDataJSON().opens_at === "2026-12-01T02:00:00.000Z");
      await opens.fill("2026-12-01T10:00");
      await schedule;
    }
    await publishFromEditor(page, manualId);
    const row = page.locator(`#activity-${manualId}.is-highlighted`);
    await expect(row.getByText(kind === "challenge" ? "Scheduled" : "Open", { exact: true })).toBeVisible();
    await expect(row).toContainText(kind === "challenge" ? "Manila time" : "can open it now");
  });
}

test("Gemini PDF upload, recovery, editing and publication use Activities", async ({ page }) => {
  await page.goto(`/instructor/review?${scope}&q=missing`);
  await expect(page.getByText("No activities match these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("link", { name: "New Activity", exact: true }).click();
  await page.getByRole("link", { name: "Generate with Gemini", exact: true }).click();
  const generate = page.getByRole("button", { name: "Generate draft", exact: true });
  const prompt = page.getByLabel("Instructions for Gemini (optional)");
  const teacherText = `Focus on tracing nested functions. Include the note ${identifier}`;
  await prompt.fill(teacherText);
  await expect(generate).toBeDisabled();

  await page.getByRole("button", { name: "Upload PDF", exact: true }).click();
  await expect(page.getByLabel("PDF file")).toBeFocused();
  await page.getByLabel("PDF file").setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await page.getByRole("button", { name: "Upload and index" }).click();
  await expect(page.getByText("No searchable text. Choose a PDF with selectable text.")).toBeVisible();
  await expect(generate).toBeDisabled();

  await page.getByRole("button", { name: "Upload PDF", exact: true }).click();
  await page.getByLabel("PDF file").setInputFiles({ name: "functions.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await page.getByLabel("PDF title").fill(title);
  await page.getByRole("button", { name: "Upload and index" }).click();
  await expect(page.getByText("Indexing the PDF.", { exact: false })).toBeVisible();
  await page.evaluate(() => fetch("/layout/finish-indexing"));
  await expect(generate).toBeEnabled();
  await expectContentToFit(page, page.getByRole("region", { name: "Source PDF" }), ["label", "select", "strong"]);
  await generate.click();
  await expect(page.getByText("Gemini is temporarily unavailable.", { exact: true })).toBeVisible();
  await expect(prompt).toHaveValue(teacherText);
  await generate.click();
  await openHighlighted(page, draftId);
  await page.getByLabel("Student instructions", { exact: true }).fill(instructions + " Show your reasoning.");
  await expect(page.getByText("Saved · just now")).toBeVisible();
  await publishFromEditor(page, draftId);
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await expect(page.getByText("No activities match these filters.", { exact: true })).toBeVisible();
});

test("a PDF from Materials keeps citations and changes trigger verification", async ({ page }) => {
  await page.goto(`/instructor/materials?${scope}`);
  await page.evaluate(() => fetch("/layout/finish-indexing"));
  await page.reload();
  const row = page.locator(`#material-${documentId}`);
  await expectContentToFit(page, row, [".ws-row-heading", ".ws-row-actions", ".ws-action-grid .button"]);
  await row.getByRole("link", { name: "Use this PDF" }).click();
  await expect(page.getByLabel("Course PDF")).toHaveValue(documentId);
  await page.getByLabel("Type", { exact: true }).selectOption("challenge");
  await page.getByRole("button", { name: "Generate draft", exact: true }).click();
  await openHighlighted(page, draftId);
  await page.goto(`/instructor/review/${draftId}?${scope}`);
  await expect(page).toHaveURL(`/instructor/activities/${draftId}?${scope}`);
  await page.getByText("Source PDF · 1 cited excerpt", { exact: true }).click();
  const source = page.locator(".ic-activity-sources");
  await source.getByText(`Page 12 · ${title} · v1`, { exact: true }).click();
  await expectContentToFit(page, source, ["summary", "blockquote"]);
  await page.getByLabel("Reference solution (instructors only)").fill("number = int(input())\nprint(number * 2)");
  await expect(page.getByRole("link", { name: "Verify the reference solution", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Verify with Judge0", exact: true }).click();
  await publishFromEditor(page, draftId);
});

async function openHighlighted(page: Page, id: string) {
  await expect(page).toHaveURL(`/instructor/activities?highlight=${id}&${scope}`);
  const row = page.locator(`#activity-${id}.is-highlighted`);
  await expect(row).toBeFocused();
  await expectContentToFit(page, row, ["h3", ".ic-activity-meta", ".ic-row-actions"]);
  await row.getByRole("link", { name: /^Continue / }).click();
  await expect(page).toHaveURL(`/instructor/activities/${id}?${scope}`);
}

async function publishFromEditor(page: Page, id: string) {
  await page.getByRole("button", { name: "Review student preview", exact: true }).click();
  const student = page.getByRole("article", { name: "Student-visible preview" });
  await expectContentToFit(page, student, ["h3", "p"]);
  await expect(student.getByText("Correct answer", { exact: true })).toHaveCount(0);
  await expect(student.getByText("1024", { exact: true })).toHaveCount(0);
  const publish = page.getByRole("button", { name: "Publish activity", exact: true });
  await publish.click();
  const dialog = page.getByRole("dialog", { name: "Publish this activity?" });
  await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
  await expect(dialog).toContainText(course.title);
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(publish).toBeFocused();
  await publish.click();
  await dialog.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page).toHaveURL(`/instructor/activities?highlight=${id}&published=1&${scope}`);
}
