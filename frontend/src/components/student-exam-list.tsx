"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/workspace/ui";
import { ActivityDateFilter } from "@/components/activity-date-filter";
import { activityDateMatches, formatActivityDate } from "@/lib/activity-date";

interface ExamCard { id: string; title: string; exam_number: number; added_at: string; opens_at: string; closes_at: string; duration_minutes: number; results_released: boolean; can_start: boolean; can_resume: boolean }
const localTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function StudentExamList() {
  const { data, loading, error, reload } = useApi<ExamCard[]>("/exams", true);
  const exams = data ?? [];
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const visibleExams = exams.filter((exam) => activityDateMatches(exam.added_at, dateRange.from, dateRange.to));
  return <section className="pilot-dashboard" aria-labelledby="assigned-exams-title">
    <h2 id="assigned-exams-title">Assigned exams</h2><p className="pilot-lead">All times are shown in Asia/Manila. Your instructor releases results after the exam closes.</p>
    {loading && <p role="status">Loading exams…</p>}
    {error && <div className="panel">
      <p role="alert" className="notice error">{error}</p>
      <button type="button" className="button button-outline" onClick={reload}>Retry</button>
    </div>}
    {!loading && !error && exams.length === 0 && <section className="pilot-card"><h3>No assigned exams yet</h3><p>Continue your quests while you wait for an instructor assignment.</p></section>}
    {exams.length > 0 && <div className="exam-date-toolbar">
      <ActivityDateFilter from={dateRange.from} to={dateRange.to}
        onChange={(from, to) => setDateRange({ from, to })} />
      <div className="quest-results-summary">
        <p className="quest-result-count" role="status">{visibleExams.length} {visibleExams.length === 1 ? "exam" : "exams"} found</p>
        {(dateRange.from || dateRange.to) && <button type="button" className="text-button"
          onClick={() => setDateRange({ from: "", to: "" })}>Clear date filter</button>}
      </div>
    </div>}
    {exams.length > 0 && visibleExams.length === 0 && <p>No exams match those dates.</p>}
    {visibleExams.map((exam) => <section className="pilot-card" key={exam.id}>
      {exam.exam_number > 0 && <p className="activity-number">Exam #{exam.exam_number}</p>}
      <h3>{exam.title}</h3><p>{localTime(exam.opens_at)} to {localTime(exam.closes_at)} · {exam.duration_minutes} minutes once started</p>
      {exam.added_at && <p className="activity-added-date">Published <time dateTime={exam.added_at}>{formatActivityDate(exam.added_at)}</time></p>}
      <Link className="button button-primary" href={`/exams/${exam.id}`}>
        {exam.can_resume ? "Resume exam" : exam.can_start ? "Open exam" : "View exam"}
      </Link>
    </section>)}
  </section>;
}
