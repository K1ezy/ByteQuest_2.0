import { fromManilaDateTimeInput, toManilaDateTimeInput } from "@/lib/activity-date";
import type { ActivityDetail, TestCasePayload } from "@/lib/workspace";

type Question = NonNullable<ActivityDetail["quiz_questions"]>["questions"][number];

export type ActivityForm = {
  title: string;
  topic: string;
  problem: string;
  difficulty: number;
  xp: number;
  passMark: string;
  starter: string;
  reference: string;
  tests: TestCasePayload[];
  questions: Question[];
  opensAt: string;
  closesAt: string;
};

export function activityForm(detail: ActivityDetail): ActivityForm {
  return {
    title: detail.title || "",
    topic: detail.topic_concept || "",
    problem: detail.problem_statement || "",
    difficulty: detail.difficulty_level,
    xp: detail.xp_reward,
    passMark: detail.pass_mark_percent == null ? "" : String(detail.pass_mark_percent),
    starter: detail.starter_code || "",
    reference: detail.reference_solution_code || "",
    tests: detail.test_cases || [],
    questions: detail.quiz_questions?.questions || [],
    opensAt: toManilaDateTimeInput(detail.opens_at),
    closesAt: toManilaDateTimeInput(detail.closes_at),
  };
}

function integerBetween(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function pendingActivityUpdate(detail: ActivityDetail, saved: ActivityForm, form: ActivityForm) {
  const payload: Record<string, unknown> = { content_version: detail.content_version };
  const errors: Record<string, string> = {};
  const sent: Partial<ActivityForm> = {};

  function changed(key: keyof ActivityForm) {
    return JSON.stringify(saved[key]) !== JSON.stringify(form[key]);
  }

  function add<K extends keyof ActivityForm>(key: K, field: string, value: unknown, error?: string) {
    if (!changed(key)) return;
    if (error) errors[key] = error;
    else {
      payload[field] = value;
      sent[key] = form[key];
    }
  }

  if (detail.review_status === "draft" && detail.state !== "archived" && !detail.grading_locked) {
    add("title", "title", form.title.trim(), form.title.trim().length < 3 ? "Enter a title of at least 3 characters." : undefined);
    add("topic", "topic_concept", form.topic.trim(), form.topic.trim().length < 2 ? "Enter the topic or concept." : undefined);
    add("problem", "problem_statement", form.problem.trim(), form.problem.trim().length < 20 ? "Enter at least 20 characters." : undefined);
    add("difficulty", "difficulty_level", form.difficulty);
    add("xp", "xp_reward", form.xp, !integerBetween(form.xp, 10, 10000) ? "Enter an XP reward from 10 to 10,000." : undefined);

    if (detail.activity_type === "challenge") {
      const passMark = form.passMark.trim() ? Number(form.passMark) : null;
      add("passMark", "pass_mark_percent", passMark, passMark !== null && !integerBetween(passMark, 1, 100) ? "Enter 1–100%." : undefined);
      add("starter", "starter_code", form.starter);
      add("reference", "reference_solution_code", form.reference, !form.reference.trim() ? "Add the reference solution." : undefined);
      if (changed("tests")) {
        form.tests.forEach((test, index) => {
          if (!test.expected_stdout.trim()) errors[`test-${index}-expected`] = "Enter the expected output.";
          if (!integerBetween(test.time_limit_ms, 250, 15000)) errors[`test-${index}-time`] = "Enter 250–15000 ms.";
          if (!integerBetween(test.memory_limit_kb, 32000, 1048576)) errors[`test-${index}-memory`] = "Enter 32000–1048576 KB.";
          if (!Number.isFinite(test.weight) || test.weight < .01 || test.weight > 100) errors[`test-${index}-weight`] = "Enter a weight from 0.01 to 100.";
        });
        if (!Object.keys(errors).some((key) => key.startsWith("test-"))) {
          add("tests", "test_cases", form.tests.map((test, order_index) => ({ ...test, order_index })));
        }
      }
    } else if (changed("questions")) {
      form.questions.forEach((question, index) => {
        if (!question.prompt.trim()) errors[`question-${index}-prompt`] = "Enter the question text.";
        if (question.options.some((option) => !option.text.trim())) errors[`question-${index}-options`] = "Enter text for every answer option.";
      });
      if (!Object.keys(errors).some((key) => key.startsWith("question-"))) {
        add("questions", "quiz_questions", { questions: form.questions });
      }
    }
  }

  if (detail.state !== "archived" && (changed("opensAt") || changed("closesAt"))) {
    const opensAt = fromManilaDateTimeInput(form.opensAt);
    const closesAt = fromManilaDateTimeInput(form.closesAt);
    if (form.opensAt && !opensAt) errors.opensAt = "Enter a valid opening time.";
    if (form.closesAt && !closesAt) errors.closesAt = "Enter a valid closing time.";
    if (opensAt && closesAt && closesAt <= opensAt) errors.closesAt = "The closing time must be after the opening time.";
    if (!errors.opensAt && !errors.closesAt) {
      add("opensAt", "opens_at", opensAt);
      add("closesAt", "closes_at", closesAt);
    }
  }
  return { payload, sent, errors };
}

/** Keep anything typed while the server was saving a previous value. */
export function editsAfterSave(edits: Partial<ActivityForm>, sent: Partial<ActivityForm>) {
  return Object.fromEntries(Object.entries(edits).filter(([field, value]) =>
    !Object.hasOwn(sent, field) || sent[field as keyof ActivityForm] !== value)) as Partial<ActivityForm>;
}
