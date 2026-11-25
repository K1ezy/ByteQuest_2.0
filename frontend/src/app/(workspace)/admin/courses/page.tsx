"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { Button, ConfirmDialog, EmptyState, FieldError, LoadingPanel, Notice, PageHeading, StatusChip, useApi } from "@/components/workspace/ui";
import { createCourse, getCourseImpact, setCourseArchived, updateCourse, type CourseImpact, type CourseSummary } from "@/lib/workspace";

const blank = { code: "", title: "", description: "" };
type Notice = { tone: "success" | "error"; text: string };

function fieldErrorsFrom(caught: unknown): Record<string, string> {
  if (!(caught instanceof ApiError)) return {};
  const detail = (caught.details as { detail?: { field?: string; message?: string } } | undefined)?.detail;
  return detail?.field ? { [detail.field]: detail.message || caught.message } : {};
}

/** Title and description only: the code appears in links and exports, so it never changes. */
function EditCourse({ course, onSaved, onCancel }: { course: CourseSummary; onSaved: (n: Notice) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: course.title, description: course.description || "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.title.trim().length < 3) return setErrors({ title: "Enter a course title of at least 3 characters." });
    setBusy(true);
    try {
      const result = await updateCourse(course.id, { title: form.title.trim(), description: form.description.trim() });
      onSaved({ tone: "success", text: result.message });
    } catch (caught) {
      setErrors(fieldErrorsFrom(caught));
      onSaved({ tone: "error", text: `${getErrorMessage(caught)} Your edits are still here.` });
    } finally {
      setBusy(false);
    }
  }
  const id = `edit-${course.id}`;
  return <form className="ws-form-grid" onSubmit={(event) => void save(event)} noValidate aria-label={`Edit ${course.code}`}>
    <div className="ws-field"><label htmlFor={`${id}-title`}>Course title</label><input id={`${id}-title`} maxLength={255} value={form.title}
      onChange={event => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(errors.title)} /><FieldError>{errors.title}</FieldError></div>
    <div className="ws-field full"><label htmlFor={`${id}-description`}>Description (optional)</label><textarea id={`${id}-description`} maxLength={1000}
      value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
    <div className="ws-inline-actions full"><Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save course"}</Button>
      <Button variant="quiet" onClick={onCancel}>Cancel</Button></div>
  </form>;
}

