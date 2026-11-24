"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/components/workspace/ui";
import { ActivityDateFilter } from "@/components/activity-date-filter";
import { ActivityPerformancePreview } from "@/components/activity-performance-preview";
import { activityDateMatches, formatActivityDate } from "@/lib/activity-date";

interface ExamCard { id: string; title: string; exam_number: number; added_at: string; opens_at: string; closes_at: string; duration_minutes: number; pass_mark_percent?: number | null; results_released: boolean; can_start: boolean; can_resume: boolean }
const localTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function StudentExamList() {
  const { data, loading, error, reload } = useApi<ExamCard[]>("/exams", true);
  const exams = data ?? [];
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const visibleExams = exams.filter((exam) => activityDateMatches(exam.added_at, dateRange.from, dateRange.to));
  if (selectedExamId && !visibleExams.some((exam) => exam.id === selectedExamId)) setSelectedExamId(null);
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
    <div className="activity-preview-list">{visibleExams.map((exam) => <section className={`pilot-card exam-preview-card${selectedExamId === exam.id ? " is-selected-card" : ""}`}
      key={exam.id} onClick={(event) => {
        if (!(event.target as Element).closest("a, button, .activity-performance-preview")) setSelectedExamId(exam.id);
      }}>
      {exam.exam_number > 0 && <p className="activity-number">#{exam.exam_number}</p>}
      <h3>{exam.title}</h3><p>{localTime(exam.opens_at)} to {localTime(exam.closes_at)} · {exam.duration_minutes} minutes once started</p>
      {exam.pass_mark_percent != null && <p>Pass mark {exam.pass_mark_percent}%</p>}
      {exam.added_at && <p className="activity-added-date">Published <time dateTime={exam.added_at}>{formatActivityDate(exam.added_at)}</time></p>}
      <div className="pilot-actions">
        <button type="button" className="text-button" id={`preview-trigger-${exam.id}`}
          aria-label={`Performance preview for ${exam.title}`} aria-expanded={selectedExamId === exam.id}
          aria-controls={selectedExamId === exam.id ? `activity-preview-${exam.id}` : undefined}
          onClick={() => setSelectedExamId(exam.id)}>Preview</button>
        <Link className="button button-primary" href={`/exams/${exam.id}`}>
          {exam.can_resume ? "Resume exam" : exam.can_start ? "Open exam" : "View exam"}
        </Link>
      </div>
      {selectedExamId === exam.id && <ActivityPerformancePreview kind="exam" activityId={exam.id} title={exam.title}
        onClose={() => setSelectedExamId(null)} />}
    </section>)}</div>
  </section>;
}
