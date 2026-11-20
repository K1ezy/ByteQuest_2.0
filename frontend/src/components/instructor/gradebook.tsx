"use client";

import Link from "next/link";
import { Button, EmptyState, Identity, Notice, personName, StatusChip, useApi } from "@/components/workspace/ui";
import { queryString } from "@/lib/workspace";

interface Cell { attempts: number; best_score: number; passed: boolean; stuck: boolean }

export interface GradebookResponse {
  course: { id: string; code: string; title: string };
  stuck_after_attempts: number;
  activities: { activity_id: string; title: string; activity_type: "quiz" | "challenge"; attempted: number; passed: number }[];
  students: {
    student_id: string; pseudonym: string; username: string; display_name: string | null;
    passed_count: number; stuck_count: number; cells: Record<string, Cell>;
  }[];
}

function quote(value: string | number): string {
  const text = String(value);
  const prefix = typeof value === "string" && ["=", "+", "-", "@", "\t", "\r"].includes(text[0]) ? "'" : "";
  return `"${prefix}${text.replace(/"/g, '""')}"`;
}

/** One row per learner; each activity column holds the best score, blank when not attempted. */
export function gradebookCsv(book: GradebookResponse): string {
  const header = ["Learner", "Username", ...book.activities.map((activity) => activity.title), "Passed", "Activities"];
  const rows = book.students.map((student) => [
    personName(student.display_name, student.pseudonym, student.username),
    student.username,
    ...book.activities.map((activity) => student.cells[activity.activity_id]?.best_score ?? ""),
    student.passed_count,
    book.activities.length,
  ]);
  return [header, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
}

function download(book: GradebookResponse) {
  // The BOM makes Excel read names with accents correctly.
  const url = URL.createObjectURL(new Blob(["﻿" + gradebookCsv(book)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${book.course.code}-gradebook.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type GradebookProps = { courseId: string | null; onOpenStudent: (studentId: string) => void };

export function Gradebook(props: GradebookProps) {
  return <CourseGradebook key={props.courseId} {...props} />;
}

function CourseGradebook({ courseId, onOpenStudent }: GradebookProps) {
  const path = courseId ? `/faculty/gradebook${queryString({ course_id: courseId })}` : null;
  const { data: result, error, loading, reload } = useApi<GradebookResponse>(path, true);
  const data = !loading && !error && result?.course.id === courseId ? result : null;
  const stuck = data?.students.filter((student) => student.stuck_count > 0).length ?? 0;

  return (
    <section id="instructor-gradebook" className="ws-panel" aria-labelledby="gradebook-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">GRADEBOOK</p>
          <h2 id="gradebook-title" className="panel-title">Best score per activity</h2>
        </div>
        <div className="ws-inline-actions">
          {data && stuck > 0 ? <StatusChip state="stuck" tone="bad" label={`${stuck} stuck`} tooltip={`${data.stuck_after_attempts} or more attempts on an activity without passing`} /> : null}
          <Button variant="outline" disabled={!data || data.students.length === 0} onClick={() => data && download(data)}>
            Download CSV
          </Button>
        </div>
      </div>

      {error ? (
        <Notice tone="error">
          The gradebook could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading ? (
        <div className="ws-table-wrap" role="status" aria-label="Loading gradebook">
          <div className="ws-skeleton leaderboard-skeleton-row" aria-hidden="true" />
          {[0, 1, 2].map((row) => <div className="ws-skeleton leaderboard-skeleton-row" key={row} aria-hidden="true" />)}
        </div>
      ) : null}
      {data && (data.students.length === 0 || data.activities.length === 0) ? (
        <EmptyState title={data.students.length === 0 ? "No students enrolled yet" : "No published activities yet"}>
          The gradebook fills in once students attempt published activities in this course.
        </EmptyState>
      ) : null}

      {data && data.students.length > 0 && data.activities.length > 0 ? (
        <div className="ws-table-wrap" role="region" aria-label="Gradebook scores" tabIndex={0}>
          <table className="ws-table gradebook-table">
            <caption className="sr-only">Best score for each learner on each published activity</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                {data.activities.map((activity) => (
                  <th key={activity.activity_id} scope="col">
                    <Link
                      className="ws-inline-link ws-touch-action gradebook-analysis-link"
                      href={`/instructor/activities/${activity.activity_id}/analysis${queryString({ course: data.course.id })}`}
                      aria-label={`Analysis for ${activity.title}`}
                    >
                      {activity.title}
                    </Link>
                    <span className="ws-row-meta">
                      {activity.activity_type === "quiz" ? "Quiz" : "Challenge"} · {activity.passed} of {data.students.length} passed
                    </span>
                  </th>
                ))}
                <th scope="col">Passed</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((student) => (
                <tr key={student.student_id}>
                  <td data-label="Learner">
                    <button type="button" className="ws-inline-link" onClick={() => onOpenStudent(student.student_id)}>
                      <Identity displayName={student.display_name} pseudonym={student.pseudonym} username={student.username} />
                    </button>
                  </td>
                  {data.activities.map((activity) => {
                    const cell = student.cells[activity.activity_id];
                    const tries = cell ? `${cell.attempts} ${cell.attempts === 1 ? "try" : "tries"}` : "";
                    return (
                      <td key={activity.activity_id} data-label={activity.title}>
                        {!cell ? (
                          <span className="ws-muted">Not started</span>
                        ) : (
                          <StatusChip
                            state={cell.passed ? "passed" : cell.stuck ? "stuck" : "trying"}
                            tone={cell.passed ? "good" : cell.stuck ? "bad" : "wait"}
                            label={`${cell.passed ? "Passed" : cell.stuck ? "Stuck" : "Not yet"} · ${cell.best_score}%`}
                          />
                        )}
                        {cell ? <span className="ws-row-meta">{tries}</span> : null}
                      </td>
                    );
                  })}
                  <td data-label="Passed">{student.passed_count} / {data.activities.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="ws-footnote">
        Scores are each learner&apos;s best attempt. “Stuck” means {data?.stuck_after_attempts ?? 3} or more attempts without passing; open the learner to read their code.
      </p>
    </section>
  );
}
