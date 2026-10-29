"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { safeReturnTo, useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { StudentPreviewCard } from "@/components/workspace/student-preview";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldError,
  LoadingPanel,
  Notice,
  PageHeading,
  StatusChip,
  useApi,
} from "@/components/workspace/ui";
import {
  activityStateLabel,
  createActivityVersion,
  friendlyLoadError, formatDateTime,
  fromDateTimeInput,
  publishActivity,
  scheduleActivity,
  toDateTimeInput,
  updateActivity,
  verifyActivity,
  type ActivityDetail,
  type StudentPreview,
  type TestCasePayload,
} from "@/lib/workspace";

type Question = {
  id: string;
  prompt: string;
  options: { key: string; text: string }[];
  correct_answer: string;
};

type EditorForm = {
  title: string;
  topic: string;
  problem: string;
  difficulty: number;
  xp: number;
  starter: string;
  reference: string;
  tests: TestCasePayload[];
  questions: Question[];
  contentVersion: number;
  opensAt: string;
  closesAt: string;
};

const STEPS = ["Details", "Content & tests", "Schedule", "Preview"] as const;

function formFrom(detail: ActivityDetail): EditorForm {
  return {
    title: detail.title || "",
    topic: detail.topic_concept || "",
    problem: detail.problem_statement || "",
    difficulty: detail.difficulty_level,
    xp: detail.xp_reward,
    starter: detail.starter_code || "",
    reference: detail.reference_solution_code || "",
    tests: (detail.test_cases || []).map((test) => ({ ...test })),
    questions: (detail.quiz_questions?.questions || []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({ ...option })),
      correct_answer: question.correct_answer,
    })),
    contentVersion: detail.content_version,
    opensAt: toDateTimeInput(detail.opens_at),
    closesAt: toDateTimeInput(detail.closes_at),
  };
}

function fieldErrorFrom(error: unknown): { field?: string; message: string } {
  if (error instanceof ApiError) {
    const payload = error.details as { detail?: { field?: string; message?: string } } | undefined;
    const detail = payload?.detail;
    if (detail && typeof detail === "object") return { field: detail.field, message: detail.message || error.message };
  }
  return { message: getErrorMessage(error) };
}

function localPreview(detail: ActivityDetail, form: EditorForm): StudentPreview {
  return {
    ...detail.student_preview,
    title: form.title,
    topic_concept: form.topic,
    problem_statement: form.problem,
    difficulty_level: form.difficulty,
    xp_reward: form.xp,
    starter_code: form.starter,
    sample_cases: form.tests.filter((test) => !test.is_hidden).map((test) => ({ order_index: test.order_index, stdin: test.stdin, expected_stdout: test.expected_stdout })),
    hidden_case_count: form.tests.filter((test) => test.is_hidden).length,
    questions:
      detail.activity_type === "quiz"
        ? form.questions.map((question) => ({ id: question.id, prompt: question.prompt, options: question.options }))
        : undefined,
  };
}

