"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

interface ExamCard { id: string; title: string; opens_at: string; closes_at: string; duration_minutes: number; results_released: boolean }
const localTime = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void apiRequest<ExamCard[]>("/exams")
    .then((value) => { if (active) setExams(value); })
    .catch((cause) => { if (active) setError(getErrorMessage(cause)); })
    .finally(() => { if (active) setLoading(false); });
    return () => { active = false; }; }, []);
  return <div className="page-shell pilot-dashboard"><p className="eyebrow-label">Your group assignments</p>
    <h1>Exams</h1><p className="pilot-lead">All times are shown in Asia/Manila. Your instructor releases results after the exam closes.</p>
    {loading && <p role="status">Loading exams…</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {!loading && !error && exams.length === 0 && <section className="pilot-card"><h2>No assigned exams yet</h2><p>Continue your quests while you wait for an instructor assignment.</p><Link href="/dashboard">Dashboard</Link></section>}
    {exams.map((exam) => <section className="pilot-card" key={exam.id}>
      <h2>{exam.title}</h2><p>{localTime(exam.opens_at)} to {localTime(exam.closes_at)} · {exam.duration_minutes} minutes once started</p>
      <Link className="button button-primary" href={`/exams/${exam.id}`}>View exam</Link>
    </section>)}
  </div>;
}