function Courses() {
  const { refreshCourses } = useWorkspace();
  const { data, error, loading, reload } = useApi<{ courses: CourseSummary[] }>("/admin/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState("");
  const [target, setTarget] = useState<{ course: CourseSummary; archive: boolean; impact?: CourseImpact; error?: string } | null>(null);

  async function changed(next: Notice) {
    setNotice(next);
    if (next.tone === "error") return;
    reload();
    try {
      await refreshCourses();
    } catch {
      setNotice({ tone: "error", text: `${next.text} The course menu could not refresh. Reload this page to see the change there.` });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (form.code.trim().length < 2) found.code = "Enter a course code of at least 2 characters.";
    if (form.title.trim().length < 3) found.title = "Enter a course title of at least 3 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await createCourse({ code: form.code.trim(), title: form.title.trim(), description: form.description.trim() });
      setForm(blank);
      setOpen(false);
      await changed({ tone: "success", text: `${result.message} Assign an instructor or enroll students to get started.` });
    } catch (caught) {
      setErrors(fieldErrorsFrom(caught));
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your entries are still here.` });
    } finally {
      setBusy(false);
    }
  }

  async function askArchive(course: CourseSummary, archive: boolean) {
    setTarget({ course, archive });
    if (!archive) return;
    try {
      setTarget({ course, archive, impact: await getCourseImpact(course.id) });
    } catch (caught) {
      setTarget({ course, archive, error: getErrorMessage(caught) });
    }
  }

  async function confirmArchive() {
    if (!target) return;
    setBusy(true);
    try {
      const result = await setCourseArchived(target.course.id, target.archive);
      setTarget(null);
      await changed({ tone: "success", text: result.message });
    } catch (caught) {
      setTarget({ ...target, error: getErrorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading courses…" />;
  const all = data?.courses ?? [];
  const archivedCount = all.filter(course => course.status === "archived").length;
  const shown = all.filter(course => showArchived || course.status !== "archived");
  return <>
    <PageHeading eyebrow="ADMINISTRATION" title="Course & Instructor Management"
      description="Create, edit and archive courses. Use Course access to enroll students and assign instructors."
      status={data ? <StatusChip state="active" label={`${all.length - archivedCount} active courses`} /> : undefined}
      actions={<Button variant="primary" onClick={() => setOpen(value => !value)}>{open ? "Close form" : "Create course"}</Button>} />
    {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}
    {error ? <Notice tone="error">{error} <Button onClick={reload}>Try again</Button></Notice> : null}
    {open ? <section className="ws-panel" aria-labelledby="create-course-title">
      <div className="ws-panel-head"><div><p className="eyebrow-label">NEW COURSE</p><h2 id="create-course-title">Course details</h2></div></div>
      <form className="ws-form-grid" onSubmit={(event) => void submit(event)} noValidate>
        <div className="ws-field"><label htmlFor="course-code">Course code</label><input id="course-code" maxLength={24} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} aria-invalid={Boolean(errors.code)} aria-describedby="course-code-hint" placeholder="CS101" /><p id="course-code-hint" className="ws-muted">The code can&apos;t be changed later.</p><FieldError>{errors.code}</FieldError></div>
        <div className="ws-field"><label htmlFor="course-title">Course title</label><input id="course-title" maxLength={255} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(errors.title)} placeholder="Introduction to Python" /><FieldError>{errors.title}</FieldError></div>
        <div className="ws-field full"><label htmlFor="course-description">Description (optional)</label><textarea id="course-description" maxLength={1000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
        <div className="ws-inline-actions full"><Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create course"}</Button><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button></div>
      </form>
    </section> : null}
    {data && all.length === 0 ? <EmptyState title="No courses yet" action={<Button variant="primary" onClick={() => setOpen(true)}>Create the first course</Button>}>Create a course to organize instructors, students, materials and activities.</EmptyState> : null}
    {all.length ? <section className="ws-panel" aria-labelledby="course-list-title">
      <div className="ws-panel-head"><div><p className="eyebrow-label">COURSE DIRECTORY</p><h2 id="course-list-title">Courses</h2></div>
        {archivedCount ? <label className="ws-check"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} /> Show archived ({archivedCount})</label> : null}
      </div>
      <ul className="ws-list">{shown.map(course => {
        const archived = course.status === "archived";
        return <li className="ws-row" key={course.id}><div className="ws-row-main">
          <strong>{course.code} · {course.title} {archived ? <StatusChip state="archived" label="Archived" tone="muted" /> : null}</strong>
          {editing === course.id
            ? <EditCourse course={course} onCancel={() => setEditing("")} onSaved={(next) => { if (next.tone === "success") setEditing(""); void changed(next); }} />
            : <><p>{course.description || "No description added"}</p>
              <p>{course.instructor_count || 0} instructors · {course.student_count || 0} students · {course.material_count || 0} materials · {course.activity_count || 0} activities</p></>}
        </div>
        {editing === course.id ? null : <div className="ws-inline-actions">
          {archived ? <Button variant="outline" onClick={() => void askArchive(course, false)}>Restore</Button> : <>
            <Link className="button button-outline small" href={`/admin/assignments?course=${course.id}`}>Course access</Link>
            <Button variant="quiet" onClick={() => setEditing(course.id)}>Edit</Button>
            <Button variant="quiet" onClick={() => void askArchive(course, true)}>Archive</Button>
          </>}
        </div>}
        </li>;
      })}</ul>
    </section> : null}
    <ConfirmDialog open={Boolean(target)} title={target?.archive ? `Archive ${target.course.code}?` : `Restore ${target?.course.code ?? ""}?`}
      confirmLabel={target?.archive ? "Archive course" : "Restore course"} tone={target?.archive ? "danger" : "primary"}
      busy={busy} hideConfirm={Boolean(target?.archive && !target.impact)} onCancel={() => setTarget(null)} onConfirm={() => void confirmArchive()}>
      {target?.error ? <p className="ws-field-error" role="alert">{target.error}</p> : null}
      {target && !target.archive ? <p>{target.course.title} becomes active again, with the same instructors and students. Its activities reopen.</p> : null}
      {target?.archive && !target.impact && !target.error ? <p role="status">Checking what this affects…</p> : null}
      {target?.archive && target.impact ? (<><p>Archiving {target.course.title} affects {target.impact.students} students, {target.impact.instructors} instructors and {target.impact.published_activities} published activities.</p>
          <ul className="ws-plain-list">
            <li>Its activities close everywhere, including workshops that share them.</li>
            <li>Students keep their past attempts, scores, XP and badges.</li>
            <li>Instructors lose the course from their course list. Only administrators can see it.</li>
            <li>Export the gradebook first if instructors need final records. You can restore the course at any time.</li>
          </ul></>) : null}
    </ConfirmDialog>
  </>;
}

export default function AdminCoursesPage() { return <WorkspaceSuspense label="courses"><Courses /></WorkspaceSuspense>; }