function ActivityEditor() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { courseId, setUnsaved, refreshCourses } = useWorkspace();
  const activityId = params.id;
  const returnTo = safeReturnTo(searchParams.get("returnTo"), `/faculty/activities${courseId ? `?course=${courseId}` : ""}`);

  const { data, error, loading, reload, setData } = useApi<ActivityDetail>(activityId ? `/faculty/activities/${activityId}` : null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [baseline, setBaseline] = useState<EditorForm | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "schedule" | "verify" | "publish" | "version" | "">("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishChecked, setPublishChecked] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [previewSeen, setPreviewSeen] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = formFrom(data);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(next);
    setBaseline(next);
    setStep(0);
    setPreviewSeen(data.review_status === "published");
  }, [data]);

  const dirty = Boolean(form && baseline) && JSON.stringify(form) !== JSON.stringify(baseline);

  useEffect(() => {
    setUnsaved(dirty, "You have unsaved activity changes. Leave and lose them?");
    return () => setUnsaved(false);
  }, [dirty, setUnsaved]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 3) setPreviewSeen(true);
  }, [step]);

  const locked = Boolean(data) && (data?.review_status === "published" || (data?.attempt_count || 0) > 0);
  const editable = Boolean(data) && data?.review_status === "draft";

  const completion = useMemo(() => {
    if (!form) return [false, false, false, false];
    const details = form.title.trim().length >= 3 && form.topic.trim().length >= 2 && form.problem.trim().length >= 20;
    const content =
      data?.activity_type === "quiz"
        ? form.questions.length >= 3 && form.questions.every((question) => question.prompt.trim() && question.options.every((option) => option.text.trim()))
        : form.reference.trim().length > 0 && form.tests.length > 0;
    const schedule = Boolean(form.opensAt || form.closesAt);
    return [details, content, schedule, previewSeen];
  }, [data?.activity_type, form, previewSeen]);

  function update(patch: Partial<EditorForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function validate(target: EditorForm): Record<string, string> {
    const found: Record<string, string> = {};
    if (target.title.trim().length < 3) found.title = "Enter a title of at least 3 characters.";
    if (target.topic.trim().length < 2) found.topic = "Enter the topic or concept.";
    if (target.problem.trim().length < 20) found.problem = "The student instructions need at least 20 characters.";
    if (data?.activity_type === "challenge") {
      if (!target.reference.trim()) found.reference = "Add the reference solution.";
      if (target.tests.length === 0) found.tests = "Add at least one grading case.";
      target.tests.forEach((test, index) => {
        if (!test.expected_stdout.trim()) found[`test-${index}-expected`] = "Expected output is required.";
        if (!(test.time_limit_ms >= 250 && test.time_limit_ms <= 15000)) found[`test-${index}-time`] = "Enter 250–15000 ms.";
        if (!(test.memory_limit_kb >= 32000 && test.memory_limit_kb <= 1048576)) found[`test-${index}-memory`] = "Enter 32000–1048576 KB.";
      });
    } else {
      if (target.questions.length === 0) found.questions = "Add at least one question.";
      target.questions.forEach((question, index) => {
        if (!question.prompt.trim()) found[`question-${index}-prompt`] = "Enter the question text.";
        if (question.options.some((option) => !option.text.trim())) found[`question-${index}-options`] = "Every option needs text.";
      });
    }
    if (target.opensAt && target.closesAt && new Date(target.closesAt) <= new Date(target.opensAt)) {
      found.closesAt = "The closing time must be after the opening time.";
    }
    return found;
  }

  function diffPayload(target: EditorForm): Record<string, unknown> {
    const payload: Record<string, unknown> = { content_version: target.contentVersion };
    if (!baseline) return payload;
    if (target.title !== baseline.title) payload.title = target.title.trim();
    if (target.topic !== baseline.topic) payload.topic_concept = target.topic.trim();
    if (target.problem !== baseline.problem) payload.problem_statement = target.problem.trim();
    if (target.difficulty !== baseline.difficulty) payload.difficulty_level = target.difficulty;
    if (target.xp !== baseline.xp) payload.xp_reward = target.xp;
    if (data?.activity_type === "challenge") {
      if (target.starter !== baseline.starter) payload.starter_code = target.starter;
      if (target.reference !== baseline.reference) payload.reference_solution_code = target.reference;
      if (JSON.stringify(target.tests) !== JSON.stringify(baseline.tests)) {
        payload.test_cases = target.tests.map((test, index) => ({ ...test, order_index: index }));
      }
    } else if (JSON.stringify(target.questions) !== JSON.stringify(baseline.questions)) {
      payload.quiz_questions = { questions: target.questions };
    }
    return payload;
  }

  async function save() {
    if (!data || !form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ tone: "error", text: "Fix the highlighted fields before saving. Your edits are still here." });
      window.requestAnimationFrame(() => {
        const first = Object.keys(found)[0];
        document.getElementById(first)?.focus();
      });
      return;
    }
    setBusy("save");
    setNotice(null);
    try {
      const result = await updateActivity(data.activity_id, diffPayload(form));
      setData(result.activity);
      setNotice({ tone: "success", text: result.message });
      await refreshCourses();
    } catch (caught) {
      const parsed = fieldErrorFrom(caught);
      if (parsed.field) setErrors({ [parsed.field]: parsed.message });
      setNotice({ tone: "error", text: `${parsed.message} Your edits were kept — save again to retry.` });
    } finally {
      setBusy("");
    }
  }

  async function saveSchedule() {
    if (!data || !form) return;
    const found = validate(form);
    if (found.closesAt) {
      setErrors({ closesAt: found.closesAt });
      return;
    }
    setBusy("schedule");
    setNotice(null);
    try {
      const result = await scheduleActivity(data.activity_id, fromDateTimeInput(form.opensAt), fromDateTimeInput(form.closesAt));
      setData(result.activity);
      setNotice({ tone: "success", text: result.message });
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your entered times are still here.` });
    } finally {
      setBusy("");
    }
  }

  async function runVerification() {
    if (!data) return;
    if (dirty) {
      setNotice({ tone: "warning", text: "Save your changes before verifying with Judge0." });
      return;
    }
    setBusy("verify");
    setNotice(null);
    try {
      const result = await verifyActivity(data.activity_id);
      setData(result.activity);
      setNotice({ tone: result.activity.judge0_verified ? "success" : "error", text: result.message });
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function createVersion() {
    if (!data) return;
    setBusy("version");
    setNotice(null);
    try {
      const result = await createActivityVersion(data.activity_id);
      await refreshCourses();
      router.push(
        `/faculty/activities/${result.activity.activity_id}?${new URLSearchParams({
          ...(courseId ? { course: courseId } : {}),
          returnTo,
        }).toString()}`,
      );
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  async function confirmPublish() {
    if (!data || !publishChecked) return;
    setBusy("publish");
    setPublishError("");
    try {
      const result = await publishActivity(data.activity_id);
      setPublishOpen(false);
      setPublishChecked(false);
      setData(result.activity);
      setNotice({ tone: "success", text: result.message });
      await refreshCourses();
    } catch (caught) {
      setPublishError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading the activity editor…" />;
  if (error && !data) {
    return (
      <section className="ws-panel" role="alert">
        <PageHeading eyebrow="ACTIVITY EDITOR" title="Activity unavailable" description={friendlyLoadError(error)} />
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={reload}>Retry</Button>
          <Link className="button button-outline" href={returnTo}>Back to activities</Link>
        </div>
      </section>
    );
  }
  if (!data || !form) {
    return <EmptyState title="Activity not found" action={<Link className="button button-outline" href={returnTo}>Back to activities</Link>} />;
  }

  const preview = localPreview(data, form);
  const quiz = data.activity_type === "quiz";

  return (
    <>
      <PageHeading
        eyebrow="ACTIVITY EDITOR"
        title={data.title || form.title || "Untitled activity"}
        description={
          <>
            {data.course?.title} · {quiz ? "Quiz / review lesson" : "Coding challenge"} · version {data.version_number} ·{" "}
            {activityStateLabel[data.state] || data.state}
            {data.attempt_count ? ` · ${data.attempt_count} attempt${data.attempt_count === 1 ? "" : "s"}` : ""}
          </>
        }
        status={
          <div className="ws-chip-row">
            <StatusChip state={data.state} label={activityStateLabel[data.state]} />
            {!quiz ? (
              <StatusChip
                state={data.judge0_verified ? "ready" : "pending"}
                label={data.judge0_verified ? "Judge0 passed" : "Needs verification"}
                tone={data.judge0_verified ? "good" : "wait"}
              />
            ) : null}
            {locked ? <StatusChip state="pending" label="Grading content locked" tone="wait" /> : null}
            {dirty ? <StatusChip state="pending" label="Unsaved changes" tone="wait" /> : null}
          </div>
        }
        actions={<Link className="button button-outline" href={returnTo}>← Back to activities</Link>}
      />

      {notice ? (
        <Notice tone={notice.tone === "success" ? "success" : notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "info"} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}

      {locked ? (
        <Notice tone="warning">
          {(data.attempt_count || 0) > 0
            ? "Students have attempted this activity, so its grading content is read-only. Create a new version to change instructions, tests or answer keys; the published version stays live until you publish the new one."
            : "Published content is read-only. Create a new version to change grading content."}{" "}
          <Button variant="outline" onClick={() => void createVersion()} disabled={busy !== ""}>
            {busy === "version" ? "Creating version…" : "Create new version"}
          </Button>
        </Notice>
      ) : null}

      <nav className="ws-steps" aria-label="Editor steps">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`ws-step${step === index ? " is-current" : ""}${completion[index] ? " is-complete" : ""}`}
            aria-current={step === index ? "step" : undefined}
            onClick={() => setStep(index)}
          >
            <span className="ws-step-index" aria-hidden="true">
              {completion[index] ? "✓" : index + 1}
            </span>
            <span>{label}</span>
            <span className="sr-only">{completion[index] ? "complete" : "incomplete"}</span>
          </button>
        ))}
      </nav>

      <section className="ws-panel" aria-labelledby="step-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">STEP {step + 1} OF {STEPS.length}</p>
            <h2 id="step-title">{STEPS[step]}</h2>
          </div>
          {step === 2 ? <span className="ws-muted">Times are shown in Asia/Manila.</span> : null}
        </div>

        {step === 0 ? (
          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} disabled={!editable || busy !== ""} onChange={(event) => update({ title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="topic">Topic or concept</label>
              <input id="topic" value={form.topic} disabled={!editable || busy !== ""} onChange={(event) => update({ topic: event.target.value })} aria-invalid={Boolean(errors.topic)} />
              <FieldError>{errors.topic}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="difficulty">Difficulty</label>
              <select id="difficulty" value={form.difficulty} disabled={!editable || busy !== ""} onChange={(event) => update({ difficulty: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>Level {value}</option>
                ))}
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor="xp">XP reward</label>
              <input id="xp" type="number" min={10} max={10000} value={form.xp} disabled={!editable || busy !== ""} onChange={(event) => update({ xp: Number(event.target.value) })} />
            </div>
            <div className="ws-field full">
              <label htmlFor="problem">Student instructions</label>
              <textarea id="problem" rows={7} value={form.problem} disabled={!editable || busy !== ""} onChange={(event) => update({ problem: event.target.value })} aria-invalid={Boolean(errors.problem)} />
              <FieldError>{errors.problem}</FieldError>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          quiz ? (
            <>
              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3>Questions and answer keys</h3>
                  <p className="ws-muted">Correct answers stay with faculty; students never receive them.</p>
                </div>
                {editable ? (
                  <Button
                    variant="quiet"
                    onClick={() =>
                      update({
                        questions: [
                          ...form.questions,
                          {
                            id: `q${form.questions.length + 1}-${Date.now().toString(36)}`,
                            prompt: "",
                            options: [{ key: "A", text: "" }, { key: "B", text: "" }],
                            correct_answer: "A",
                          },
                        ],
                      })
                    }
                  >
                    Add question
                  </Button>
                ) : null}
              </div>
              <FieldError>{errors.questions}</FieldError>
              {form.questions.length === 0 ? <p className="ws-muted">No questions yet. A quiz needs at least 3 questions to publish.</p> : null}
              <div className="ws-test-list">
                {form.questions.map((question, index) => (
                  <fieldset className="ws-test-case" key={question.id} disabled={!editable || busy !== ""}>
                    <legend>Question {index + 1}</legend>
                    <div className="ws-field">
                      <label htmlFor={`question-${index}-prompt`}>Question text</label>
                      <textarea id={`question-${index}-prompt`} rows={2} value={question.prompt} onChange={(event) => update({ questions: form.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, prompt: event.target.value } : item)) })} aria-invalid={Boolean(errors[`question-${index}-prompt`])} />
                      <FieldError>{errors[`question-${index}-prompt`]}</FieldError>
                    </div>
                    <div className="ws-option-grid">
                      {question.options.map((option, optionIndex) => (
                        <label className="ws-field" key={option.key}>
                          <span>Option {option.key}</span>
                          <input
                            value={option.text}
                            onChange={(event) =>
                              update({
                                questions: form.questions.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, options: item.options.map((choice, choiceIndex) => (choiceIndex === optionIndex ? { ...choice, text: event.target.value } : choice)) }
                                    : item,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="ws-field">
                      <label htmlFor={`question-${index}-correct`}>Correct answer</label>
                      <select
                        id={`question-${index}-correct`}
                        value={question.correct_answer}
                        onChange={(event) => update({ questions: form.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, correct_answer: event.target.value } : item)) })}
                      >
                        {question.options.map((option) => (
                          <option key={option.key} value={option.key}>{option.key}</option>
                        ))}
                      </select>
                    </div>
                    {editable && form.questions.length > 1 ? (
                      <Button variant="quiet" onClick={() => update({ questions: form.questions.filter((_, itemIndex) => itemIndex !== index) })}>
                        Remove question
                      </Button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ws-form-grid">
                <div className="ws-field">
                  <label htmlFor="starter">Starter code</label>
                  <textarea id="starter" className="ws-code-input" rows={8} value={form.starter} disabled={!editable || busy !== ""} onChange={(event) => update({ starter: event.target.value })} />
                </div>
                <div className="ws-field">
                  <label htmlFor="reference">Reference solution (faculty only)</label>
                  <textarea id="reference" className="ws-code-input" rows={8} value={form.reference} disabled={!editable || busy !== ""} onChange={(event) => update({ reference: event.target.value })} aria-invalid={Boolean(errors.reference)} />
                  <FieldError>{errors.reference}</FieldError>
                </div>
              </div>
              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3>Grading cases</h3>
                  <p className="ws-muted">Hidden inputs and expected outputs are withheld from students.</p>
                </div>
                <div className="ws-inline-actions">
                  {editable ? (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        update({
                          tests: [...form.tests, { order_index: form.tests.length, stdin: "", expected_stdout: "", time_limit_ms: 2000, memory_limit_kb: 256000, is_hidden: true, weight: 1 }],
                        })
                      }
                    >
                      Add case
                    </Button>
                  ) : null}
                  {!quiz ? (
                    <Button variant="outline" onClick={() => void runVerification()} disabled={busy !== "" || dirty}>
                      {busy === "verify" ? "Checking Judge0…" : data.judge0_verified ? "Re-verify with Judge0" : "Verify with Judge0"}
                    </Button>
                  ) : null}
                </div>
              </div>
              <FieldError>{errors.tests}</FieldError>
              {form.tests.length === 0 ? <p className="ws-muted">No grading cases yet. A coding challenge needs at least one case to publish.</p> : null}
              <div className="ws-test-list">
                {form.tests.map((test, index) => (
                  <fieldset className="ws-test-case" key={index} disabled={!editable || busy !== ""}>
                    <legend>Case {index + 1}</legend>
                    <div className="ws-form-grid">
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-stdin`}>Input</label>
                        <textarea id={`test-${index}-stdin`} rows={2} value={test.stdin} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, stdin: event.target.value } : item)) })} />
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-expected`}>Expected output</label>
                        <textarea id={`test-${index}-expected`} rows={2} value={test.expected_stdout} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, expected_stdout: event.target.value } : item)) })} aria-invalid={Boolean(errors[`test-${index}-expected`])} />
                        <FieldError>{errors[`test-${index}-expected`]}</FieldError>
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-time`}>Time limit (ms)</label>
                        <input id={`test-${index}-time`} type="number" min={250} max={15000} value={test.time_limit_ms} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, time_limit_ms: Number(event.target.value) } : item)) })} aria-invalid={Boolean(errors[`test-${index}-time`])} />
                        <FieldError>{errors[`test-${index}-time`]}</FieldError>
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-memory`}>Memory (KB)</label>
                        <input id={`test-${index}-memory`} type="number" min={32000} max={1048576} value={test.memory_limit_kb} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, memory_limit_kb: Number(event.target.value) } : item)) })} aria-invalid={Boolean(errors[`test-${index}-memory`])} />
                        <FieldError>{errors[`test-${index}-memory`]}</FieldError>
                      </div>
                      <label className="ws-check ws-field">
                        <input type="checkbox" checked={test.is_hidden} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, is_hidden: event.target.checked } : item)) })} />
                        <span>Hidden from students</span>
                      </label>
                    </div>
                    {editable && form.tests.length > 1 ? (
                      <Button variant="quiet" onClick={() => update({ tests: form.tests.filter((_, itemIndex) => itemIndex !== index) })}>Remove case</Button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
              {!data.judge0_verified ? (
                <p className="ws-muted">Publishing stays locked until the saved reference solution passes Judge0.</p>
              ) : null}
            </>
          )
        ) : null}

        {step === 2 ? (
          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="opens-at">Opens at</label>
              <input id="opens-at" type="datetime-local" value={form.opensAt} onChange={(event) => update({ opensAt: event.target.value })} disabled={busy !== ""} />
              <p className="ws-muted">Leave empty to open immediately when published.</p>
            </div>
            <div className="ws-field">
              <label htmlFor="closes-at">Closes at</label>
              <input id="closes-at" type="datetime-local" value={form.closesAt} onChange={(event) => update({ closesAt: event.target.value })} disabled={busy !== ""} aria-invalid={Boolean(errors.closesAt)} />
              <FieldError>{errors.closesAt}</FieldError>
            </div>
            <div className="ws-inline-actions full">
              <Button variant="outline" onClick={() => void saveSchedule()} disabled={busy !== ""}>
                {busy === "schedule" ? "Saving schedule…" : "Save schedule"}
              </Button>
              <span className="ws-muted">
                Students see {form.opensAt ? `an opening time of ${formatDateTime(fromDateTimeInput(form.opensAt))}` : "immediate access"}; existing attempts are unaffected by schedule changes.
              </span>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="ws-preview-layout">
            <div>
              <StudentPreviewCard
                preview={preview}
                schedule={{ opens_at: fromDateTimeInput(form.opensAt), closes_at: fromDateTimeInput(form.closesAt), state: data.state, timezone: "Asia/Manila" }}
              />
            </div>
            <aside className="ws-preview-side">
              <h3>Publication checks</h3>
              <ul className="ws-check-list">
                <li className={completion[0] ? "is-done" : ""}>Details complete</li>
                <li className={completion[1] ? "is-done" : ""}>{quiz ? "Questions and answer keys" : "Grading cases and reference solution"}</li>
                <li className={completion[2] ? "is-done" : ""}>Schedule {form.opensAt || form.closesAt ? "set" : "optional"}</li>
                <li className={!dirty ? "is-done" : ""}>All edits saved</li>
                {!quiz ? <li className={data.judge0_verified ? "is-done" : ""}>Judge0 verification</li> : null}
                <li className={(data.attempt_count || 0) === 0 ? "is-done" : ""}>No student attempts yet</li>
              </ul>
              <p className="ws-muted">
                Answer keys: {quiz ? form.questions.length : 0} · hidden grading cases: {form.tests.filter((test) => test.is_hidden).length} · never
                shown to students.
              </p>
              {(data.attempt_count || 0) > 0 ? (
                <Button variant="outline" onClick={() => void createVersion()} disabled={busy !== ""}>
                  {busy === "version" ? "Creating version…" : "Create new version"}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => { setPublishError(""); setPublishOpen(true); }} disabled={!editable || dirty || busy !== "" || !completion[0] || !completion[1] || (!quiz && !data.judge0_verified)}>
                  Publish activity
                </Button>
              )}
              {dirty ? <p className="ws-muted">Save your changes before publishing so students receive the reviewed version.</p> : null}
              {quiz && form.questions.length < 3 ? (
                <p className="ws-muted">A quiz needs between 3 and 10 complete questions to publish.</p>
              ) : null}
              {!quiz && !data.judge0_verified ? (
                <p className="ws-muted">Verify the reference solution with Judge0 before publishing.</p>
              ) : null}
            </aside>
          </div>
        ) : null}

        <div className="ws-step-footer">
          <Button variant="quiet" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
            ← Back
          </Button>
          <div className="ws-inline-actions">
            {step < 3 ? (
              <Button variant="outline" onClick={() => setStep((current) => Math.min(3, current + 1))}>
                Next step →
              </Button>
            ) : null}
            {editable && (step === 0 || step === 1) ? (
              <Button variant="primary" onClick={() => void save()} disabled={busy !== "" || !dirty}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </Button>
            ) : null}
            {step === 2 ? (
              <Button variant="primary" onClick={() => void saveSchedule()} disabled={busy !== ""}>
                {busy === "schedule" ? "Saving…" : "Save schedule"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <p className="ws-footnote">Preview shows exactly what students see; answer keys and hidden tests never appear there.</p>

      <ConfirmDialog
        open={publishOpen}
        title="Publish this activity"
        confirmLabel="Publish activity"
        busy={busy === "publish"}
        onCancel={() => { setPublishOpen(false); setPublishChecked(false); setPublishError(""); }}
        onConfirm={() => void confirmPublish()}
      >
        <p>
          <strong>{form.title}</strong> will become available to students in {data.course?.title}
          {form.opensAt ? ` from ${formatDateTime(fromDateTimeInput(form.opensAt))}` : " immediately"}
          {form.closesAt ? ` until ${formatDateTime(fromDateTimeInput(form.closesAt))}` : ""}. Existing attempts are not
          changed.
        </p>
        <StudentPreviewCard preview={preview} schedule={{ opens_at: fromDateTimeInput(form.opensAt), closes_at: fromDateTimeInput(form.closesAt), state: data.state, timezone: "Asia/Manila" }} compact />
        <label className="ws-check">
          <input type="checkbox" checked={publishChecked} onChange={(event) => setPublishChecked(event.target.checked)} />
          <span>I reviewed this student-visible preview and confirm publication.</span>
        </label>
        <FieldError>{publishError}</FieldError>
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="activity editor">
      <ActivityEditor />
    </WorkspaceSuspense>
  );
}
