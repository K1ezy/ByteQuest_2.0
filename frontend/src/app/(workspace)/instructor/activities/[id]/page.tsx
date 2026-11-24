"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIdentity } from "@/components/instructor/activity-identity";
import { InstructorIcon } from "@/components/instructor/course-ui";
import { SaveConflict } from "@/components/instructor/save-conflict";
import { InstructorHints } from "@/components/instructor-hints";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { StudentPreviewCard } from "@/components/workspace/student-preview";
import { Button, ConfirmDialog, EmptyState, FieldError, LoadingPanel, Notice, useApi, useNow } from "@/components/workspace/ui";
import { workshopLanguages } from "@/components/workshops/workshop-ui";
import { formatManilaDateTime, fromManilaDateTimeInput } from "@/lib/activity-date";
import { activityForm, editsAfterSave, pendingActivityUpdate, type ActivityForm } from "@/lib/activity-editor";
import { ApiError, getErrorMessage } from "@/lib/api";
import { activityEditorHref, activityListHref, publicationChecks } from "@/lib/instructor-activity";
import {
  approveDraft, createActivityVersion, friendlyLoadError, getActivity, publishActivity, rejectDraft, updateActivity, verifyActivity,
  type ActivityDetail, type StudentPreview,
} from "@/lib/workspace";

