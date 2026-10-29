"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

interface Catalog { groups: { id: string; name: string; language: string }[];
  activities: { id: string; title: string; kind: string; language: string }[] }
interface Exam { id: string; title: string; opens_at: string; closes_at: string; published: boolean; results_released: boolean }
interface ExamDetail { id: string; groups: { id: string; name: string }[];
  students: { id: string; alias: string; attempts: number }[] }

function manilaIso(local: string): string { return new Date(`${local}:00+08:00`).toISOString(); }

export default function InstructorExamsPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [duration, setDuration] = useState(45);
  const [groupIds, setGroupIds] = useState<string[]>([]);
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
  const selectedLanguage = catalog?.groups.find((group) => group.id === groupIds[0])?.language;
  function toggle(id: string, selected: string[], setter: (value: string[]) => void) {
    setter(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const created = await apiRequest<{ id: string }>("/exams/instructor", { method: "POST",
        body: JSON.stringify({ title, opens_at: manilaIso(open), closes_at: manilaIso(close),
          duration_minutes: duration, group_ids: groupIds,
          items: activityIds.map((activity_id) => ({ activity_id, points: points[activity_id] || 10 })) }) });
      await apiRequest(`/exams/instructor/${created.id}/publish`, { method: "POST" });
      setMessage("Exam published with a frozen copy of the reviewed activities.");
      setTitle(""); setGroupIds([]); setActivityIds([]);
      await load();
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function act(examId: string, action: "publish" | "release") {
    setBusy(true); setError(""); setMessage("");
    try { await apiRequest(`/exams/instructor/${examId}/${action}`, { method: "POST" });
      setMessage(action === "publish" ? "Exam published." : "Results released to students."); await load();
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function manage(examId: string) {
    setError("");
    try { setDetail(await apiRequest<ExamDetail>(`/exams/instructor/${examId}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
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
    <h1>Build an exam</h1><p className="pilot-lead">Select published activities you own, assign your groups, and schedule in Asia/Manila. Publishing freezes the content.</p>
    <Link href="/instructor">Back to content studio</Link>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {!catalog && !error && <p role="status">Loading instructor catalog…</p>}
    {catalog && <form onSubmit={(event) => void create(event)} className="pilot-card">
      <div className="field"><label htmlFor="exam-title">Exam title</label><input id="exam-title" required minLength={3} maxLength={255}
        value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="pilot-dashboard-grid"><div className="field"><label htmlFor="exam-open">Opens · Manila time</label>
        <input id="exam-open" type="datetime-local" required value={open} onChange={(event) => setOpen(event.target.value)} /></div>
        <div className="field"><label htmlFor="exam-close">Closes · Manila time</label>
          <input id="exam-close" type="datetime-local" required value={close} onChange={(event) => setClose(event.target.value)} /></div></div>
      <div className="field"><label htmlFor="exam-duration">Minutes per student</label>
        <input id="exam-duration" type="number" min={1} max={240} required value={duration}
          onChange={(event) => setDuration(Number(event.target.value))} /></div>
      <fieldset className="pilot-question"><legend>Assign groups</legend>
        {catalog.groups.map((group) => <label key={group.id}><input type="checkbox" checked={groupIds.includes(group.id)}
          onChange={() => toggle(group.id, groupIds, setGroupIds)} /> {group.name} · {group.language}</label>)}
        {catalog.groups.length === 0 && <p>Create an instructor quest group first.</p>}
      </fieldset>
      <fieldset className="pilot-question"><legend>Reviewed activities and points</legend>
        {catalog.activities.filter((activity) => !selectedLanguage || activity.language === selectedLanguage).map((activity) => <div key={activity.id} className="row">
          <label><input type="checkbox" checked={activityIds.includes(activity.id)}
            onChange={() => toggle(activity.id, activityIds, setActivityIds)} /> {activity.title} · {activity.kind}</label>
          {activityIds.includes(activity.id) && <label>Points <input type="number" min={1} max={1000}
            value={points[activity.id] || 10} onChange={(event) => setPoints((old) => ({ ...old, [activity.id]: Number(event.target.value) }))} /></label>}
        </div>)}
        {catalog.activities.length === 0 && <p>Publish a reviewed activity in the content studio first.</p>}
      </fieldset>
      <button className="button button-primary" type="submit" disabled={busy || groupIds.length === 0 || activityIds.length === 0}>
        {busy ? "Working…" : "Create and publish exam"}</button>
    </form>}
    <section className="pilot-card"><h2>Your exams</h2>
      {exams.map((exam) => <div className="row" key={exam.id}><div><strong>{exam.title}</strong><p>{exam.published ? "Published" : "Draft"} · {exam.results_released ? "Results released" : "Results held"}</p></div>
        <div className="pilot-actions">{!exam.published && <button className="button button-outline" disabled={busy} onClick={() => void act(exam.id,"publish")}>Publish</button>}
          {exam.published && !exam.results_released && <button className="button button-outline" disabled={busy} onClick={() => void act(exam.id,"release")}>Release results</button>}
          <button className="button button-outline" disabled={busy} onClick={() => void manage(exam.id)}>Manage retakes</button>
        </div></div>)}
      {exams.length === 0 && <p>No exams created yet.</p>}
    </section>
    {detail && <section className="pilot-card"><h2>Retakes and assigned students</h2>
      <p>Set a new window in Asia/Manila, then grant a retake to one student. Earlier attempts remain in the audit trail.</p>
      <div className="pilot-dashboard-grid"><label>Opens <input type="datetime-local" value={retakeOpen}
        onChange={(event) => setRetakeOpen(event.target.value)} /></label>
        <label>Closes <input type="datetime-local" value={retakeClose}
          onChange={(event) => setRetakeClose(event.target.value)} /></label></div>
      <label>Minutes per student <input type="number" min={1} max={240} value={retakeDuration}
        onChange={(event) => setRetakeDuration(Number(event.target.value))} /></label>
      {detail.students.map((student) => <div className="row" key={student.id}>
        <span>{student.alias} · {student.attempts} attempt(s)</span>
        <button className="button button-outline" disabled={busy || !retakeOpen || !retakeClose || student.attempts === 0}
          onClick={() => void grant(student.id)}>Grant retake</button>
      </div>)}
      {detail.students.length === 0 && <p>No students have joined the assigned groups.</p>}
    </section>}
  </div>;
}
