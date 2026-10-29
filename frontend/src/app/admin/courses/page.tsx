"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import { Button, EmptyState, FieldError, LoadingPanel, Notice, PageHeading, StatusChip, useApi } from "@/components/workspace/ui";
import { createCourse, type CourseSummary } from "@/lib/workspace";

const blank = { code: "", title: "", description: "" };

function Courses() {
  const { refreshCourses } = useWorkspace();
  const { data, error, loading, reload } = useApi<{ courses: CourseSummary[] }>("/admin/courses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

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
      setNotice({ tone: "success", text: `${result.message} Assign an instructor or enroll students to get started.` });
      setForm(blank);
      setOpen(false);
      reload();
      try {
        await refreshCourses();
      } catch {
        setNotice({ tone: "error", text: "Course created, but the course menu could not refresh. Reload this page to see it there." });
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        const detail = (caught.details as { detail?: { field?: string; message?: string } } | undefined)?.detail;
        if (detail?.field) setErrors({ [detail.field]: detail.message || caught.message });
      }
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your entries are still here.` });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingPanel label="Loading courses…" />;
  return <>
    <PageHeading eyebrow="ADMINISTRATION" title="Courses" description="Create courses, then assign faculty and enroll students. Existing course activity and material counts are shown below." status={data ? <StatusChip state="active" label={`${data.courses.length} courses`} /> : undefined} actions={<Button variant="primary" onClick={() => setOpen(value => !value)}>{open ? "Close form" : "Create course"}</Button>} />
    {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}
    {error ? <Notice tone="error">{error} <Button onClick={reload}>Try again</Button></Notice> : null}
    {open ? <section className="ws-panel" aria-labelledby="create-course-title">
      <div className="ws-panel-head"><div><p className="eyebrow-label">NEW COURSE</p><h2 id="create-course-title">Course details</h2></div></div>
      <form className="ws-form-grid" onSubmit={(event) => void submit(event)} noValidate>
        <div className="ws-field"><label htmlFor="course-code">Course code</label><input id="course-code" maxLength={24} value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} aria-invalid={Boolean(errors.code)} placeholder="CS101" /><FieldError>{errors.code}</FieldError></div>
        <div className="ws-field"><label htmlFor="course-title">Course title</label><input id="course-title" maxLength={255} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(errors.title)} placeholder="Introduction to Python" /><FieldError>{errors.title}</FieldError></div>
        <div className="ws-field full"><label htmlFor="course-description">Description (optional)</label><textarea id="course-description" maxLength={1000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
        <div className="ws-inline-actions full"><Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create course"}</Button><Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button></div>
      </form>
    </section> : null}
    {data?.courses.length === 0 ? <EmptyState title="No courses yet" action={<Button variant="primary" onClick={() => setOpen(true)}>Create the first course</Button>}>Create a course to organize faculty, students, materials and activities.</EmptyState> : null}
    {data?.courses.length ? <section className="ws-panel" aria-labelledby="course-list-title"><div className="ws-panel-head"><div><p className="eyebrow-label">COURSE DIRECTORY</p><h2 id="course-list-title">Available courses</h2></div></div><ul className="ws-list">{data.courses.map(course => <li className="ws-row" key={course.id}><div className="ws-row-main"><strong>{course.code} · {course.title}</strong><p>{course.description || "No description added"}</p><p>{course.instructor_count || 0} faculty · {course.student_count || 0} students · {course.material_count || 0} materials · {course.activity_count || 0} activities</p></div><Link className="button button-outline small" href={`/admin/assignments?course=${course.id}`}>Manage assignments</Link></li>)}</ul></section> : null}
  </>;
}

export default function AdminCoursesPage() { return <WorkspaceSuspense label="courses"><Courses /></WorkspaceSuspense>; }
