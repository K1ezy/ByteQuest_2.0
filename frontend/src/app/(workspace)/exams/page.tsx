"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { ActivityDateFilter } from "@/components/activity-date-filter";
import { activityDateMatches, formatActivityDate } from "@/lib/activity-date";

interface ExamCard { id: string; title: string; exam_number: number; added_at: string; opens_at: string; closes_at: string; duration_minutes: number; results_released: boolean }
const localTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  useEffect(() => { let active = true; void apiRequest<ExamCard[]>("/exams")
    .then((value) => { if (active) setExams(value); })
    .catch((cause) => { if (active) setError(getErrorMessage(cause)); })
    .finally(() => { if (active) setLoading(false); });
    return () => { active = false; }; }, []);
  const visibleExams = exams.filter((exam) => activityDateMatches(exam.added_at, dateRange.from, dateRange.to));
  return <div className="page-shell pilot-dashboard"><p className="eyebrow-label">Your group assignments</p>
    <h1>Exams</h1><p className="pilot-lead">All times are shown in Asia/Manila. Your instructor releases results after the exam closes.</p>
    {loading && <p role="status">Loading exams…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {!loading && !error && exams.length === 0 && <section className="pilot-card"><h2>No assigned exams yet</h2><p>Continue your quests while you wait for an instructor assignment.</p><Link className="button button-outline" href="/quests">Open Quest Map</Link></section>}
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
      <h2>{exam.title}</h2><p>{localTime(exam.opens_at)} to {localTime(exam.closes_at)} · {exam.duration_minutes} minutes once started</p>
      {exam.added_at && <p className="activity-added-date">Published <time dateTime={exam.added_at}>{formatActivityDate(exam.added_at)}</time></p>}
      <Link className="button button-primary" href={`/exams/${exam.id}`}>View exam</Link>
    </section>)}
  </div>;
}
