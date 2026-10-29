"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  approveDraft,
  friendlyLoadError, formatDateTime,
  rejectDraft,
  saveDraft,
  type ActivityDetail,
  type TestCasePayload,
} from "@/lib/workspace";

type Question = {
  id: string;
  prompt: string;
  options: { key: string; text: string }[];
  correct_answer: string;
};

type DraftForm = {
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
};

function formFrom(detail: ActivityDetail): DraftForm {
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
  };
}

function normalize(form: DraftForm): string {
  return JSON.stringify({
    title: form.title,
    topic: form.topic,
    problem: form.problem,
    difficulty: form.difficulty,
    xp: form.xp,
    starter: form.starter,
    reference: form.reference,
    tests: form.tests,
    questions: form.questions,
  });
}

function fieldErrorFrom(error: unknown): { field?: string; message: string; code?: string } {
  if (error instanceof ApiError) {
    const payload = error.details as { detail?: { field?: string; message?: string; code?: string } } | undefined;
    const detail = payload?.detail;
    if (detail && typeof detail === "object") {
      return { field: detail.field, message: detail.message || error.message, code: detail.code };
    }
    return { message: error.message, code: error.code };
  }
  return { message: getErrorMessage(error) };
}

function DraftWorkspace() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { courseId, refreshCourses, setUnsaved } = useWorkspace();
  const activityId = params.id;
  const returnTo = safeReturnTo(searchParams.get("returnTo"), `/faculty/review${courseId ? `?course=${courseId}` : ""}`);

  const { data, error, loading, reload, setData } = useApi<ActivityDetail>(
    activityId ? `/faculty/drafts/${activityId}` : null,
  );
  const [form, setForm] = useState<DraftForm | null>(null);
  const [baseline, setBaseline] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "reject" | "approve" | "">("");
  const [activeCitation, setActiveCitation] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveChecked, setApproveChecked] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = formFrom(data);
    // Synchronize the editor with the server's saved revision.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(next);
    setBaseline(normalize(next));
    setActiveCitation(0);
    setPublished(data.review_status === "published");
  }, [data]);

  const dirty = Boolean(form) && normalize(form as DraftForm) !== baseline;

  useEffect(() => {
    setUnsaved(dirty, "You have unsaved draft edits. Leave and lose them?");
    return () => setUnsaved(false);
  }, [dirty, setUnsaved]);

  const citations = useMemo(() => data?.citations || [], [data]);
  const currentCitation = citations[activeCitation] || null;
  const editable = Boolean(data) && data?.review_status === "draft" && !published;

  const pages = useMemo(() => {
    const unique = new Set<number>();
    citations.forEach((citation) => {
      if (citation.page_number) unique.add(citation.page_number);
    });
    return Array.from(unique).sort((a, b) => a - b);
  }, [citations]);

  function update(patch: Partial<DraftForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function updateQuestion(index: number, patch: Partial<Question>) {
    setForm((current) =>
      current
        ? { ...current, questions: current.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }
        : current,
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, text: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((item, itemIndex) =>
              itemIndex === questionIndex
                ? { ...item, options: item.options.map((option, index) => (index === optionIndex ? { ...option, text } : option)) }
                : item,
            ),
          }
        : current,
    );
  }

  function updateTest(index: number, patch: Partial<TestCasePayload>) {
    setForm((current) =>
      current
        ? { ...current, tests: current.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }
        : current,
    );
  }

  function validate(target: DraftForm): Record<string, string> {
    const found: Record<string, string> = {};
    if (target.title.trim().length < 3) found.title = "Enter a title of at least 3 characters.";
    if (target.topic.trim().length < 2) found.topic = "Enter the topic or concept.";
    if (target.problem.trim().length < 20) found.problem = "The student instructions need at least 20 characters.";
    if (!Number.isFinite(target.difficulty) || target.difficulty < 1 || target.difficulty > 5) {
      found.difficulty = "Choose a difficulty from 1 to 5.";
    }
    if (!Number.isFinite(target.xp) || target.xp < 10 || target.xp > 10000) {
      found.xp = "XP must be between 10 and 10000.";
    }
    if (data?.activity_type === "challenge") {
      if (!target.reference.trim()) found.reference = "Add the reference solution so grading can be validated.";
      if (target.tests.length === 0) found.tests = "Add at least one grading case.";
      target.tests.forEach((test, index) => {
        if (!test.expected_stdout.trim()) found[`test-${index}-expected`] = "Expected output is required.";
        if (!Number.isFinite(test.time_limit_ms) || test.time_limit_ms < 250 || test.time_limit_ms > 15000) {
          found[`test-${index}-time`] = "Time limit must be between 250 and 15000 ms.";
        }
        if (!Number.isFinite(test.memory_limit_kb) || test.memory_limit_kb < 32000 || test.memory_limit_kb > 1048576) {
          found[`test-${index}-memory`] = "Memory must be between 32000 and 1048576 KB.";
        }
      });
    } else {
      if (target.questions.length === 0) found.questions = "Add at least one question.";
      target.questions.forEach((question, index) => {
        if (!question.prompt.trim()) found[`question-${index}-prompt`] = "Enter the question text.";
        if (question.options.length < 2) found[`question-${index}-options`] = "Add at least two answer options.";
        if (question.options.some((option) => !option.text.trim())) {
          found[`question-${index}-options`] = "Every answer option needs text.";
        }
        if (!question.options.some((option) => option.key === question.correct_answer)) {
          found[`question-${index}-correct`] = "Choose a correct answer that matches an option key.";
        }
      });
    }
    return found;
  }

  function focusFirstError(found: Record<string, string>) {
    const firstKey = Object.keys(found)[0];
    if (!firstKey) return;
    window.requestAnimationFrame(() => {
      const element = document.getElementById(firstKey);
      element?.focus();
    });
  }

  function payloadFor(target: DraftForm) {
    const base = {
      content_version: target.contentVersion,
      title: target.title.trim(),
      topic_concept: target.topic.trim(),
      problem_statement: target.problem.trim(),
      difficulty_level: target.difficulty,
      xp_reward: target.xp,
    };
    if (data?.activity_type === "challenge") {
      return {
        ...base,
        starter_code: target.starter,
        reference_solution_code: target.reference,
        test_cases: target.tests.map((test, index) => ({ ...test, order_index: index })),
      };
    }
    return {
      ...base,
      quiz_questions: { questions: target.questions },
    };
  }

  async function saveRevision() {
    if (!data || !form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      setNotice({ tone: "error", text: "Fix the highlighted fields before saving. Your edits are still here." });
      return;
    }
    setBusy("save");
    setNotice(null);
    try {
      const result = await saveDraft(data.activity_id, payloadFor(form));
      setData(result.draft);
      setNotice({ tone: "success", text: result.message });
      await refreshCourses();
    } catch (caught) {
      const parsed = fieldErrorFrom(caught);
      if (parsed.field) {
        setErrors({ [parsed.field]: parsed.message });
        focusFirstError({ [parsed.field]: parsed.message });
      }
      setNotice({
        tone: "error",
        text: `${parsed.message} Your edits were not lost — save again to retry.`,
      });
    } finally {
      setBusy("");
    }
  }

  async function confirmReject() {
    if (!data) return;
    if (rejectReason.trim().length < 5) {
      setRejectError("Explain what needs correction (at least 5 characters).");
      return;
    }
    setBusy("reject");
    setRejectError("");
    try {
      const result = await rejectDraft(data.activity_id, rejectReason.trim());
      setRejectOpen(false);
      setRejectReason("");
      setNotice({ tone: "success", text: result.message });
      reload();
      await refreshCourses();
    } catch (caught) {
      setRejectError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function confirmApprove() {
    if (!data) return;
    if (!approveChecked) return;
    setBusy("approve");
    setApproveError("");
    try {
      const result = await approveDraft(data.activity_id);
      setApproveOpen(false);
      setApproveChecked(false);
      setPublished(true);
      setNotice({ tone: "success", text: `${result.message} The review queue is updated.` });
      reload();
      await refreshCourses();
    } catch (caught) {
      setApproveError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading the draft and its cited sources…" />;
  if (error && !data) {
    return (
      <section className="ws-panel" role="alert">
        <PageHeading eyebrow="DRAFT WORKSPACE" title="Draft unavailable" description={friendlyLoadError(error)} />
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={reload}>
            Retry
          </Button>
          <Link className="button button-outline" href={returnTo}>
            Back to review queue
          </Link>
        </div>
      </section>
    );
  }
  if (!data || !form) {
    return (
      <EmptyState title="Draft not found" action={<Link className="button button-outline" href={returnTo}>Back to review queue</Link>}>
        The draft may have moved or your course access changed.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="DRAFT WORKSPACE"
        title={data.title || "Untitled draft"}
        description={
          <>
            {data.course?.title} · {data.activity_type === "quiz" ? "Quiz" : "Coding challenge"} · version{" "}
            {data.version_number} · saved {formatDateTime(data.updated_at || data.created_at)}
          </>
        }
        status={
          <div className="ws-chip-row">
            <StatusChip state={data.draft_state || "pending"} />
            {data.activity_type === "challenge" ? (
              <StatusChip
                state={data.judge0_verified ? "ready" : "pending"}
                label={data.judge0_verified ? "Judge0 passed" : "Needs verification"}
                tone={data.judge0_verified ? "good" : "wait"}
              />
            ) : null}
            {dirty ? <StatusChip state="pending" label="Unsaved changes" tone="wait" /> : null}
          </div>
        }
        actions={
          <Link className="button button-outline" href={returnTo}>
            ← Back to review queue
          </Link>
        }
      />

      {notice ? (
        <Notice tone={notice.tone === "success" ? "success" : notice.tone === "error" ? "error" : "info"} onDismiss={() => setNotice(null)}>
          {notice.text}
          {notice.tone === "error" && busy === "" ? (
            <>
              {" "}
              <button type="button" className="ws-inline-link" onClick={() => void saveRevision()}>
                Retry save
              </button>
            </>
          ) : null}
        </Notice>
      ) : null}

      {data.rejection_reason ? (
        <Notice tone="warning">Rejected with a review note: {data.rejection_reason}</Notice>
      ) : null}

      {published ? (
        <Notice tone="success">
          Published {formatDateTime(data.published_at)}. Students can open it when its schedule allows.
        </Notice>
      ) : null}

      <div className="ws-split">
        <section className="ws-panel ws-draft-editor" aria-labelledby="draft-fields-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">DRAFT CONTENT</p>
              <h2 id="draft-fields-title">Editable revision</h2>
            </div>
            <span className="ws-muted">Saving keeps this draft unpublished.</span>
          </div>

          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={form.title}
                disabled={!editable || busy !== ""}
                minLength={3}
                maxLength={255}
                onChange={(event) => update({ title: event.target.value })}
                aria-invalid={Boolean(errors.title)}
              />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="topic">Topic or concept</label>
              <input
                id="topic"
                value={form.topic}
                disabled={!editable || busy !== ""}
                minLength={2}
                maxLength={100}
                onChange={(event) => update({ topic: event.target.value })}
                aria-invalid={Boolean(errors.topic)}
              />
              <FieldError>{errors.topic}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={form.difficulty}
                disabled={!editable || busy !== ""}
                onChange={(event) => update({ difficulty: Number(event.target.value) })}
                aria-invalid={Boolean(errors.difficulty)}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Level {value}
                  </option>
                ))}
              </select>
              <FieldError>{errors.difficulty}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="xp">XP reward</label>
              <input
                id="xp"
                type="number"
                min={10}
                max={10000}
                value={form.xp}
                disabled={!editable || busy !== ""}
                onChange={(event) => update({ xp: Number(event.target.value) })}
                aria-invalid={Boolean(errors.xp)}
              />
              <FieldError>{errors.xp}</FieldError>
            </div>
            <div className="ws-field full">
              <label htmlFor="problem">Student instructions</label>
              <textarea
                id="problem"
                rows={8}
                value={form.problem}
                disabled={!editable || busy !== ""}
                onChange={(event) => update({ problem: event.target.value })}
                aria-invalid={Boolean(errors.problem)}
              />
              <FieldError>{errors.problem}</FieldError>
            </div>
          </div>

          {data.activity_type === "challenge" ? (
            <>
              <div className="ws-form-grid">
                <div className="ws-field">
                  <label htmlFor="starter">Starter code</label>
                  <textarea
                    id="starter"
                    className="ws-code-input"
                    rows={8}
                    value={form.starter}
                    disabled={!editable || busy !== ""}
                    onChange={(event) => update({ starter: event.target.value })}
                  />
                </div>
                <div className="ws-field">
                  <label htmlFor="reference">Reference solution (faculty only)</label>
                  <textarea
                    id="reference"
                    className="ws-code-input"
                    rows={8}
                    value={form.reference}
                    disabled={!editable || busy !== ""}
                    onChange={(event) => update({ reference: event.target.value })}
                    aria-invalid={Boolean(errors.reference)}
                  />
                  <FieldError>{errors.reference}</FieldError>
                </div>
              </div>

              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3>Grading cases</h3>
                  <p className="ws-muted">Hidden inputs and expected outputs are never sent to students.</p>
                </div>
                {editable ? (
                  <Button
                    variant="quiet"
                    onClick={() =>
                      update({
                        tests: [
                          ...form.tests,
                          {
                            order_index: form.tests.length,
                            stdin: "",
                            expected_stdout: "",
                            time_limit_ms: 2000,
                            memory_limit_kb: 256000,
                            is_hidden: true,
                            weight: 1,
                          },
                        ],
                      })
                    }
                  >
                    Add case
                  </Button>
                ) : null}
              </div>
              <FieldError>{errors.tests}</FieldError>
              <div className="ws-test-list">
                {form.tests.map((test, index) => (
                  <fieldset className="ws-test-case" key={index} disabled={!editable || busy !== ""}>
                    <legend>Case {index + 1}</legend>
                    <div className="ws-form-grid">
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-stdin`}>Input</label>
                        <textarea id={`test-${index}-stdin`} rows={2} value={test.stdin} onChange={(event) => updateTest(index, { stdin: event.target.value })} />
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-expected`}>Expected output</label>
                        <textarea
                          id={`test-${index}-expected`}
                          rows={2}
                          value={test.expected_stdout}
                          onChange={(event) => updateTest(index, { expected_stdout: event.target.value })}
                          aria-invalid={Boolean(errors[`test-${index}-expected`])}
                        />
                        <FieldError>{errors[`test-${index}-expected`]}</FieldError>
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-time`}>Time limit (ms)</label>
                        <input
                          id={`test-${index}-time`}
                          type="number"
                          min={250}
                          max={15000}
                          value={test.time_limit_ms}
                          onChange={(event) => updateTest(index, { time_limit_ms: Number(event.target.value) })}
                          aria-invalid={Boolean(errors[`test-${index}-time`])}
                        />
                        <FieldError>{errors[`test-${index}-time`]}</FieldError>
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-memory`}>Memory (KB)</label>
                        <input
                          id={`test-${index}-memory`}
                          type="number"
                          min={32000}
                          max={1048576}
                          value={test.memory_limit_kb}
                          onChange={(event) => updateTest(index, { memory_limit_kb: Number(event.target.value) })}
                          aria-invalid={Boolean(errors[`test-${index}-memory`])}
                        />
                        <FieldError>{errors[`test-${index}-memory`]}</FieldError>
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-weight`}>Weight</label>
                        <input
                          id={`test-${index}-weight`}
                          type="number"
                          min={0.01}
                          max={100}
                          step={0.1}
                          value={test.weight}
                          onChange={(event) => updateTest(index, { weight: Number(event.target.value) })}
                        />
                      </div>
                      <label className="ws-check ws-field">
                        <input
                          type="checkbox"
                          checked={test.is_hidden}
                          onChange={(event) => updateTest(index, { is_hidden: event.target.checked })}
                        />
                        <span>Hidden from students</span>
                      </label>
                    </div>
                    {editable && form.tests.length > 1 ? (
                      <Button variant="quiet" onClick={() => update({ tests: form.tests.filter((_, itemIndex) => itemIndex !== index) })}>
                        Remove case
                      </Button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3>Questions and answer keys</h3>
                  <p className="ws-muted">Correct answers are visible only to assigned faculty.</p>
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
                            options: [
                              { key: "A", text: "" },
                              { key: "B", text: "" },
                              { key: "C", text: "" },
                              { key: "D", text: "" },
                            ],
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
              <div className="ws-test-list">
                {form.questions.map((question, index) => (
                  <fieldset className="ws-test-case" key={question.id} disabled={!editable || busy !== ""}>
                    <legend>Question {index + 1}</legend>
                    <div className="ws-field">
                      <label htmlFor={`question-${index}-prompt`}>Question text</label>
                      <textarea
                        id={`question-${index}-prompt`}
                        rows={2}
                        value={question.prompt}
                        onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                        aria-invalid={Boolean(errors[`question-${index}-prompt`])}
                      />
                      <FieldError>{errors[`question-${index}-prompt`]}</FieldError>
                    </div>
                    <div className="ws-option-grid">
                      {question.options.map((option, optionIndex) => (
                        <label className="ws-field" key={option.key}>
                          <span>Option {option.key}</span>
                          <input
                            value={option.text}
                            onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <FieldError>{errors[`question-${index}-options`]}</FieldError>
                    <div className="ws-field">
                      <label htmlFor={`question-${index}-correct`}>Correct answer</label>
                      <select
                        id={`question-${index}-correct`}
                        value={question.correct_answer}
                        onChange={(event) => updateQuestion(index, { correct_answer: event.target.value })}
                      >
                        {question.options.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.key}
                          </option>
                        ))}
                      </select>
                      <FieldError>{errors[`question-${index}-correct`]}</FieldError>
                    </div>
                    {editable && form.questions.length > 1 ? (
                      <Button
                        variant="quiet"
                        onClick={() => update({ questions: form.questions.filter((_, itemIndex) => itemIndex !== index) })}
                      >
                        Remove question
                      </Button>
                    ) : null}
                  </fieldset>
                ))}
              </div>
            </>
          )}

          <div className="ws-source-note">
            <strong>Provenance</strong>
            <span>
              {data.generation.model_version ? `Model ${data.generation.model_version}` : "Manual authoring"} ·{" "}
              {data.generation.prompt_version || "no prompt version"} · {citations.length} cited source passage
              {citations.length === 1 ? "" : "s"}
              {pages.length ? ` · pages ${pages.join(", ")}` : ""}
            </span>
          </div>
        </section>

        <aside className="ws-panel ws-sources" aria-labelledby="sources-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">SOURCE EVIDENCE</p>
              <h2 id="sources-title">Cited PDF pages</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={reload}>
              Reload
            </button>
          </div>
          {citations.length === 0 ? (
            <EmptyState title="No cited source is recorded">
              {data.material
                ? "This draft was created before citations were captured. Regenerate it from the material to attach page evidence."
                : "This draft has no linked source material."}
            </EmptyState>
          ) : (
            <>
              <div className="ws-citation-list" role="group" aria-label="Citations">
                {citations.map((citation, index) => (
                  <button
                    key={`${citation.id}-${index}`}
                    type="button"
                    className={`ws-citation${index === activeCitation ? " is-active" : ""}`}
                    aria-pressed={index === activeCitation}
                    onClick={() => setActiveCitation(index)}
                  >
                    <span className="ws-citation-page">Page {citation.page_number ?? "?"}</span>
                    <span className="ws-citation-title">{citation.document_title}</span>
                    <span className="ws-citation-meta">v{citation.version_number ?? 1}</span>
                  </button>
                ))}
              </div>
              <div className="ws-source-excerpt" aria-live="polite">
                {currentCitation ? (
                  currentCitation.available ? (
                    <>
                      <div className="ws-source-excerpt-head">
                        <strong>{currentCitation.document_title}</strong>
                        <span>
                          page {currentCitation.page_number} · version {currentCitation.version_number}
                        </span>
                      </div>
                      <blockquote>{currentCitation.excerpt}</blockquote>
                    </>
                  ) : (
                    <div className="ws-source-unavailable">
                      <strong>Source excerpt unavailable</strong>
                      <p>
                        Citation <code>{currentCitation.id}</code> could not be resolved from the stored index.
                      </p>
                      <Button variant="outline" onClick={reload}>
                        Retry source lookup
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
              <p className="ws-footnote">
                Citations are a snapshot taken when the draft was generated. Archiving a material preserves them.
              </p>
            </>
          )}

          <div className="ws-source-note">
            <strong>Student-visible preview</strong>
            <StudentPreviewCard
              preview={data.student_preview}
              schedule={{
                opens_at: data.opens_at,
                closes_at: data.closes_at,
                state: data.state,
                timezone: "Asia/Manila",
              }}
              compact
            />
          </div>
        </aside>
      </div>

      <div className="ws-sticky-actions">
        <div className="ws-sticky-status">
          {dirty ? <StatusChip state="pending" label="Unsaved changes" tone="wait" /> : <StatusChip state="ready" label="All changes saved" />}
          <span className="ws-muted">
            {data.review_status === "published" ? "Published content is read-only." : "Saving keeps this draft in review."}
          </span>
        </div>
        <div className="ws-inline-actions">
          <Button
            variant="outline"
            disabled={!editable || busy !== ""}
            onClick={() => void saveRevision()}
            aria-busy={busy === "save"}
          >
            {busy === "save" ? "Saving…" : "Save revision"}
          </Button>
          <Button variant="danger" disabled={!editable || busy !== ""} onClick={() => setRejectOpen(true)}>
            Reject draft
          </Button>
          <Button
            variant="primary"
            disabled={!editable || dirty || busy !== ""}
            onClick={() => {
              setApproveError("");
              setApproveOpen(true);
            }}
          >
            Approve and publish
          </Button>
        </div>
      </div>
      {dirty && editable ? <p className="ws-footnote">Save your revision before approving. Publishing is always a separate confirmation.</p> : null}

      <ConfirmDialog
        open={rejectOpen}
        title="Reject this draft"
        confirmLabel="Reject draft"
        tone="danger"
        busy={busy === "reject"}
        onCancel={() => {
          setRejectOpen(false);
          setRejectError("");
        }}
        onConfirm={() => void confirmReject()}
      >
        <p>The draft returns to the queue with your note. Students cannot see it.</p>
        <label className="ws-field">
          <span>Reason</span>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain what needs correction."
            aria-invalid={Boolean(rejectError)}
          />
          <FieldError>{rejectError}</FieldError>
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={approveOpen}
        title="Approve and publish"
        confirmLabel="Publish reviewed content"
        busy={busy === "approve"}
        onCancel={() => {
          setApproveOpen(false);
          setApproveChecked(false);
          setApproveError("");
        }}
        onConfirm={() => void confirmApprove()}
      >
        <div className="ws-approve-summary">
          <dl>
            <div>
              <dt>Content type</dt>
              <dd>{data.activity_type === "quiz" ? "Quiz" : "Coding challenge"}</dd>
            </div>
            <div>
              <dt>Target course</dt>
              <dd>{data.course?.title}</dd>
            </div>
            <div>
              <dt>Source pages</dt>
              <dd>{pages.length ? pages.join(", ") : "No cited pages"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>v{data.version_number}</dd>
            </div>
          </dl>
        </div>
        <StudentPreviewCard
          preview={data.student_preview}
          schedule={{
            opens_at: data.opens_at,
            closes_at: data.closes_at,
            state: data.state,
            timezone: "Asia/Manila",
          }}
          compact
        />
        <label className="ws-check">
          <input type="checkbox" checked={approveChecked} onChange={(event) => setApproveChecked(event.target.checked)} />
          <span>I reviewed the student-visible preview above and confirm this publication.</span>
        </label>
        <FieldError>{approveError}</FieldError>
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="draft workspace">
      <DraftWorkspace />
    </WorkspaceSuspense>
  );
}
