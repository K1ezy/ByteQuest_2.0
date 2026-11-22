"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import { resolveAuthenticatedUserId } from "@/lib/supabase";
import { ConfirmDialog } from "@/components/workspace/ui";
import { formatManilaDateTime } from "@/lib/activity-date";
import type { Attempt, ExamItem } from "./exam-model";
import { useExamAnswerSync } from "./use-exam-answer-sync";

type HydrationState = "hydrating" | "ready" | "unauthenticated" | "error";

interface ExamInfo {
  id: string;
  title: string;
  exam_number?: number;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  can_start: boolean;
  latest_attempt_id: string | null;
  latest_status: string | null;
  results_released: boolean;
  server_now?: string;
}

/** A quiz task counts as answered once any question has a choice; code once it has text. */
function hasAnswer(task: ExamItem, value: unknown): boolean {
  if (task.kind === "quiz") return Boolean(value) && Object.keys((value as Record<string, string>) || {}).length > 0;
  return typeof value === "string" && Boolean(value.trim());
}

export default function ExamPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [hydrationState, setHydrationState] =
    useState<HydrationState>("hydrating");
  const [info, setInfo] = useState<ExamInfo | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");
  const [topError, setTopError] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const onSessionLost = useCallback(() => setHydrationState("unauthenticated"), []);
  // Saving, autosave, conflicts, the deadline and submission live in this hook.
  const {
    answers,
    syncState,
    lastConfirmedSaveTime,
    submitErrorBanner,
    isSubmitting: isSubmittingExam,
    conflictData,
    conflictBannerRef,
    deadlineAttemptId,
    remainingSeconds,
    bindUser,
    currentUserId,
    noteServerNow,
    clearTimers,
    adoptServerAttempt,
    changeQuizAnswer: handleQuizAnswerChange,
    changeCodeAnswer: handleCodeAnswerChange,
    resolveKeepLocal: handleResolveKeepLocal,
    resolveKeepServer: handleResolveKeepServer,
    submitExam: handleManualSubmitExam,
  } = useExamAnswerSync({ attempt, ready: hydrationState === "ready", setAttempt, onSessionLost });

  /**
   * 1. Deterministic Barrier Synchronization & Single-Pass Reconciliation
   */
  useEffect(() => {
    let cancelled = false;

    async function hydrateAndReconcileOnce() {
      setHydrationState("hydrating");

      try {
        // Resolve authenticated user ID and exam info in parallel BEFORE touching sessionStorage
        const [resolvedUserId, serverInfo] = await Promise.all([
          resolveAuthenticatedUserId(),
          apiRequest<ExamInfo>(`/exams/${examId}`).catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              return null;
            }
            throw err;
          }),
        ]);

        if (cancelled) return;

        // Missing or expired auth session: keep sessionStorage completely intact
        if (!resolvedUserId || !serverInfo) {
          setHydrationState("unauthenticated");
          return;
        }

        bindUser(resolvedUserId);
        setInfo(serverInfo);
        noteServerNow(serverInfo.server_now);

        // If no attempt has been created yet, show pre-start screen
        if (!serverInfo.latest_attempt_id) {
          setAttempt(null);
          setHydrationState("ready");
          return;
        }

        const serverAttempt = await apiRequest<Attempt>(
          `/exams/attempts/${serverInfo.latest_attempt_id}`
        );

        if (cancelled) return;
        if ((serverAttempt.user_id ?? serverAttempt.student_id ?? resolvedUserId) !== resolvedUserId) {
          bindUser(null);
          setHydrationState("unauthenticated");
          return;
        }

        setAttempt(serverAttempt);
        adoptServerAttempt(serverAttempt, resolvedUserId);
        setHydrationState("ready");
      } catch {
        if (!cancelled) {
          setHydrationState("error");
        }
      }
    }

    const clearSession = () => {
      cancelled = true;
      bindUser(null);
      setAttempt(null);
      setInfo(null);
      setHydrationState("unauthenticated");
    };
    window.addEventListener("bytequest:auth-cleared", clearSession);
    void hydrateAndReconcileOnce();
    return () => {
      cancelled = true;
      clearTimers();
      window.removeEventListener("bytequest:auth-cleared", clearSession);
    };
  }, [adoptServerAttempt, bindUser, clearTimers, examId, noteServerNow]);

  const attemptId = attempt?.id;
  const attemptStatus = attempt?.status;
  const resultsReleased = attempt?.results_released;
  useEffect(() => {
    const userId = currentUserId();
    if (!attemptId || !userId || hydrationState !== "ready" || attemptStatus === "active" || resultsReleased) return;
    const controller = new AbortController();
    let checking = false;

    async function refresh() {
      if (checking || document.visibilityState === "hidden" || currentUserId() !== userId) return;
      checking = true;
      try {
        const latest = await apiRequest<Attempt>(`/exams/attempts/${attemptId}`, { signal: controller.signal });
        if (controller.signal.aborted || currentUserId() !== userId || latest.id !== attemptId || latest.exam_id !== examId ||
            (latest.user_id ?? latest.student_id ?? userId) !== userId || latest.status === "active") return;
        setAttempt(previous => previous?.id === attemptId ? latest : previous);
      } catch {
        // Keep the last known state and retry when the learner returns or grading is pending.
      } finally {
        checking = false;
      }
    }

    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = attemptStatus === "grading" || attemptStatus === "auto_submitted" ? setInterval(refresh, 6000) : undefined;
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [attemptId, attemptStatus, currentUserId, examId, hydrationState, resultsReleased]);

  /**
   * 3. Start / Retake Actions
   */
  async function handleStartExam() {
    setBusy(true);
    setTopError("");
    try {
      const userId = currentUserId();
      if (!userId) return;
      const res = await apiRequest<{ attempt_id: string }>(`/exams/${examId}/start`, {
        method: "POST",
      });
      const freshAttempt = await apiRequest<Attempt>(`/exams/attempts/${res.attempt_id}`);
      if (currentUserId() !== userId || (freshAttempt.user_id ?? freshAttempt.student_id ?? userId) !== userId) return;
      setAttempt(freshAttempt);
      adoptServerAttempt(freshAttempt, userId);
      setHydrationState("ready");
    } catch (cause) {
      setTopError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /**
   * 4. Run Sample Action
   */
  async function handleRunSample(item: ExamItem) {
    if (!attempt) return;
    setBusy(true);
    setTopError("");
    setSampleMessage("");
    try {
      const result = await apiRequest<{
        evaluation: { passed_test_cases: number; total_test_cases: number };
      }>(`/exams/attempts/${attempt.id}/run-sample`, {
        method: "POST",
        body: JSON.stringify({
          item_id: item.id,
          source_code:
            typeof answers[item.id] === "string"
              ? (answers[item.id] as string)
              : item.starter_code || "",
        }),
      });
      setSampleMessage(
        `${result.evaluation.passed_test_cases} of ${result.evaluation.total_test_cases} visible samples passed.`
      );
    } catch (cause) {
      setTopError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  // Explicit Unauthenticated / Expired Session View (Preserves sessionStorage intact)
  if (hydrationState === "unauthenticated") {
    return (
      <section className="page-shell pilot-dashboard" style={{ maxWidth: "560px", marginTop: "40px" }}>
        <div
          role="alert"
          className="pilot-card"
          style={{
            border: "2px solid var(--orange)",
            backgroundColor: "var(--warning-soft)",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--warning-ink)",
              margin: "0 0 6px 0",
            }}
          >
            Session Verification Required
          </p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--ink)", margin: "0 0 10px 0" }}>
            Sign in to resume your exam attempt
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--muted)", margin: "0 0 20px 0" }}>
            Your login session expired or could not be verified. Any unsaved answers in this
            browser tab have been preserved—sign in within this same tab to recover and sync your
            work before the exam timer ends.
          </p>
          <div>
            <Link
              href={`/onboarding?mode=signin&redirect=/exams/${examId}`}
              className="button button-primary"
            >
              Sign in to continue exam →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Hydrating View
  if (hydrationState === "hydrating") {
    return (
      <section className="page-shell pilot-dashboard" style={{ marginTop: "40px" }}>
        <p role="status" style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted)" }}>
          Verifying account session and syncing exam attempt…
        </p>
      </section>
    );
  }

  // Error View
  if (hydrationState === "error") {
    return (
      <section className="page-shell pilot-dashboard" style={{ maxWidth: "560px", marginTop: "40px" }}>
        <div
          role="alert"
          className="pilot-card"
          style={{
            border: "2px solid var(--danger)",
            backgroundColor: "var(--danger-soft)",
            padding: "24px",
          }}
        >
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--danger)", margin: "0 0 8px 0" }}>
            Unable to load exam attempt
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>
            Any unsynced answers in this tab remain untouched. Check your network connection
            and reload this page.
          </p>
        </div>
      </section>
    );
  }

  const currentItem = attempt?.items[activeIndex];
  const isReadOnly =
    hydrationState !== "ready" ||
    attempt?.status !== "active" ||
    syncState === "expired_submitted" ||
    deadlineAttemptId === attempt?.id;

  const mins = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const secs = remainingSeconds !== null ? remainingSeconds % 60 : 0;
  const timeNotice = remainingSeconds === null || remainingSeconds <= 0 ? ""
    : remainingSeconds <= 10 ? "Ten seconds or less remaining."
    : remainingSeconds <= 30 ? "Thirty seconds or less remaining."
    : remainingSeconds <= 120 ? "Two minutes or less remaining." : "";

  return (
    <div className="page-shell pilot-dashboard exam-attempt-page">
      <p className="eyebrow-label">Timed assessment · Asia/Manila</p>
      {info?.exam_number && <p className="activity-number">Exam #{info.exam_number}</p>}
      <h1>{info?.title || attempt?.title || "Exam"}</h1>

      {topError && (
        <p className="notice error" role="alert">
          {topError}
        </p>
      )}

      {/* Pre-start Screen */}
      {info && !attempt && (
        <section className="pilot-card">
          <p>
            One attempt · {info.duration_minutes} minutes · no hints.
          </p>
          <p>
            Closes <time dateTime={info.closes_at}>{formatManilaDateTime(info.closes_at)}</time> (Asia/Manila).
            Your time ends at the duration or at closing, whichever comes first.
          </p>
          <p>
            The timer continues if you disconnect. Your latest saved answers are
            submitted when time expires. Your instructor releases results after the exam closes.
          </p>
          {info.can_start ? (
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={() => void handleStartExam()}
            >
              Start exam
            </button>
          ) : (
            <p>This exam is not currently available to start.</p>
          )}
          <br />
        </section>
      )}

      {/* Active Exam Attempt */}
      {attempt && attempt.status === "active" && (
        <>
          {/* Header Card: Timer + Submit Button + Truthful Status Bar */}
          <div className="pilot-card exam-attempt-header">
            <div
              className="exam-attempt-actions"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong
                  role="timer"
                  className="exam-attempt-timer"
                  aria-label={remainingSeconds === null ? "Remaining exam time"
                    : `Remaining exam time: ${mins} minutes, ${secs} seconds`}
                  style={{
                    display: "inline-block",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 800,
                    backgroundColor:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "var(--danger-soft)"
                        : "var(--emerald-50)",
                    color:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "var(--danger)"
                        : "var(--emerald-700)",
                    border:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "2px solid var(--danger)"
                        : "2px solid var(--emerald-700)",
                  }}
                >
                  Time left: {mins}:{String(secs).padStart(2, "0")}
                </strong>
                <span className="sr-only" role="status" aria-atomic="true">{timeNotice}</span>
              </div>

              <button
                type="button"
                className="button button-primary"
                disabled={isReadOnly || isSubmittingExam}
                onClick={() => setConfirmSubmit(true)}
                data-tooltip="Submit your saved answers for grading and finish this attempt."
              >
                {isSubmittingExam ? "Confirming & submitting…" : "Submit exam"}
              </button>
            </div>

            {/* Truthful Accessible Save Status Bar */}
            <div
              className="exam-save-panel"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderRadius: "12px",
                border:
                  syncState === "saved"
                    ? "1px solid var(--emerald-200)"
                    : syncState === "saving"
                    ? "1px solid var(--line-strong)"
                    : syncState === "unsaved_local"
                    ? "1px solid var(--warning-line)"
                    : syncState === "conflict"
                    ? "2px solid var(--danger)"
                    : "1px solid var(--line-strong)",
                backgroundColor:
                  syncState === "saved"
                    ? "var(--emerald-50)"
                    : syncState === "saving"
                    ? "var(--surface)"
                    : syncState === "unsaved_local"
                    ? "var(--warning-soft)"
                    : syncState === "conflict"
                    ? "var(--danger-soft)"
                    : "var(--paper)",
                fontSize: "0.875rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: 700,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      display: "inline-block",
                      backgroundColor:
                        syncState === "saved"
                          ? "var(--emerald-700)"
                          : syncState === "saving"
                          ? "var(--orange)"
                          : syncState === "unsaved_local"
                          ? "var(--warning-ink)"
                          : syncState === "conflict"
                          ? "var(--danger)"
                          : "var(--muted-soft)",
                    }}
                  />
                  <span role="status" aria-atomic="true">
                    {syncState === "saving" && "Saving"}
                    {syncState === "saved" &&
                      (lastConfirmedSaveTime
                        ? `Saved to your account at ${lastConfirmedSaveTime}`
                        : "Saved to your account")}
                    {syncState === "unsaved_local" && "Unsaved on this device"}
                    {syncState === "conflict" && "Resolve answer conflict"}
                    {syncState === "expired_submitted" && "Time ended; finalizing saved answers"}
                  </span>
                </div>

                {syncState !== "saved" && <div className="exam-last-save">
                  Last confirmed save:{" "}
                  <strong
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--ink)",
                    }}
                  >
                    {lastConfirmedSaveTime || "None yet"}
                  </strong>
                </div>}
              </div>

              {syncState === "unsaved_local" && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.8125rem",
                    color: "var(--warning-ink)",
                    lineHeight: 1.4,
                  }}
                >
                  Unsaved changes can recover in this browser tab, but only confirmed
                  saves are stored in your account across devices or after closing this
                  session.
                </p>
              )}
            </div>

            {submitErrorBanner && (
              <div
                role="alert"
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid var(--danger)",
                  backgroundColor: "var(--danger-soft)",
                  color: "var(--danger)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {submitErrorBanner}
              </div>
            )}
          </div>

          {/* Conflict Resolution Banner */}
          {syncState === "conflict" && conflictData && currentItem && (
            <section
              ref={conflictBannerRef}
              tabIndex={-1}
              aria-labelledby="conflict-heading"
              className="pilot-card"
              style={{
                border: "2px solid var(--danger)",
                backgroundColor: "var(--danger-soft)",
                outline: "none",
              }}
            >
              <h2
                id="conflict-heading"
                style={{ color: "var(--danger)", margin: "0 0 8px 0" }}
              >
                Resolve answer conflict
              </h2>
              <p style={{ margin: "0 0 16px 0", color: "var(--muted)", fontSize: "0.875rem" }}>
                Another tab saved revision #{conflictData.serverRevision}
                {conflictData.serverSavedAt
                  ? ` at ${conflictData.serverSavedAt}`
                  : ""}{" "}
                while this tab had unsaved edits. Both versions are preserved below.
                Choose which answers to keep for your exam.
              </p>

              <div
                className="exam-conflict-copies"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: "16px",
                }}
              >
                {/* Local Copy */}
                <div
                  style={{
                    border: "1px solid var(--warning-line)",
                    borderRadius: "10px",
                    padding: "14px",
                    backgroundColor: "var(--warning-soft)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <strong style={{ color: "var(--warning-ink)", fontSize: "0.875rem" }}>
                      This device’s unsaved answers
                    </strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        backgroundColor: "var(--warning-soft)",
                        color: "var(--warning-ink)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      Unsaved on device
                    </span>
                  </div>

                  <pre
                    style={{
                      maxHeight: "180px",
                      overflow: "auto",
                      background: "var(--ink)",
                      color: "var(--emerald-100)",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {typeof conflictData.localUnsavedAnswers[currentItem.id] ===
                    "string"
                      ? (conflictData.localUnsavedAnswers[currentItem.id] as string) ||
                        "# (Empty code)"
                      : JSON.stringify(
                          conflictData.localUnsavedAnswers[currentItem.id] || {},
                          null,
                          2
                        )}
                  </pre>

                  <button
                    type="button"
                    className="button button-primary"
                    style={{
                      marginTop: "12px",
                      width: "100%",
                    }}
                    onClick={() => void handleResolveKeepLocal()}
                  >
                    Use this device’s unsaved answers
                  </button>
                </div>

                {/* Server Copy */}
                <div
                  style={{
                    border: "1px solid var(--line-strong)",
                    borderRadius: "10px",
                    padding: "14px",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <strong style={{ color: "var(--ink)", fontSize: "0.875rem" }}>
                      Account’s saved answers (Rev #{conflictData.serverRevision})
                    </strong>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        backgroundColor: "var(--emerald-100)",
                        color: "var(--emerald-700)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      On server
                    </span>
                  </div>

                  <pre
                    style={{
                      maxHeight: "180px",
                      overflow: "auto",
                      background: "var(--ink)",
                      color: "var(--slate-200)",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {typeof conflictData.serverAnswers[currentItem.id] === "string"
                      ? (conflictData.serverAnswers[currentItem.id] as string) ||
                        "# (Empty code)"
                      : JSON.stringify(
                          conflictData.serverAnswers[currentItem.id] || {},
                          null,
                          2
                        )}
                  </pre>

                  <button
                    type="button"
                    className="button button-outline"
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      backgroundColor: "#fff",
                      borderColor: "var(--line-strong)",
                      color: "var(--ink)",
                    }}
                    onClick={handleResolveKeepServer}
                  >
                    Keep account’s saved answers
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Main Grid: Current Task + Task List Sidebar */}
          <div className="pilot-dashboard-grid">
            <div>
              {currentItem && (
                <section className="pilot-card" aria-labelledby="exam-item-title">
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 6px" }}>
                    Task {activeIndex + 1} of {attempt.items.length} ·{" "}
                    {currentItem.points} points
                  </p>
                  <h2 id="exam-item-title">{currentItem.title}</h2>
                  <p style={{ lineHeight: 1.6, color: "var(--ink)" }}>
                    {currentItem.problem_statement}
                  </p>

                  {/* Quiz Item */}
                  {currentItem.kind === "quiz" &&
                    currentItem.questions?.map((q) => (
                      <fieldset key={q.id} className="pilot-question">
                        <legend style={{ fontWeight: 700, marginBottom: "8px" }}>
                          {q.prompt}
                        </legend>
                        {q.options.map((option) => (
                          <label
                            key={option.key}
                            style={{
                              display: "block",
                              margin: "8px 0",
                              cursor: isReadOnly ? "not-allowed" : "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={option.key}
                              disabled={isReadOnly}
                              checked={
                                (
                                  answers[currentItem.id] as
                                    | Record<string, string>
                                    | undefined
                                )?.[q.id] === option.key
                              }
                              onChange={() =>
                                handleQuizAnswerChange(
                                  currentItem.id,
                                  q.id,
                                  option.key
                                )
                              }
                              style={{ marginRight: "8px" }}
                            />
                            {option.key}. {option.text}
                          </label>
                        ))}
                      </fieldset>
                    ))}

                  {/* Challenge Item */}
                  {currentItem.kind === "challenge" && (
                    <>
                      <label
                        htmlFor="exam-code"
                        style={{
                          display: "block",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          marginBottom: "6px",
                        }}
                      >
                        Your code
                      </label>
                      <textarea
                        id="exam-code"
                        className="pilot-code"
                        disabled={isReadOnly}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        value={
                          typeof answers[currentItem.id] === "string"
                            ? (answers[currentItem.id] as string)
                            : currentItem.starter_code || ""
                        }
                        onChange={(e) =>
                          handleCodeAnswerChange(currentItem.id, e.target.value)
                        }
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          lineHeight: 1.5,
                        }}
                      />

                      {currentItem.pass_mark_percent != null && <p className="panel-subtitle">
                        {currentItem.pass_mark_percent === 100
                          ? "Pass every test to meet this task’s pass mark."
                          : `Score at least ${currentItem.pass_mark_percent}% to meet this task’s pass mark.`}
                        {" "}Your exam score includes partial credit. Sample runs only check the visible cases.
                      </p>}
                      <h3 style={{ fontSize: "1rem", marginTop: "16px" }}>
                        Visible samples
                      </h3>
                      {currentItem.samples?.map((s, idx) => (
                        <p
                          key={idx}
                          style={{
                            background: "var(--paper)",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <code>Input: {s.stdin || "(none)"}</code>
                          <br />
                          <code>Expected: {s.expected_stdout}</code>
                        </p>
                      ))}

                      <div style={{ marginTop: "12px" }}>
                        <button
                          type="button"
                          className="button button-outline"
                          disabled={busy || isReadOnly}
                          onClick={() => void handleRunSample(currentItem)}
                        >
                          Run visible samples
                        </button>
                      </div>

                      {sampleMessage && (
                        <p
                          role="status"
                          style={{
                            marginTop: "8px",
                            fontWeight: 600,
                            color: "var(--emerald-700)",
                          }}
                        >
                          {sampleMessage}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}

              <div className="pilot-actions">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((n) => n - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={activeIndex >= attempt.items.length - 1}
                  onClick={() => setActiveIndex((n) => n + 1)}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Sidebar: Tasks Stepper & Submit */}
            <aside className="pilot-card">
              <h2>Tasks</h2>
              <div role="group" aria-label="Exam tasks">
                {attempt.items.map((task, index) => {
                  const isAnswered = hasAnswer(task, answers[task.id]);
                  return (
                    <button
                      type="button"
                      aria-current={index === activeIndex ? "step" : undefined}
                      className="pilot-task"
                      key={task.id}
                      onClick={() => setActiveIndex(index)}
                      style={{
                        borderColor:
                          index === activeIndex ? "var(--emerald-700)" : undefined,
                      }}
                    >
                      {index + 1}. {task.title} ·{" "}
                      {isAnswered ? "Answered" : "Not answered"}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={isReadOnly || isSubmittingExam}
                  onClick={() => setConfirmSubmit(true)}
                  style={{
                    width: "100%",
                  }}
                  data-tooltip="Submit your saved answers for grading and finish this attempt."
                >
                  {isSubmittingExam ? "Submitting…" : "Submit exam"}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Finished / Non-Active Attempt Screen */}
      {attempt && attempt.status !== "active" && (
        <section className="pilot-card">
          <h2>
            {attempt.status === "submitted"
              ? "Exam submitted"
              : attempt.status === "grading"
              ? "Grading in progress"
              : attempt.status === "failed" ? "Grading needs attention" : "Time expired"}
          </h2>

          {/* "Time ended" only when it did: the server auto-submitted, or the deadline fired in this tab.
              An attempt the learner submitted and later reopens shows no deadline banner. */}
          {syncState === "expired_submitted" && (attempt.status === "auto_submitted" || deadlineAttemptId === attempt.id) && (
            <div
              role="alert"
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "var(--paper)",
                border: "1px solid var(--line-strong)",
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {attempt.status === "auto_submitted"
                ? "Time ended. Grading will use the latest answers saved to your account."
                : "Time ended; latest server-saved answers submitted"}
            </div>
          )}

          {!attempt.results_released && (
            <p>
              {attempt.status === "failed"
                ? "Your answers are saved. Your instructor can retry grading."
                : "Your instructor will release scores after the exam closes."}
            </p>
          )}

          {attempt.results_released && attempt.result && (
            <>
              <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                Score: {attempt.result.score} / {attempt.result.max_score}
              </p>
              {attempt.result.items.map((res) => (
                <div
                  key={res.item_id}
                  style={{
                    marginBottom: "16px",
                    padding: "12px",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                  }}
                >
                  <strong>
                    {attempt.items.find((item) => item.id === res.item_id)?.title ?? "Exam item"}
                  </strong>
                  <p>{res.points_earned} / {res.points_possible} points</p>
                </div>
              ))}
            </>
          )}

          {/* Exam info loaded before this attempt started still says "can start"; only info that
              already knows this attempt can describe a granted retake. */}
          {info?.can_start && info.latest_attempt_id === attempt.id && (
            <div style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => void handleStartExam()}
              >
                Start granted retake
              </button>
            </div>
          )}

          <div className="pilot-actions" style={{ marginTop: "16px" }}>
            <Link className="button button-outline" href="/exams">All exams</Link>
            <Link className="button button-quiet" href="/dashboard">Dashboard</Link>
          </div>
        </section>
      )}

      {/* Submitting is final, so a tap on a phone first shows what is still unanswered. */}
      {attempt && attempt.status === "active" ? (() => {
        const unanswered = attempt.items.filter((task) => !hasAnswer(task, answers[task.id])).length;
        return <ConfirmDialog
          open={confirmSubmit}
          title="Submit exam?"
          confirmLabel="Submit exam"
          busy={isSubmittingExam}
          onConfirm={() => { setConfirmSubmit(false); void handleManualSubmitExam(); }}
          onCancel={() => setConfirmSubmit(false)}
        >
          <p>{unanswered === 0
            ? `All ${attempt.items.length} tasks have an answer.`
            : `${unanswered} of ${attempt.items.length} ${attempt.items.length === 1 ? "task has" : "tasks have"} no answer yet.`}{" "}
            ByteQuest saves your latest answers first. After you submit, you can’t change them.</p>
        </ConfirmDialog>;
      })() : null}
    </div>
  );
}