function localPreview(detail: ActivityDetail, form: ActivityForm): StudentPreview {
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

function ActivitySources({ activity }: { activity: ActivityDetail }) {
  return (
    <details className="ic-activity-sources">
      <summary>Source PDF {activity.citations.length ? `· ${activity.citations.length} cited excerpt${activity.citations.length === 1 ? "" : "s"}` : ""}</summary>
      {activity.citations.length ? activity.citations.map((citation, index) => (
        <details key={`${citation.id}-${index}`} className="ic-activity-source">
          <summary>Page {citation.page_number ?? "?"} · {citation.document_title} · v{citation.version_number ?? 1}</summary>
          {citation.available ? <blockquote>{citation.excerpt}</blockquote> : <p>Source excerpt unavailable.</p>}
        </details>
      )) : <p>No cited pages were recorded for this draft.</p>}
    </details>
  );
}

function ActivityEditor({ activityId }: { activityId: string }) {
  const router = useRouter();
  const { courseId, setUnsaved, refreshCourses } = useWorkspace();
  const { data, error, loading, reload, setData } = useApi<ActivityDetail>(`/faculty/activities/${encodeURIComponent(activityId)}`, true);
  const [edits, setEdits] = useState<Partial<ActivityForm>>({});
  const [busy, setBusy] = useState<"" | "save" | "verify" | "publish" | "version" | "reject">("");
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [returnPending, setReturnPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [publishVersion, setPublishVersion] = useState<number | null>(null);
  const [publishError, setPublishError] = useState("");
  const [previewedVersion, setPreviewedVersion] = useState<number | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const saving = useRef(false);
  const now = useNow();
  const saved = useMemo(() => data ? activityForm(data) : null, [data]);
  const form = useMemo(() => saved ? { ...saved, ...edits } : null, [saved, edits]);
  const pending = useMemo(() => data && saved && form ? pendingActivityUpdate(data, saved, form) : null, [data, form, saved]);
  const errors = pending?.errors ?? {};
  const hasChanges = Boolean(pending && Object.keys(pending.sent).length);
  const unfinished = Object.keys(errors).length > 0;
  const dirty = hasChanges || unfinished;
  const scope = data?.course?.id ?? courseId;
  const returnTo = activityListHref(scope, data ? activityId : undefined);
  const editable = data?.state === "draft" && !data.grading_locked && !data.attempt_count;
  const generated = Boolean(data?.source_document_id || data?.generation?.model_version);
  const editingLocked = Boolean(busy && busy !== "save") || publishVersion !== null || rejectOpen;

  useEffect(() => {
    setUnsaved(dirty || busy === "save", "Some activity changes are still unsaved. Leave anyway?");
    return () => setUnsaved(false);
  }, [busy, dirty, setUnsaved]);

  useEffect(() => {
    if (returnPending && !dirty && !busy && !conflict && !saveError) {
      setUnsaved(false);
      router.push(returnTo);
    }
  }, [busy, conflict, dirty, returnPending, returnTo, router, saveError, setUnsaved]);

  const save = useCallback(async () => {
    if (!pending || !hasChanges || busy || conflict || saving.current) return;
    saving.current = true;
    setBusy("save");
    setSaveError("");
    try {
      const result = await updateActivity(activityId, pending.payload);
      setData(result.activity);
      setEdits((current) => editsAfterSave(current, pending.sent));
      setSavedAt(Date.now());
    } catch (caught) {
      setReturnPending(false);
      if (caught instanceof ApiError && caught.code === "version_conflict") setConflict(true);
      else setSaveError(getErrorMessage(caught));
    } finally {
      saving.current = false;
      setBusy("");
    }
  }, [activityId, busy, conflict, hasChanges, pending, setData]);

  useEffect(() => {
    if (!hasChanges || busy || conflict || saveError || publishVersion !== null || rejectOpen) return;
    const timer = window.setTimeout(() => void save(), 350);
    return () => window.clearTimeout(timer);
  }, [busy, conflict, hasChanges, publishVersion, rejectOpen, save, saveError]);

  function update(patch: Partial<ActivityForm>) {
    setEdits((current) => ({ ...current, ...patch }));
    setSaveError("");
  }

  async function runVerification() {
    if (busy || dirty || conflict || !editable) return;
    setBusy("verify");
    setNotice(null);
    try {
      const result = await verifyActivity(activityId);
      setData(result.activity);
      setNotice({ text: result.message, tone: result.activity.judge0_verified ? "success" : "error" });
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "version_conflict") setConflict(true);
      else setNotice({ text: getErrorMessage(caught), tone: "error" });
    } finally {
      setBusy("");
    }
  }

  async function newVersion() {
    if (busy || dirty || conflict) return;
    setBusy("version");
    try {
      const result = await createActivityVersion(activityId);
      router.push(activityListHref(scope, result.activity.activity_id));
      void refreshCourses();
    } catch (caught) {
      setNotice({ text: getErrorMessage(caught), tone: "error" });
    } finally {
      setBusy("");
    }
  }

  async function confirmPublish() {
    if (!data || publishVersion === null || busy || dirty || conflict) return;
    setBusy("publish");
    setPublishError("");
    try {
      if (generated) await approveDraft(activityId, publishVersion);
      else await publishActivity(activityId, publishVersion);
      setUnsaved(false);
      router.replace(activityListHref(scope, activityId, true));
      void refreshCourses();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.code === "version_conflict" || caught.code === "already_published")) {
        setPublishVersion(null);
        setConflict(true);
      } else setPublishError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function requestChanges() {
    if (busy || dirty || conflict) return;
    if (rejectReason.trim().length < 5) {
      setRejectError("Enter at least five characters.");
      return;
    }
    setRejectError("");
    setBusy("reject");
    try {
      await rejectDraft(activityId, rejectReason.trim());
      setData(await getActivity(activityId));
      setRejectOpen(false);
      setRejectReason("");
    } catch (caught) {
      setRejectError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading activity…" />;
  if (!data || !form) {
    return <EmptyState title="Activity unavailable" action={<Link className="ic-button" href={returnTo}>← Activities</Link>}>
      {error ? friendlyLoadError(error) : "This activity may have moved."}
      {error ? <Button onClick={reload}>Try again</Button> : null}
    </EmptyState>;
  }

  const quiz = data.activity_type === "quiz";
  const needsSample = !quiz && !data.exam_only && !form.tests.some((test) => !test.is_hidden);
  const audience = `students in ${data.course?.title ?? "this course"}${data.language ? ` on the ${workshopLanguages[data.language]} track` : ""}`;
  const savedIssues = data.publication_issues ?? [
    ...(quiz && form.questions.length < 3 ? ["invalid_quiz"] : []),
    ...(!quiz && !form.tests.length ? ["missing_tests"] : []),
    ...(needsSample ? ["missing_sample"] : []),
    ...(!quiz && !data.judge0_verified ? ["not_verified"] : []),
  ];
  const currentVersionPreviewed = previewedVersion === data.content_version && !dirty;
  const detailsIssue = form.title.trim().length < 3 || form.topic.trim().length < 2 || form.problem.trim().length < 20
    || Boolean(errors.xp || errors.passMark);
  const scheduleIssue = Boolean(errors.opensAt || errors.closesAt || savedIssues.includes("invalid_schedule"));
  const contentIssue = Object.keys(errors).some((key) => key.startsWith("question-") || key.startsWith("test-")) || Boolean(errors.reference);
  const checkKeys = quiz
    ? ["invalid_quiz", "invalid_schedule"]
    : ["missing_tests", ...(!data.exam_only ? ["missing_sample"] : []), "not_verified", "invalid_schedule"];
  const checks = [
    { label: "Activity details", action: "Complete details", section: "activity-details", complete: !detailsIssue },
    ...checkKeys.map((key) => ({
      ...publicationChecks[key],
      complete: key === "invalid_schedule" ? !scheduleIssue
        : !savedIssues.includes(key) && !(contentIssue && (key === "invalid_quiz" || key === "missing_tests")),
    })),
  ];
  const firstIncomplete = checks.find((item) => !item.complete);
  const ready = !firstIncomplete && !dirty && !busy && !conflict;
  if (!data.exam_only) checks.push({
    label: generated ? "Review draft and student preview" : "Review student preview",
    action: "Review student preview", section: "activity-preview", complete: currentVersionPreviewed,
  });
  const preview = localPreview(data, form);
  const scheduleSummary = {
    opens_at: fromManilaDateTimeInput(form.opensAt),
    closes_at: fromManilaDateTimeInput(form.closesAt),
    state: data.state,
    timezone: "Asia/Manila",
  };
  const feedback = conflict ? "Changes need attention" : saveError ? "Could not save"
    : busy === "save" || hasChanges ? "Saving…" : unfinished ? "Unfinished changes"
      : savedAt !== null ? now.getTime() - savedAt < 60_000 ? "Saved · just now" : `Saved · ${formatManilaDateTime(new Date(savedAt).toISOString())}`
        : "Saved";

  function reviewPreview() {
    if (!data || !ready) return;
    setPreviewedVersion(data.content_version);
    focusSection("activity-preview");
  }

  function focusSection(section: string) {
    setChecklistOpen(false);
    const target = document.getElementById(section);
    target?.scrollIntoView?.({ block: "start" });
    target?.focus({ preventScroll: true });
  }

  return (
    <div className="ic-activity-editor">
      <Link className="ic-activity-back" href={returnTo} onNavigate={(event) => {
        if (unfinished || conflict || saveError || (busy && busy !== "save")) {
          if (!window.confirm("Some changes are still in progress. Leave this activity?")) event.preventDefault();
        } else if (dirty || busy === "save") {
          event.preventDefault();
          setReturnPending(true);
        }
      }}>{returnPending ? "Saving before leaving…" : "← Activities"}</Link>
      <header className="ic-activity-editor-header">
        <ActivityIdentity page activity={data} feedback={<span role="status" className="ic-activity-saved">{feedback}</span>} />
        <details className="ic-row-menu">
          <summary className="ic-button" aria-label="More activity actions">⋯</summary>
          <div className="ic-menu-options">
            <button type="button" className="ic-button" onClick={() => void newVersion()} disabled={Boolean(busy) || dirty || conflict}>
              {busy === "version" ? "Creating version…" : "New version"}
            </button>
            {data.review_status === "published" && data.state !== "archived" ? (
              <Link className="ic-button" href={`${activityEditorHref(activityId, null)}/analysis${scope ? `?course=${encodeURIComponent(scope)}` : ""}`}>Analysis</Link>
            ) : null}
            {generated && editable ? <button type="button" className="ic-button" disabled={Boolean(busy) || dirty || conflict}
              onClick={() => { setRejectError(""); setRejectOpen(true); }}>Request changes</button> : null}
            {(data.versions ?? []).filter((version) => version.activity_id !== activityId).map((version) => (
              <Link className="ic-button" key={version.activity_id} href={activityEditorHref(version.activity_id, scope)}>Version {version.version_number}</Link>
            ))}
          </div>
        </details>
      </header>

      {conflict ? <SaveConflict changes={edits} onReload={async () => {
        setData(await getActivity(activityId));
        setEdits({});
        setPreviewedVersion(null);
        setConflict(false);
      }} /> : null}
      {saveError ? <Notice tone="error">
        <p>{saveError} Your changes are still here.</p>
        <Button onClick={() => void save()}>Retry save</Button>
      </Notice> : null}
      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}
      {data.rejection_reason ? <Notice tone="warning">Changes requested. {data.rejection_reason}</Notice> : null}

      <div className="ic-activity-editor-grid">
        <div className="ic-activity-sections">
          <section className="ic-activity-section" aria-labelledby="activity-details">
            <h2 id="activity-details" tabIndex={-1}>Details</h2>
          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="title">Title</label>
              <input id="title" maxLength={255} value={form.title} disabled={!editable || editingLocked} onChange={(event) => update({ title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="topic">Topic or concept</label>
              <input id="topic" maxLength={100} value={form.topic} disabled={!editable || editingLocked} onChange={(event) => update({ topic: event.target.value })} aria-invalid={Boolean(errors.topic)} />
              <FieldError>{errors.topic}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="difficulty">Difficulty</label>
              <select id="difficulty" value={form.difficulty} disabled={!editable || editingLocked} onChange={(event) => update({ difficulty: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>Level {value}</option>
                ))}
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor="xp">XP reward</label>
              <input id="xp" type="number" min={10} max={10000} aria-invalid={Boolean(errors.xp)} value={form.xp} disabled={!editable || editingLocked} onChange={(event) => update({ xp: Number(event.target.value) })} />
              <FieldError>{errors.xp}</FieldError>
            </div>
            {data.activity_type === "challenge" && (
              <div className="ws-field">
                <label htmlFor="pass-mark">Pass mark (%)</label>
                <input id="pass-mark" type="number" inputMode="numeric" min={1} max={100} placeholder="Default" value={form.passMark} disabled={!editable || editingLocked} onChange={(event) => update({ passMark: event.target.value })} aria-describedby="pass-mark-help" />
                <FieldError>{errors.passMark}</FieldError>
                <p id="pass-mark-help" className="ws-muted">Weighted score a submission needs to pass. Leave blank for the default: every test in practice, 80% in exams.</p>
              </div>
            )}
            <div className="ws-field full">
              <label htmlFor="problem">Student instructions</label>
              <textarea id="problem" rows={5} maxLength={20000} value={form.problem} disabled={!editable || editingLocked} onChange={(event) => update({ problem: event.target.value })} aria-invalid={Boolean(errors.problem)} />
              <FieldError>{errors.problem}</FieldError>
            </div>
          </div>
          </section>

          <section className="ic-activity-section" aria-labelledby="activity-content">
            <h2 id="activity-content" tabIndex={-1}>{quiz ? "Quiz content" : "Coding content"}</h2>
            <div className={generated ? "ic-activity-content with-source" : undefined}>
              <div>
                {quiz ? (
            <>
              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3>Questions and answer keys</h3>
                  <p className="ws-muted">Correct answers stay with instructors; students never receive them.</p>
                </div>
                {editable ? (
                  <Button
                    variant="quiet"
                    disabled={form.questions.length >= 10 || editingLocked}
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
              {form.questions.length === 0 ? <p className="ws-muted">No questions yet. A quiz needs at least 3 questions to publish.</p> : null}
              <div className="ws-test-list">
                {form.questions.map((question, index) => (
                  <fieldset className="ws-test-case" key={question.id} disabled={!editable || editingLocked}>
                    <legend>Question {index + 1}</legend>
                    <div className="ws-field">
                      <label htmlFor={`question-${index}-prompt`}>Question text</label>
                      <textarea id={`question-${index}-prompt`} rows={2} maxLength={2000} value={question.prompt} onChange={(event) => update({ questions: form.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, prompt: event.target.value } : item)) })} aria-invalid={Boolean(errors[`question-${index}-prompt`])} />
                      <FieldError>{errors[`question-${index}-prompt`]}</FieldError>
                    </div>
                    <div className="ws-option-grid">
                      {question.options.map((option, optionIndex) => (
                        <label className="ws-field" key={option.key}>
                          <span>Option {option.key}</span>
                          <input
                            maxLength={500}
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
                    <FieldError>{errors[`question-${index}-options`]}</FieldError>
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
                  <textarea id="starter" className="ws-code-input" rows={6} maxLength={50000} value={form.starter} disabled={!editable || editingLocked} onChange={(event) => update({ starter: event.target.value })} />
                </div>
                <div className="ws-field">
                  <label htmlFor="reference">Reference solution (instructors only)</label>
                  <textarea id="reference" className="ws-code-input" rows={6} maxLength={50000} value={form.reference} disabled={!editable || editingLocked} onChange={(event) => update({ reference: event.target.value })} aria-invalid={Boolean(errors.reference)} />
                  <FieldError>{errors.reference}</FieldError>
                </div>
              </div>
              <div className="ws-panel-head ws-subhead">
                <div>
                  <h3 id="activity-grading-cases" tabIndex={-1}>Grading cases</h3>
                  <p className="ws-muted">Hidden inputs and expected outputs are withheld from students.</p>
                  {editable && needsSample ? (
                    <p className="ws-muted">Make one case visible so students can run a sample after publication.</p>
                  ) : null}
                </div>
                <div className="ws-inline-actions">
                  {editable ? (
                    <Button
                      variant="quiet"
                      disabled={form.tests.length >= 20 || editingLocked}
                      onClick={() =>
                        update({
                          tests: [...form.tests, { order_index: form.tests.length, stdin: "", expected_stdout: "", time_limit_ms: 2000, memory_limit_kb: 256000, is_hidden: true, weight: 1 }],
                        })
                      }
                    >
                      Add case
                    </Button>
                  ) : null}
                </div>
              </div>
              {form.tests.length === 0 ? <p className="ws-muted">No grading cases yet. A coding challenge needs at least one case to publish.</p> : null}
              <div className="ws-test-list">
                {form.tests.map((test, index) => (
                  <fieldset className="ws-test-case" key={index} disabled={!editable || editingLocked}>
                    <legend>Case {index + 1}</legend>
                    <div className="ws-form-grid">
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-stdin`}>Input</label>
                        <textarea id={`test-${index}-stdin`} rows={2} maxLength={20000} value={test.stdin} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, stdin: event.target.value } : item)) })} />
                      </div>
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-expected`}>Expected output</label>
                        <textarea id={`test-${index}-expected`} rows={2} maxLength={20000} value={test.expected_stdout} onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, expected_stdout: event.target.value } : item)) })} aria-invalid={Boolean(errors[`test-${index}-expected`])} />
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
                      <div className="ws-field">
                        <label htmlFor={`test-${index}-weight`}>Weight</label>
                        <input id={`test-${index}-weight`} type="number" min={0.01} max={100} step={0.01}
                          value={test.weight} aria-invalid={Boolean(errors[`test-${index}-weight`])}
                          onChange={(event) => update({ tests: form.tests.map((item, itemIndex) => (itemIndex === index ? { ...item, weight: Number(event.target.value) } : item)) })} />
                        <FieldError>{errors[`test-${index}-weight`]}</FieldError>
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
              {editable ? <div className="ic-activity-verification" id="activity-verification" tabIndex={-1}>
                <h3>Reference solution check</h3>
                <Button variant="outline" onClick={() => void runVerification()}
                  disabled={Boolean(busy) || dirty || !form.tests.length || !form.reference.trim()}>
                  {busy === "verify" ? "Checking…" : data.judge0_verified ? "Run verification again" : "Verify with Judge0"}
                </Button>
              </div> : null}
              <InstructorHints activityId={activityId} editable={editable} />
            </>
          )}
              </div>
              {generated ? <ActivitySources activity={data} /> : null}
            </div>
          </section>

          <section className="ic-activity-section" aria-labelledby="activity-schedule">
            <h2 id="activity-schedule" tabIndex={-1}>Schedule</h2>
            <p className="ws-muted">Times are shown in Asia/Manila.</p>
          <div className="ws-form-grid">
            <div className="ws-field">
              <label htmlFor="opens-at">Opens at</label>
              <input id="opens-at" type="datetime-local" value={form.opensAt} onChange={(event) => update({ opensAt: event.target.value })} disabled={data.state === "archived" || editingLocked} aria-invalid={Boolean(errors.opensAt)} />
              <FieldError>{errors.opensAt}</FieldError>
              <p className="ws-muted">Leave empty to open immediately when published.</p>
            </div>
            <div className="ws-field">
              <label htmlFor="closes-at">Closes at</label>
              <input id="closes-at" type="datetime-local" value={form.closesAt} onChange={(event) => update({ closesAt: event.target.value })} disabled={data.state === "archived" || editingLocked} aria-invalid={Boolean(errors.closesAt)} />
              <FieldError>{errors.closesAt}</FieldError>
            </div>
          </div>
          </section>

          <section className="ic-activity-section" aria-labelledby="activity-preview">
            <h2 id="activity-preview" tabIndex={-1}>Preview</h2>
            <StudentPreviewCard preview={preview} schedule={scheduleSummary} />
            {editable && !data.exam_only && currentVersionPreviewed ? (
              <Button variant="primary" disabled={!ready} onClick={() => { setPublishError(""); setPublishVersion(data.content_version); }}>
                Publish activity
              </Button>
            ) : null}
          </section>
        </div>

        {editable ? <aside className="ic-readiness" aria-labelledby="readiness-heading">
          <h2 id="readiness-heading">Readiness</h2>
          <button type="button" className="ic-button ic-readiness-toggle" aria-controls="readiness-checks"
            aria-expanded={checklistOpen} onClick={() => setChecklistOpen(!checklistOpen)}>
            Readiness · {checks.filter((check) => check.complete).length} of {checks.length}
          </button>
          <ul id="readiness-checks" className={checklistOpen ? "is-expanded" : ""}>
            {checks.map((check) => (
              <li key={check.label}>
                <a href={`#${check.section}`} onClick={(event) => {
                  event.preventDefault();
                  if (check.section === "activity-preview" && ready) reviewPreview();
                  else focusSection(check.section);
                }}>
                  <span className="ic-readiness-mark" data-complete={check.complete} aria-hidden="true">{check.complete ? <InstructorIcon name="check" /> : "○"}</span>
                  <span><span className="sr-only">{check.complete ? "Complete. " : "Incomplete. "}</span>{check.label}</span>
                </a>
              </li>
            ))}
          </ul>
          {data.exam_only && !firstIncomplete ? (
            <Link className="ic-button ic-primary" href={`/instructor/exams${scope ? `?course=${encodeURIComponent(scope)}` : ""}`}
              onNavigate={(event) => { if ((dirty || busy) && !window.confirm("Some changes are still in progress. Leave this activity?")) event.preventDefault(); }}>
              Open Exams
            </Link>
          ) : firstIncomplete ? (
            <a className="ic-button ic-primary" href={`#${firstIncomplete.section}`}
              onClick={(event) => { event.preventDefault(); focusSection(firstIncomplete.section); }}>{firstIncomplete.action}</a>
          ) : currentVersionPreviewed ? (
            <a className="ic-button" href="#activity-preview" onClick={(event) => { event.preventDefault(); focusSection("activity-preview"); }}>Back to preview</a>
          ) : <Button variant="primary" disabled={!ready} onClick={reviewPreview}>Review student preview</Button>}
        </aside> : null}
      </div>

      <ConfirmDialog open={publishVersion !== null} title="Publish this activity?" cancelLabel="Keep editing"
        confirmLabel="Confirm and publish" busy={busy === "publish"}
        onCancel={() => { if (!busy) { setPublishVersion(null); setPublishError(""); } }}
        onConfirm={() => void confirmPublish()}>
        <p><strong>{form.title}</strong> will be available to {audience}
          {form.opensAt ? ` from ${formatManilaDateTime(scheduleSummary.opens_at)} Manila time` : " immediately"}.
        </p>
        <FieldError>{publishError}</FieldError>
      </ConfirmDialog>
      <ConfirmDialog open={rejectOpen} title="Request changes" confirmLabel="Save review note" busy={busy === "reject"}
        onCancel={() => { if (!busy) setRejectOpen(false); }} onConfirm={() => void requestChanges()}>
        <label className="ws-field">Review note
          <textarea rows={3} maxLength={4000} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
        </label>
        <FieldError>{rejectError}</FieldError>
      </ConfirmDialog>
    </div>
  );
}

function ScopedEditor() {
  const { id } = useParams<{ id: string }>();
  return <ActivityEditor key={id} activityId={id} />;
}

export default function Page() {
  return <WorkspaceSuspense label="activity editor"><ScopedEditor /></WorkspaceSuspense>;
}
