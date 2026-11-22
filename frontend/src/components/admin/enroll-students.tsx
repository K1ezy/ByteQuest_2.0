"use client";

import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
import { Button, FieldError } from "@/components/workspace/ui";
import { submitEnrollment, type CourseSummary, type EnrollmentItem, type EnrollmentPlan } from "@/lib/workspace";

const GROUPS: { key: keyof EnrollmentPlan; title: string; note?: string }[] = [
  { key: "will_enroll", title: "Will enroll" },
  { key: "already_enrolled", title: "Already enrolled", note: "Skipped." },
  { key: "not_found", title: "Not found", note: "Check for typos, or the student has not signed up yet." },
  { key: "not_eligible", title: "Not a student, or deactivated", note: "Skipped." },
  { key: "invalid", title: "Not a valid School ID", note: "School IDs look like 26-00001." },
];

const describe = (item: EnrollmentItem) =>
  [item.school_id, item.name, item.reason].filter(Boolean).join(" · ");

/** Paste School IDs, see what would happen, then enroll. Nothing changes before the confirm. */
export function EnrollStudents({ courses, initialCourse, onEnrolled, onClose }: {
  courses: CourseSummary[];
  initialCourse: string;
  onEnrolled: (message: string) => void;
  onClose: () => void;
}) {
  const [courseId, setCourseId] = useState(initialCourse);
  const [schoolIds, setSchoolIds] = useState("");
  const [preview, setPreview] = useState<{ plan: EnrollmentPlan; input: string } | null>(null);
  const [busy, setBusy] = useState<"preview" | "enroll" | "">("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const input = courseId + "\n" + schoolIds;
  const stale = preview !== null && preview.input !== input;
  const count = preview?.plan.will_enroll.length ?? 0;

  async function runPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!courseId) found.course = "Choose a course.";
    if (!schoolIds.trim()) found.ids = "Paste at least one School ID.";
    setFieldErrors(found);
    if (Object.keys(found).length) return;
    setBusy("preview");
    setError("");
    try {
      const result = await submitEnrollment(courseId, schoolIds, "preview");
      setPreview({ plan: result.plan, input });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function enroll() {
    setBusy("enroll");
    setError("");
    try {
      const result = await submitEnrollment(courseId, schoolIds, "enroll");
      const skipped = count - (result.enrolled ?? 0);
      onEnrolled((result.message ?? "Students enrolled.") +
        (skipped > 0 ? ` ${skipped} changed since the preview and were skipped.` : ""));
      setSchoolIds("");
      setPreview(null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="ws-panel" aria-labelledby="enroll-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">COURSE ACCESS</p>
          <h2 id="enroll-title">Enroll students</h2>
        </div>
        <button type="button" className="ws-inline-link" onClick={onClose}>Cancel</button>
      </div>
      <form className="ws-form-grid" onSubmit={(event) => void runPreview(event)} noValidate>
        <div className="ws-field">
          <label htmlFor="enroll-course">Course</label>
          <select id="enroll-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}
            aria-invalid={Boolean(fieldErrors.course)}>
            <option value="">Choose a course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <FieldError>{fieldErrors.course}</FieldError>
        </div>
        <div className="ws-field full">
          <label htmlFor="enroll-school-ids">School IDs</label>
          <textarea id="enroll-school-ids" rows={6} value={schoolIds} onChange={(event) => setSchoolIds(event.target.value)}
            aria-invalid={Boolean(fieldErrors.ids)} aria-describedby="enroll-school-ids-hint" placeholder={"26-00001\n26-00002"} />
          <p id="enroll-school-ids-hint" className="ws-muted">Up to 200 IDs, one per line or separated by commas or spaces.</p>
          <FieldError>{fieldErrors.ids}</FieldError>
        </div>
        <div className="ws-inline-actions full">
          <Button variant="outline" type="submit" disabled={busy !== ""}>{busy === "preview" ? "Checking…" : "Preview"}</Button>
        </div>
      </form>
      <FieldError>{error}</FieldError>
      {preview ? (
        <div className="enroll-preview" aria-live="polite">
          {GROUPS.filter(({ key }) => preview.plan[key].length > 0).map(({ key, title, note }) => (
            <details key={key} open={key !== "already_enrolled"}>
              <summary><strong>{title}</strong> · {preview.plan[key].length}{note ? <span className="ws-muted"> · {note}</span> : null}</summary>
              <ul className="ws-plain-list">{preview.plan[key].map((item) => <li key={item.school_id}>{describe(item)}</li>)}</ul>
            </details>
          ))}
          {stale ? <p className="ws-muted">The course or list changed. Preview again before enrolling.</p> : null}
          <div className="ws-inline-actions">
            <Button variant="primary" disabled={busy !== "" || stale || count === 0} onClick={() => void enroll()}>
              {busy === "enroll" ? "Enrolling…" : `Enroll ${count} student${count === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
