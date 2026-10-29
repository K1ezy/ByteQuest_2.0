"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { Evaluation } from "@/lib/types";

interface Job {
  id: string;
  activity_id: string;
  status: "queued" | "running" | "completed" | "failed";
  error: string | null;
  result: { attempt_number?: number; xp_awarded?: number; evaluation: Evaluation } | null;
}

export default function SubmissionStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);


  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1500;

    async function refresh() {
      try {
        const result = await apiRequest<Job>(`/submission-jobs/${id}`);
        if (!active) return;
        setJob(result);
        setError("");
        if (result.status === "queued" || result.status === "running") {
          timer = setTimeout(refresh, delay);
          delay = Math.min(8000, Math.round(delay * 1.4));
        }
      } catch (cause) {
        if (!active) return;
        setError(getErrorMessage(cause));
        timer = setTimeout(refresh, 6000);
      }
    }

    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  const finished = job?.status === "completed" && job.result;
  const isFailed = job?.status === "failed";
  const isQueued = job?.status === "queued";
  const isRunning = job?.status === "running";

  return (
    <div className="page-shell pilot-dashboard">
      {!isOnline && (
        <div
          role="status"
          aria-live="assertive"
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900"
        >
          <span>Connection lost — polling will automatically resume when network is restored.</span>
          <span className="font-mono uppercase font-bold text-[10px] tracking-wider bg-amber-200/80 px-2 py-0.5 rounded">
            Offline
          </span>
        </div>
      )}

      <p className="eyebrow-label">Code submission</p>
      <h1>
        {finished
          ? "Grading complete"
          : isFailed
          ? "Grading could not finish"
          : "Grading in progress"}
      </h1>
      <p className="pilot-lead">
        Your submission job is processed durably. You can navigate away and return anytime.
      </p>

      {/* Progressive State Stepper */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px] ${
                isQueued
                  ? "bg-amber-500 animate-pulse"
                  : isRunning || finished || isFailed
                  ? "bg-[#156046]"
                  : "bg-slate-300"
              }`}
            >
              1
            </span>
            <span className={isQueued ? "text-amber-800 font-extrabold" : "text-slate-700"}>
              Queued
            </span>
          </div>

          <div className="hidden sm:block h-0.5 flex-1 bg-slate-200 mx-2" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px] ${
                isRunning
                  ? "bg-amber-500 animate-pulse"
                  : finished
                  ? "bg-[#156046]"
                  : "bg-slate-300"
              }`}
            >
              2
            </span>
            <span className={isRunning ? "text-amber-800 font-extrabold" : "text-slate-700"}>
              Running tests
            </span>
          </div>

          <div className="hidden sm:block h-0.5 flex-1 bg-slate-200 mx-2" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-[11px] ${
                finished
                  ? "bg-emerald-600"
                  : isFailed
                  ? "bg-rose-600"
                  : "bg-slate-300"
              }`}
            >
              3
            </span>
            <span
              className={
                finished
                  ? "text-emerald-800 font-extrabold"
                  : isFailed
                  ? "text-rose-700 font-extrabold"
                  : "text-slate-700"
              }
            >
              {isFailed ? "Retry available" : "Completed"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice error mb-4" role="alert">
          Connection lost: {error}. Checking status again shortly…
        </div>
      )}

      {!job && !error && <p role="status">Loading submission status…</p>}

      {job && (
        <section className="pilot-card" aria-live="polite">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <span className="text-xs font-semibold text-slate-500 font-mono">Job ID: {job.id}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                finished
                  ? "bg-emerald-100 text-emerald-800"
                  : isFailed
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800 animate-pulse"
              }`}
            >
              {isQueued && "Queued"}
              {isRunning && "Running tests"}
              {finished && "Completed"}
              {isFailed && "Failed"}
            </span>
          </div>

          {isQueued && (
            <p>Your work has been safely recorded and is awaiting an available grading worker.</p>
          )}
          {isRunning && (
            <p>Executing your solution against sample and hidden test cases in the Judge0 sandbox…</p>
          )}
          {isFailed && (
            <div className="space-y-2">
              <p className="text-rose-700 font-semibold">
                {job.error || "Grading is temporarily delayed or could not finish."}
              </p>
              <p className="text-xs text-slate-600">
                Your draft code is intact. You can return to the challenge arena and retry your submission.
              </p>
            </div>
          )}

          {finished && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={`text-2xl font-black ${
                    job.result?.evaluation.is_successful ? "text-emerald-700" : "text-amber-800"
                  }`}
                >
                  {job.result?.evaluation.passed_test_cases} / {job.result?.evaluation.total_test_cases} Tests Passed
                </span>
                {job.result?.evaluation.is_successful && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    Challenge Passed!
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-700">
                Attempt {job.result?.attempt_number} ·{" "}
                <span className="font-bold text-[#156046]">+{job.result?.xp_awarded || 0} XP awarded</span>
              </p>
              {!job.result?.evaluation.is_successful && (
                <p className="text-xs text-slate-600">
                  Some tests did not pass. Review visible diagnostics in the arena and refine your code.
                </p>
              )}
            </div>
          )}

          <div className="pilot-actions mt-5 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
            <Link className="button button-primary" href={`/arena/${job.activity_id}`}>
              {isFailed ? "Retry submission in arena" : "Back to challenge arena"}
            </Link>
            <Link className="button button-outline" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

