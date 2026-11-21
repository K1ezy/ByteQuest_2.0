"use client";

import Link from "next/link";
import { useShellProfile } from "@/components/app-shell";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

type ExamMode = "practice" | "restricted";
interface Catalog { workshops: { id: string; name: string; language: string }[];
  activities: { id: string; title: string; kind: string; language: string; exam_only?: boolean }[] }
interface Exam { id: string; title: string; opens_at: string; closes_at: string; published: boolean;
  results_released: boolean; has_unreleased_results?: boolean }
interface AttemptResult {
  id: string;
  grading_state?: "needs_retry" | "retry_scheduled" | "running" | "queued" | null;
  attempt_number: number; status: string; score: number | null; max_score: number | null;
  results_released: boolean; xp_awarded: number | null;
}
interface ExamDetail { id: string; workshops: { id: string; name: string }[];
  students: { id: string; alias: string; attempts: number; results?: AttemptResult[] }[] }

function manilaIso(local: string): string { return new Date(`${local}:00+08:00`).toISOString(); }

export default function InstructorExamsPage() {
  const { role } = useShellProfile();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [title, setTitle] = useState("");
  const [contentMode, setContentMode] = useState<ExamMode>("practice");
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [duration, setDuration] = useState(45);
  const [workshopIds, setWorkshopIds] = useState<string[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [points, setPoints] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [retakeOpen, setRetakeOpen] = useState("");
  const [retakeClose, setRetakeClose] = useState("");
  const [retakeDuration, setRetakeDuration] = useState(45);
  async function load() {
    const [source, existing] = await Promise.all([
      apiRequest<Catalog>("/exams/instructor/catalog"), apiRequest<Exam[]>("/exams/instructor")]);
    setCatalog(source); setExams(existing);
  }
  useEffect(() => { void Promise.all([
    apiRequest<Catalog>("/exams/instructor/catalog"), apiRequest<Exam[]>("/exams/instructor"),
  ]).then(([source, existing]) => { setCatalog(source); setExams(existing); })
    .catch((cause) => setError(getErrorMessage(cause))); }, []);
  const selectedWorkshops = catalog?.workshops.filter((workshop) => workshopIds.includes(workshop.id)) ?? [];
  const selectedLanguage = selectedWorkshops[0]?.language;
  const eligibleWorkshops = selectedWorkshops.filter((workshop) => workshop.language === selectedLanguage);
  const modeActivities = catalog?.activities.filter((activity) => Boolean(activity.exam_only) === (contentMode === "restricted")) ?? [];
  const eligibleActivities = modeActivities.filter((activity) => activity.language === selectedLanguage);
  const eligibleActivityIds = new Set(eligibleActivities.map((activity) => activity.id));
  const selectedActivityIds = activityIds.filter((id) => eligibleActivityIds.has(id));
  const activitiesHref = role === "admin" ? "/admin/teaching/studio" : "/instructor/activities";
  function toggle(id: string, selected: string[], setter: (value: string[]) => void) {
    setter(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }
  function toggleWorkshop(workshop: Catalog["workshops"][number]) {
    if (selectedLanguage && workshop.language !== selectedLanguage) return;
    toggle(workshop.id, eligibleWorkshops.map((item) => item.id), setWorkshopIds);
    if (eligibleWorkshops.length === 1 && eligibleWorkshops[0].id === workshop.id) {
      setActivityIds([]);
      setPoints({});
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy || eligibleWorkshops.length === 0 || selectedActivityIds.length === 0) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const created = await apiRequest<{ id: string }>("/exams/instructor", { method: "POST",
        body: JSON.stringify({ title, content_mode: contentMode, opens_at: manilaIso(open), closes_at: manilaIso(close),
          duration_minutes: duration, workshop_ids: eligibleWorkshops.map((workshop) => workshop.id),
          items: selectedActivityIds.map((id) => ({ activity_id: id, points: points[id] || 10 })) }) });
      await apiRequest(`/exams/instructor/${created.id}/publish`, { method: "POST" });
      setMessage("Exam published with a frozen copy of the reviewed activities.");
      setTitle(""); setWorkshopIds([]); setActivityIds([]); setPoints({});
      await load();
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function act(examId: string, action: "publish" | "release") {
    setBusy(true); setError(""); setMessage("");
    try { await apiRequest(`/exams/instructor/${examId}/${action}`, { method: "POST" });
      setMessage(action === "publish" ? "Exam published." : "Results released to students."); await load();
      if (detail?.id === examId) await manage(examId);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function manage(examId: string) {
    setError("");
    try { setDetail(await apiRequest<ExamDetail>(`/exams/instructor/${examId}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
  }
  async function refreshExams() {
    setBusy(true); setError("");
    try {
      await load();
      if (detail) await manage(detail.id);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function retryGrading(attemptId: string) {
    if (!detail) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest(`/exams/instructor/${detail.id}/attempts/${attemptId}/retry-grading`, { method: "POST" });
      setMessage("Grading queued again. Saved answers are intact.");
      await manage(detail.id);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function grant(studentId: string) {
    if (!detail) return;
    setBusy(true); setError("");
    try { await apiRequest(`/exams/instructor/${detail.id}/retakes/${studentId}`, { method: "POST",
      body: JSON.stringify({ opens_at: manilaIso(retakeOpen), closes_at: manilaIso(retakeClose),
        duration_minutes: retakeDuration }) });
      setMessage("Retake granted within the selected window.");
      await manage(detail.id);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div className="page-shell pilot-dashboard"><p className="eyebrow-label">Instructor studio</p>
    <h1>Exams</h1><p className="pilot-lead">Assign workshops and schedule in Asia/Manila. Publishing freezes the exam content.</p>
    <Link href={role === "admin" ? "/admin/teaching" : "/instructor"}>Back to workspace</Link>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {!catalog && !error && <p role="status">Loading instructor catalog…</p>}
    {catalog && <form onSubmit={(event) => void create(event)} className="pilot-card">
      <div className="field"><label htmlFor="exam-title">Exam title</label><input id="exam-title" required minLength={3} maxLength={255}
        value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="field"><label htmlFor="exam-mode">Exam type</label>
        <select id="exam-mode" value={contentMode} onChange={(event) => {
          setContentMode(event.target.value === "restricted" ? "restricted" : "practice");
          setActivityIds([]);
          setPoints({});
        }}>
          <option value="practice">Timed practice · Published activities</option>
          <option value="restricted">Restricted assessment · Exam-only activities</option>
        </select>
        {contentMode === "restricted" && <p>Use exam-only activities from one course. Learners need both a workshop assignment and active enrollment in that course.</p>}
      </div>
      <div className="pilot-dashboard-grid"><div className="field"><label htmlFor="exam-open">Opens · Manila time</label>
        <input id="exam-open" type="datetime-local" required value={open} onChange={(event) => setOpen(event.target.value)} /></div>
        <div className="field"><label htmlFor="exam-close">Closes · Manila time</label>
          <input id="exam-close" type="datetime-local" required value={close} onChange={(event) => setClose(event.target.value)} /></div></div>
      <div className="field"><label htmlFor="exam-duration">Minutes per student</label>
        <input id="exam-duration" type="number" min={1} max={240} required value={duration}
          onChange={(event) => setDuration(Number(event.target.value))} /></div>
      <fieldset className="pilot-question"><legend>Assign workshops</legend>
        {catalog.workshops.length > 0 ? <p>Each exam uses one language track. Clear your workshop selection to switch tracks.</p> :
          <p><Link href="/workshops">Create a workshop</Link> to assign learners to this exam.</p>}
        {catalog.workshops.map((workshop) => <label key={workshop.id}><input type="checkbox"
          checked={eligibleWorkshops.some((item) => item.id === workshop.id)}
          disabled={busy || (!!selectedLanguage && workshop.language !== selectedLanguage)}
          onChange={() => toggleWorkshop(workshop)} /> {workshop.name} · {workshop.language}</label>)}
      </fieldset>
      <fieldset className="pilot-question"><legend>Reviewed activities and points</legend>
        {eligibleActivities.map((activity) => <div key={activity.id} className="row">
          <label><input type="checkbox" checked={activityIds.includes(activity.id)}
            onChange={() => toggle(activity.id, activityIds, setActivityIds)} /> {activity.title} · {activity.kind}</label>
          {activityIds.includes(activity.id) && <label>Points <input type="number" min={1} max={1000}
            value={points[activity.id] || 10} onChange={(event) => setPoints((old) => ({ ...old, [activity.id]: Number(event.target.value) }))} /></label>}
        </div>)}
        {modeActivities.length === 0 || (selectedLanguage && eligibleActivities.length === 0) ? (
          <p><Link href={activitiesHref}>{contentMode === "restricted" ? "Create an exam-only activity" : "Publish an activity"}</Link> for the assigned track.</p>
        ) : !selectedLanguage ? <p>Select a workshop to see its eligible activities.</p> : null}
      </fieldset>
      <button className="button button-primary" type="submit" disabled={busy || eligibleWorkshops.length === 0 || selectedActivityIds.length === 0}>
        {busy ? "Working…" : "Create and publish exam"}</button>
    </form>}
    <section className="pilot-card"><div className="row"><h2>Your exams</h2>
      <button className="button button-outline" disabled={busy} onClick={() => void refreshExams()}>Refresh exams</button>
    </div>
      {exams.map((exam) => <div className="row" key={exam.id}><div><strong>{exam.title}</strong><p>{exam.published ? "Published" : "Draft"} · {exam.results_released ? (exam.has_unreleased_results ? "New results held" : "Results released") : "Results held"}</p></div>
        <div className="pilot-actions">{!exam.published && <button className="button button-outline" disabled={busy} onClick={() => void act(exam.id,"publish")}>Publish</button>}
          {exam.published && (!exam.results_released || exam.has_unreleased_results) && <button className="button button-outline" disabled={busy} onClick={() => void act(exam.id,"release")}>Release results</button>}
          <button className="button button-outline" disabled={busy} onClick={() => void manage(exam.id)}>Results and retakes</button>
        </div></div>)}
      {exams.length === 0 && <p>No exams created yet.</p>}
    </section>
    {detail && <section className="pilot-card"><h2>Results and retakes</h2>
      <p>Review each attempt and grant individual retakes using Asia/Manila time.</p>
      <div className="pilot-dashboard-grid"><label>Opens <input type="datetime-local" value={retakeOpen}
        onChange={(event) => setRetakeOpen(event.target.value)} /></label>
        <label>Closes <input type="datetime-local" value={retakeClose}
          onChange={(event) => setRetakeClose(event.target.value)} /></label></div>
      <label>Minutes per student <input type="number" min={1} max={240} value={retakeDuration}
        onChange={(event) => setRetakeDuration(Number(event.target.value))} /></label>
      {detail.students.map((student) => <div className="row" key={student.id}>
        <div>
          <span>{student.alias} · {student.attempts} {student.attempts === 1 ? "attempt" : "attempts"}</span>
          {student.results?.map((attempt) => (
            <p key={attempt.attempt_number}>
              Attempt {attempt.attempt_number} · {attempt.score !== null && attempt.max_score !== null
                ? `${attempt.score} / ${attempt.max_score} · ${attempt.results_released ? "Released" : "Held"}`
                : attempt.status === "failed" ? "Grading needs retry"
                : attempt.status === "active" ? "In progress"
                : attempt.grading_state === "retry_scheduled" ? "Grading retry scheduled"
                : attempt.grading_state === "queued" ? "Queued for grading" : "Grading"}
              {attempt.xp_awarded !== null && ` · ${attempt.xp_awarded} exam XP`}
              {attempt.status === "failed" && attempt.id && (
                <button className="button button-outline" disabled={busy} onClick={() => void retryGrading(attempt.id)}>
                  Retry grading
                </button>
              )}
            </p>
          ))}
        </div>
        <button className="button button-outline" disabled={busy || !retakeOpen || !retakeClose || student.attempts === 0}
          onClick={() => void grant(student.id)}>Grant retake</button>
      </div>)}
      {detail.students.length === 0 && <p>No students have joined the assigned workshops.</p>}
    </section>}
  </div>;
}
