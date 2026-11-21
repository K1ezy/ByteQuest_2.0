"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { CodexRecovery, Evaluation } from "@/lib/types";
import { MAX_STARS, STAR_MEANING, SolveStars } from "@/components/solve-stars";
import { SubmissionComparisonPanel } from "@/components/submission-comparison";

interface Job {
  id: string;
  activity_id: string;
  status: "queued" | "running" | "completed" | "failed";
  dry_run_only: boolean;
  error: string | null;
  created_at: string;
  result: {
    attempt_number?: number;
    xp_awarded?: number;
    new_level?: number;
    level_up?: boolean;
    new_badges_unlocked?: string[];
    badge_xp_awarded?: number;
    quality?: { stars: number; max_stars: number; hints_before: number; self_solved: boolean };
    codex_recoveries?: CodexRecovery[];
    evaluation: Evaluation;
  } | null;
}

// The next tier is only reachable on a future challenge: hints and attempts already used stay on record.
function nextStarTip(stars: number, hintsBefore: number): string | null {
  if (stars >= MAX_STARS) return null;
  return hintsBefore > 0
    ? "On your next challenge, try a sample run before opening a hint to aim for more stars."
    : "On your next challenge, aim to pass within 2 attempts for 3 stars.";
}

export default function SubmissionStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [retryError, setRetryError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1500;

    async function refresh() {
      try {
        const result = await apiRequest<Job>(`/submission-jobs/${id}`);
        if (!active) return;
        setJob(result);
        setWaitedSeconds(Math.floor((Date.now() - Date.parse(result.created_at)) / 1000));
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
  }, [id, pollVersion]);

  async function retryGrading() {
    setRetrying(true);
    setRetryError("");
    try {
      const result = await apiRequest<Job>(`/submission-jobs/${id}/retry`, { method: "POST" });
      setJob(result);
      setPollVersion((version) => version + 1);
    } catch (cause) {
      setRetryError(getErrorMessage(cause));
    } finally {
      setRetrying(false);
    }
  }

  const finished = job?.status === "completed" && job.result;
  const isFailed = job?.status === "failed";
  const isQueued = job?.status === "queued";
  const isRunning = job?.status === "running";
  const isDelayed = (isQueued || isRunning) && waitedSeconds >= 60;
  const passed = Boolean(finished && job?.result?.evaluation.is_successful);
  const lead = finished
    ? passed ? "Your official attempt is recorded and passed." : "Your official attempt is recorded. Refine your code and submit again when ready."
    : isFailed ? "Your submitted code is saved. Retry grading uses that same code."
    : "Your submission is saved. You can leave this page and return to check the result.";
  // One short announcement per state change; the card itself is not a live region.
  const announcement = !job ? "" : finished
    ? `Grading complete: ${job.result?.evaluation.passed_test_cases} of ${job.result?.evaluation.total_test_cases} tests passed.`
    : isFailed ? "Grading could not finish. Retry is available." : isRunning ? "Running tests." : "Waiting to be graded.";

  return (
    <div className="page-shell pilot-dashboard">
      {error && (
        <div
          role="status"
          aria-live="assertive"
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900"
        >
          <span>The local ByteQuest API is unavailable. Polling will retry automatically.</span>
          <span className="font-mono uppercase font-bold text-[10px] tracking-wider bg-amber-200/80 px-2 py-0.5 rounded">
            Retrying
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
      <p className="pilot-lead">{lead}</p>
      <p className="sr-only" role="status">{announcement}</p>

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
        <section className="pilot-card" aria-label="Submission result">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
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
            <p>{job.error ? "Grading was interrupted and will retry automatically." : "Your submission is waiting to be graded."}</p>
          )}
          {/* Grading normally finishes in seconds. Past a minute, say so plainly
              instead of leaving the student watching a spinner with no information. */}
          {isDelayed && (
            <div className="notice warning mt-3" role="status">
              <strong>This is taking longer than usual.</strong> Your submission is saved. If you still
              see this message after a few minutes, tell your instructor.
            </div>
          )}
          {isRunning && !isDelayed && (
            <p>Executing your solution against sample and hidden test cases in the Judge0 sandbox…</p>
          )}
          {isFailed && (
            <div className="space-y-2">
              <p className="text-rose-700 font-semibold">
                {job.error || "Grading is temporarily delayed or could not finish."}
              </p>
              <p className="text-xs text-slate-600">You can retry grading using the code you already submitted.</p>
              {retryError && <p role="alert">{retryError}</p>}
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
              {job.result?.evaluation.is_successful && job.result.quality ? (
                <div className="solve-result" role="status">
                  <div className="solve-result-stars">
                    <SolveStars stars={job.result.quality.stars} />
                    <strong>{STAR_MEANING[job.result.quality.stars]}</strong>
                    <span className={`solve-chip${job.result.quality.self_solved ? " is-self" : ""}`}>
                      {job.result.quality.self_solved
                        ? "Self-solved: no hints used"
                        : `${job.result.quality.hints_before} ${job.result.quality.hints_before === 1 ? "hint" : "hints"} used before passing`}
                    </span>
                  </div>
                  {nextStarTip(job.result.quality.stars, job.result.quality.hints_before)
                    ? <p className="solve-result-tip">{nextStarTip(job.result.quality.stars, job.result.quality.hints_before)}</p>
                    : null}
                  {job.result.level_up && job.result.new_level ? (
                    <p className="reward-news is-level">Level up! You reached Level {job.result.new_level}.</p>
                  ) : null}
                  {job.result.new_badges_unlocked?.length ? (
                    <p className="reward-news is-badge">
                      Badge unlocked: <strong>{job.result.new_badges_unlocked.join(", ")}</strong>
                      {job.result.badge_xp_awarded ? ` (+${job.result.badge_xp_awarded} bonus XP)` : null}
                    </p>
                  ) : null}
                  {job.result.codex_recoveries?.map(({ category, label }) => (
                    <p key={category} className="reward-news is-codex">
                      Codex: you recovered from a {label} error
                    </p>
                  ))}
                </div>
              ) : null}
              {!job.result?.evaluation.is_successful && (
                <p className="text-xs text-slate-600">
                  Some tests did not pass. Review visible diagnostics in the arena and refine your code.
                </p>
              )}
            </div>
          )}

          <div className="pilot-actions mt-5 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
            {isFailed && (
              <button type="button" className="button button-primary" onClick={() => void retryGrading()} disabled={retrying}>
                {retrying ? "Requesting retry…" : "Retry grading"}
              </button>
            )}
            <Link className={isFailed ? "button button-outline" : "button button-primary"} href={`/arena/${job.activity_id}`}>
              Back to challenge arena
            </Link>
            <Link className="button button-outline" href="/dashboard">
              Dashboard
            </Link>
          </div>
          {finished && job.id === id && !job.dry_run_only && <SubmissionComparisonPanel key={job.id} jobId={job.id} />}
          <p className="ws-row-meta submission-reference">Support reference: <code>{job.id}</code></p>

        </section>
      )}
    </div>
  );
}

