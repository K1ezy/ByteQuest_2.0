"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import {
  resolveAuthenticatedUserId,
  areExamAnswersCanonicallyEqual,
  writeUnsyncedExamSnapshot,
  readUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshotIfMatched,
} from "@/lib/supabase";

export type ExamSyncBannerState =
  | "saving"
  | "saved"
  | "unsaved_local"
  | "conflict"
  | "expired_submitted";

type HydrationState = "hydrating" | "ready" | "unauthenticated" | "error";

interface ExamInfo {
  id: string;
  title: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  can_start: boolean;
  latest_attempt_id: string | null;
  latest_status: string | null;
  results_released: boolean;
  server_now?: string;
}

interface QuizQuestion {
  id: string;
  prompt: string;
  options: { key: string; text: string }[];
}

interface ExamItem {
  id: string;
  position: number;
  points: number;
  kind: "quiz" | "challenge";
  title: string;
  problem_statement: string;
  questions?: QuizQuestion[];
  starter_code?: string;
  samples?: { stdin: string; expected_stdout: string }[];
}

interface AttemptResultItem {
  item_id: string;
  points_earned: number;
  points_possible: number;
  solution: string | Record<string, string>;
}

interface AttemptResult {
  score: number;
  max_score: number;
  items: AttemptResultItem[];
}

interface Attempt {
  id: string;
  user_id?: string;
  student_id?: string;
  exam_id: string;
  title: string;
  status: string;
  due_at: string;
  revision: number;
  last_saved_at: string | null;
  server_now?: string;
  answers: Record<string, string | Record<string, string>>;
  items: ExamItem[];
  results_released: boolean;
  result: AttemptResult | null;
  score: number | null;
}

interface SaveAnswersResponse {
  attempt_id?: string;
  revision: number;
  last_saved_at?: string;
  saved_at?: string;
  server_now?: string;
  status?: string;
}

function formatClockTime(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ExamPage() {
  const { id: examId } = useParams<{ id: string }>();

  const [hydrationState, setHydrationState] =
    useState<HydrationState>("hydrating");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [info, setInfo] = useState<ExamInfo | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | Record<string, string>>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [syncState, setSyncState] = useState<ExamSyncBannerState>("saved");
  const [lastConfirmedSaveTime, setLastConfirmedSaveTime] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sampleMessage, setSampleMessage] = useState("");
  const [topError, setTopError] = useState("");
  const [submitErrorBanner, setSubmitErrorBanner] = useState<string | null>(null);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);

  const [conflictData, setConflictData] = useState<{
    serverRevision: number;
    serverSavedAt: string | null;
    serverAnswers: Record<string, string | Record<string, string>>;
    localUnsavedAnswers: Record<string, string | Record<string, string>>;
  } | null>(null);

  // Deterministic refs for single-pass hydration & single-flight save queue
  const authUserIdRef = useRef<string | null>(null);
  const reconciledAttemptKeyRef = useRef<string | null>(null);
  const serverRevisionRef = useRef<number>(0);
  const clientEditSeqRef = useRef<number>(0);
  const lastConfirmedEditSeqRef = useRef<number>(0);
  const latestAnswersRef = useRef<Record<string, string | Record<string, string>>>({});
  const inFlightSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const retryCountRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverOffsetRef = useRef<number>(0);
  const conflictBannerRef = useRef<HTMLElement | null>(null);
  const flushSaveQueueRef = useRef<
    ((currentAttempt: Attempt, overrideBaseRevision?: number) => Promise<boolean>) | null
  >(null);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  /**
   * Transitions ONLY this attempt into the authoritative expired/completed state.
   * Blast-radius isolation: NEVER purges snapshots for other exam attempts.
   */
  const enterAuthoritativeExpiredState = useCallback(
    async (currentAttempt: Attempt, currentUserId: string) => {
      clearTimers();
      clearUnsyncedExamSnapshot(currentUserId, currentAttempt.id);
      setConflictData(null);
      setSyncState("expired_submitted");
      try {
        const finalAttempt = await apiRequest<Attempt>(`/exams/attempts/${currentAttempt.id}`);
        setAttempt(finalAttempt);
        setAnswers(finalAttempt.answers);
        latestAnswersRef.current = finalAttempt.answers;
        serverRevisionRef.current = finalAttempt.revision;
        if (finalAttempt.last_saved_at) {
          setLastConfirmedSaveTime(formatClockTime(finalAttempt.last_saved_at));
        }
      } catch {
        setAttempt((prev) => (prev ? { ...prev, status: "auto_submitted" } : currentAttempt));
      }
    },
    [clearTimers]
  );

  /**
   * Enters the 409 Conflict flow while preserving both server and local copies.
   */
  const enterConflictResolutionFlow = useCallback(
    async (
      currentAttempt: Attempt,
      currentUserId: string,
      localDraftAnswers: Record<string, string | Record<string, string>>
    ) => {
      clearTimers();
      try {
        const freshServer = await apiRequest<Attempt>(`/exams/attempts/${currentAttempt.id}`);
        serverRevisionRef.current = freshServer.revision;
        if (freshServer.last_saved_at) {
          setLastConfirmedSaveTime(formatClockTime(freshServer.last_saved_at));
        }

        if (freshServer.status !== "active") {
          await enterAuthoritativeExpiredState(freshServer, currentUserId);
          return;
        }

        if (areExamAnswersCanonicallyEqual(freshServer.answers, localDraftAnswers)) {
          clearUnsyncedExamSnapshotIfMatched(
            currentUserId,
            freshServer.id,
            clientEditSeqRef.current,
            freshServer.answers,
            freshServer.revision
          );
          setConflictData(null);
          setSyncState("saved");
          return;
        }

        setSyncState("conflict");
        setConflictData({
          serverRevision: freshServer.revision,
          serverSavedAt: formatClockTime(freshServer.last_saved_at),
          serverAnswers: freshServer.answers,
          localUnsavedAnswers: { ...localDraftAnswers },
        });
        setTimeout(() => conflictBannerRef.current?.focus(), 50);
      } catch {
        setSyncState("unsaved_local");
      }
    },
    [clearTimers, enterAuthoritativeExpiredState]
  );

  /**
   * Single-Flight Save Queue & Bounded Retry Engine
   */
  const flushSaveQueue = useCallback(
    async (
      currentAttempt: Attempt,
      overrideBaseRevision?: number
    ): Promise<boolean> => {
      const currentUserId = authUserIdRef.current;
      if (!currentUserId || currentAttempt.status !== "active") {
        return false;
      }

      if (inFlightSavePromiseRef.current) {
        return inFlightSavePromiseRef.current;
      }

      const executeSingleFlight = async (): Promise<boolean> => {
        let currentExpectedRevision = overrideBaseRevision ?? serverRevisionRef.current;

        try {
          while (true) {
            const snapshotSeq = clientEditSeqRef.current;
            const snapshotAnswers = { ...latestAnswersRef.current };

            setSyncState("saving");

            const response = await apiRequest<SaveAnswersResponse>(
              `/exams/attempts/${currentAttempt.id}/answers`,
              {
                method: "PUT",
                body: JSON.stringify({
                  expected_revision: currentExpectedRevision,
                  answers: snapshotAnswers,
                }),
              }
            );

            retryCountRef.current = 0;
            serverRevisionRef.current = response.revision;
            currentExpectedRevision = response.revision;
            lastConfirmedEditSeqRef.current = Math.max(
              lastConfirmedEditSeqRef.current,
              snapshotSeq
            );
            const confirmedTime = formatClockTime(response.last_saved_at || response.saved_at);
            if (confirmedTime) {
              setLastConfirmedSaveTime(confirmedTime);
            }
            if (response.server_now) {
              serverOffsetRef.current = new Date(response.server_now).getTime() - Date.now();
            }

            if (response.status && response.status !== "active") {
              await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
              return false;
            }

            // Watermark check: strictly clears ONLY if no newer edit occurred in flight
            const fullyCleared = clearUnsyncedExamSnapshotIfMatched(
              currentUserId,
              currentAttempt.id,
              snapshotSeq,
              snapshotAnswers,
              response.revision
            );

            if (!fullyCleared || clientEditSeqRef.current > snapshotSeq) {
              inFlightSavePromiseRef.current = null;
              continue;
            }

            setSyncState("saved");
            setSubmitErrorBanner(null);
            return true;
          }
        } catch (err) {
          const snapshotAnswers = { ...latestAnswersRef.current };
          if (err instanceof ApiError) {
            if (err.status === 401) {
              clearTimers();
              setHydrationState("unauthenticated");
              return false;
            }
            if (err.status === 409) {
              if (
                err.message.includes("Exam time has ended") ||
                err.message.includes("no longer active")
              ) {
                await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
                return false;
              }
              await enterConflictResolutionFlow(currentAttempt, currentUserId, snapshotAnswers);
              return false;
            }
            if (
              err.status === 403 ||
              err.status === 410 ||
              err.code === "attempt_expired"
            ) {
              await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
              return false;
            }
          }

          // Transient failure or 5xx: keep sessionStorage intact, bounded backoff retry
          setSyncState("unsaved_local");
          const attemptNum = Math.min(retryCountRef.current + 1, 5);
          retryCountRef.current = attemptNum;
          const baseDelayMs = Math.min(1500 * Math.pow(2, attemptNum - 1), 15000);
          const jitterMs = Math.floor(Math.random() * 400);

          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            void flushSaveQueueRef.current?.(currentAttempt);
          }, baseDelayMs + jitterMs);

          return false;
        } finally {
          inFlightSavePromiseRef.current = null;
        }
      };

      const promise = executeSingleFlight();
      inFlightSavePromiseRef.current = promise;
      return promise;
    },
    [clearTimers, enterAuthoritativeExpiredState, enterConflictResolutionFlow]
  );

  useEffect(() => {
    flushSaveQueueRef.current = flushSaveQueue;
  }, [flushSaveQueue]);

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

        authUserIdRef.current = resolvedUserId;
        setAuthUserId(resolvedUserId);
        setInfo(serverInfo);

        if (serverInfo.server_now) {
          serverOffsetRef.current = new Date(serverInfo.server_now).getTime() - Date.now();
        }

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

        setAttempt(serverAttempt);
        serverRevisionRef.current = serverAttempt.revision;
        if (serverAttempt.server_now) {
          serverOffsetRef.current = new Date(serverAttempt.server_now).getTime() - Date.now();
        }
        if (serverAttempt.last_saved_at) {
          setLastConfirmedSaveTime(formatClockTime(serverAttempt.last_saved_at));
        }

        // Guard: Ensure reconciliation executes strictly ONCE per (userId, attemptId)
        const reconciliationKey = `${resolvedUserId}:${serverAttempt.id}`;
        if (reconciledAttemptKeyRef.current === reconciliationKey) {
          setHydrationState("ready");
          return;
        }
        reconciledAttemptKeyRef.current = reconciliationKey;

        // If attempt is already completed or expired, remove ONLY this attempt's snapshot
        if (serverAttempt.status !== "active") {
          clearUnsyncedExamSnapshot(resolvedUserId, serverAttempt.id);
          setAnswers(serverAttempt.answers);
          latestAnswersRef.current = serverAttempt.answers;
          setSyncState("expired_submitted");
          setHydrationState("ready");
          return;
        }

        // Read attempt-scoped snapshot
        const unsynced = readUnsyncedExamSnapshot(resolvedUserId, serverAttempt.id);

        if (!unsynced) {
          setAnswers(serverAttempt.answers);
          latestAnswersRef.current = serverAttempt.answers;
          setSyncState("saved");
          setHydrationState("ready");
          return;
        }

        // Seed monotonic edit sequence from stored snapshot
        clientEditSeqRef.current = unsynced.editSeq;

        // Case A: Identical answers -> clear only this attempt's snapshot
        if (areExamAnswersCanonicallyEqual(unsynced.answers, serverAttempt.answers)) {
          clearUnsyncedExamSnapshot(resolvedUserId, serverAttempt.id);
          lastConfirmedEditSeqRef.current = unsynced.editSeq;
          setAnswers(serverAttempt.answers);
          latestAnswersRef.current = serverAttempt.answers;
          setSyncState("saved");
          setHydrationState("ready");
          return;
        }

        // Case B: Same base revision -> Restore unsynced answers and queue save
        if (unsynced.baseRevision === serverAttempt.revision) {
          setAnswers(unsynced.answers);
          latestAnswersRef.current = unsynced.answers;
          setSyncState("unsaved_local");
          setHydrationState("ready");
          void flushSaveQueue(serverAttempt, serverAttempt.revision);
          return;
        }

        // Case C: Divergent base revision -> Enter conflict resolution
        setAnswers(unsynced.answers);
        latestAnswersRef.current = unsynced.answers;
        setSyncState("conflict");
        setConflictData({
          serverRevision: serverAttempt.revision,
          serverSavedAt: formatClockTime(serverAttempt.last_saved_at),
          serverAnswers: serverAttempt.answers,
          localUnsavedAnswers: unsynced.answers,
        });
        setHydrationState("ready");
      } catch {
        if (!cancelled) {
          setHydrationState("error");
        }
      }
    }

    void hydrateAndReconcileOnce();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [clearTimers, examId, flushSaveQueue]);

  /**
   * 2. Authoritative Server Countdown Timer (Active only when hydrationState === "ready")
   */
  useEffect(() => {
    if (
      hydrationState !== "ready" ||
      !attempt ||
      !authUserId ||
      attempt.status !== "active"
    ) {
      return;
    }

    const tick = () => {
      const nowSynced = Date.now() + serverOffsetRef.current;
      const secsLeft = Math.max(
        0,
        Math.ceil((new Date(attempt.due_at).getTime() - nowSynced) / 1000)
      );
      setRemainingSeconds(secsLeft);
      if (secsLeft <= 0) {
        void enterAuthoritativeExpiredState(attempt, authUserId);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, authUserId, enterAuthoritativeExpiredState, hydrationState]);

  /**
   * 3. Network Reconnect & Visibilitychange Immediate Triggers
   */
  useEffect(() => {
    if (
      hydrationState !== "ready" ||
      !attempt ||
      attempt.status !== "active"
    ) {
      return;
    }

    const tryFlushIfDirty = () => {
      if (syncState === "conflict" || syncState === "expired_submitted") return;
      if (clientEditSeqRef.current > lastConfirmedEditSeqRef.current) {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        void flushSaveQueue(attempt);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        tryFlushIfDirty();
      }
    };

    window.addEventListener("online", tryFlushIfDirty);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", tryFlushIfDirty);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [attempt, flushSaveQueue, hydrationState, syncState]);

  /**
   * 4. Answer Change Handlers (Locked until hydrationState === "ready")
   */
  const handleQuizAnswerChange = (itemId: string, questionId: string, optionKey: string) => {
    const currentUserId = authUserIdRef.current;
    if (
      hydrationState !== "ready" ||
      !currentUserId ||
      !attempt ||
      attempt.status !== "active" ||
      syncState === "expired_submitted"
    ) {
      return;
    }

    const currentItemAnswers =
      (latestAnswersRef.current[itemId] as Record<string, string> | undefined) || {};
    const nextItemAnswers = { ...currentItemAnswers, [questionId]: optionKey };
    const nextAnswers = { ...latestAnswersRef.current, [itemId]: nextItemAnswers };

    const nextSeq = clientEditSeqRef.current + 1;
    clientEditSeqRef.current = nextSeq;
    latestAnswersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setSubmitErrorBanner(null);

    writeUnsyncedExamSnapshot({
      userId: currentUserId,
      attemptId: attempt.id,
      baseRevision: serverRevisionRef.current,
      editSeq: nextSeq,
      updatedAtClientIso: new Date().toISOString(),
      answers: nextAnswers,
    });

    if (syncState === "conflict" && conflictData) {
      setConflictData({
        ...conflictData,
        localUnsavedAnswers: nextAnswers,
      });
      return;
    }

    setSyncState("unsaved_local");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void flushSaveQueue(attempt);
    }, 2500);
  };

  const handleCodeAnswerChange = (itemId: string, code: string) => {
    const currentUserId = authUserIdRef.current;
    if (
      hydrationState !== "ready" ||
      !currentUserId ||
      !attempt ||
      attempt.status !== "active" ||
      syncState === "expired_submitted"
    ) {
      return;
    }

    const nextAnswers = { ...latestAnswersRef.current, [itemId]: code };
    const nextSeq = clientEditSeqRef.current + 1;
    clientEditSeqRef.current = nextSeq;
    latestAnswersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    setSubmitErrorBanner(null);

    writeUnsyncedExamSnapshot({
      userId: currentUserId,
      attemptId: attempt.id,
      baseRevision: serverRevisionRef.current,
      editSeq: nextSeq,
      updatedAtClientIso: new Date().toISOString(),
      answers: nextAnswers,
    });

    if (syncState === "conflict" && conflictData) {
      setConflictData({
        ...conflictData,
        localUnsavedAnswers: nextAnswers,
      });
      return;
    }

    setSyncState("unsaved_local");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void flushSaveQueue(attempt);
    }, 2500);
  };

  /**
   * 5. Conflict Resolution Handlers
   */
  const handleResolveKeepLocal = async () => {
    const currentUserId = authUserIdRef.current;
    if (!attempt || !currentUserId || !conflictData) return;

    const chosenAnswers = { ...conflictData.localUnsavedAnswers };
    const rebaseRevision = conflictData.serverRevision;

    const nextSeq = clientEditSeqRef.current + 1;
    clientEditSeqRef.current = nextSeq;
    latestAnswersRef.current = chosenAnswers;
    setAnswers(chosenAnswers);
    serverRevisionRef.current = rebaseRevision;

    writeUnsyncedExamSnapshot({
      userId: currentUserId,
      attemptId: attempt.id,
      baseRevision: rebaseRevision,
      editSeq: nextSeq,
      updatedAtClientIso: new Date().toISOString(),
      answers: chosenAnswers,
    });

    setConflictData(null);
    await flushSaveQueue(attempt, rebaseRevision);
  };

  const handleResolveKeepServer = () => {
    const currentUserId = authUserIdRef.current;
    if (!attempt || !currentUserId || !conflictData) return;

    const serverCopy = { ...conflictData.serverAnswers };
    serverRevisionRef.current = conflictData.serverRevision;
    lastConfirmedEditSeqRef.current = clientEditSeqRef.current;
    latestAnswersRef.current = serverCopy;
    setAnswers(serverCopy);

    // Blast-radius isolation: removes ONLY this attempt's snapshot
    clearUnsyncedExamSnapshot(currentUserId, attempt.id);
    setConflictData(null);
    setSyncState("saved");
    setSubmitErrorBanner(null);
  };

  /**
   * 6. Start / Retake Actions
   */
  async function handleStartExam() {
    setBusy(true);
    setTopError("");
    try {
      const res = await apiRequest<{ attempt_id: string }>(`/exams/${examId}/start`, {
        method: "POST",
      });
      const currentUserId = authUserIdRef.current || (await resolveAuthenticatedUserId());
      if (currentUserId) {
        authUserIdRef.current = currentUserId;
        setAuthUserId(currentUserId);
      }
      const freshAttempt = await apiRequest<Attempt>(`/exams/attempts/${res.attempt_id}`);
      setAttempt(freshAttempt);
      serverRevisionRef.current = freshAttempt.revision;
      if (freshAttempt.server_now) {
        serverOffsetRef.current = new Date(freshAttempt.server_now).getTime() - Date.now();
      }
      if (freshAttempt.last_saved_at) {
        setLastConfirmedSaveTime(formatClockTime(freshAttempt.last_saved_at));
      }
      setAnswers(freshAttempt.answers);
      latestAnswersRef.current = freshAttempt.answers;
      setSyncState("saved");
      if (currentUserId) {
        reconciledAttemptKeyRef.current = `${currentUserId}:${freshAttempt.id}`;
      }
      setHydrationState("ready");
    } catch (cause) {
      setTopError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  /**
   * 7. Run Sample Action
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

  /**
   * 8. Manual Submission Gate
   */
  const handleManualSubmitExam = async () => {
    const currentUserId = authUserIdRef.current;
    if (
      hydrationState !== "ready" ||
      !currentUserId ||
      !attempt ||
      attempt.status !== "active"
    ) {
      return;
    }

    setSubmitErrorBanner(null);

    if (syncState === "conflict") {
      setSubmitErrorBanner(
        "Submission has not been confirmed. Please resolve the answer conflict above before submitting."
      );
      conflictBannerRef.current?.focus();
      return;
    }

    setIsSubmittingExam(true);
    clearTimers();

    try {
      const hasUnsyncedEdits =
        clientEditSeqRef.current > lastConfirmedEditSeqRef.current ||
        syncState === "unsaved_local" ||
        syncState === "saving";

      if (hasUnsyncedEdits) {
        const confirmed = await flushSaveQueue(attempt);
        if (!confirmed) {
          setSubmitErrorBanner(
            "Submission has not been confirmed because your latest answers could not be saved to your account. Your draft remains on this tab—please check your connection and try again."
          );
          return;
        }
      }

      await apiRequest(`/exams/attempts/${attempt.id}/submit`, {
        method: "POST",
      });

      // Blast-radius isolation: removes ONLY this attempt's snapshot
      clearUnsyncedExamSnapshot(currentUserId, attempt.id);
      const updatedAttempt = await apiRequest<Attempt>(`/exams/attempts/${attempt.id}`);
      setAttempt(updatedAttempt);
      setSyncState("saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setHydrationState("unauthenticated");
      } else if (err instanceof ApiError && err.status === 409) {
        if (
          err.message.includes("Exam time has ended") ||
          err.message.includes("no longer active")
        ) {
          await enterAuthoritativeExpiredState(attempt, currentUserId);
        } else {
          await enterConflictResolutionFlow(attempt, currentUserId, latestAnswersRef.current);
          setSubmitErrorBanner(
            "Submission has not been confirmed because newer answers were saved in another tab. Please resolve the conflict first."
          );
        }
      } else if (
        err instanceof ApiError &&
        (err.status === 403 || err.status === 410)
      ) {
        await enterAuthoritativeExpiredState(attempt, currentUserId);
      } else {
        setSubmitErrorBanner(
          "Submission has not been confirmed because your latest answers could not be saved to your account."
        );
      }
    } finally {
      setIsSubmittingExam(false);
    }
  };

  // Explicit Unauthenticated / Expired Session View (Preserves sessionStorage intact)
  if (hydrationState === "unauthenticated") {
    return (
      <main id="main-content" className="page-shell pilot-dashboard" style={{ maxWidth: "560px", marginTop: "40px" }}>
        <div
          role="alert"
          className="pilot-card"
          style={{
            border: "2px solid #e49a5b",
            backgroundColor: "#fffcf7",
            padding: "24px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#92400e",
              margin: "0 0 6px 0",
            }}
          >
            Session Verification Required
          </p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#162322", margin: "0 0 10px 0" }}>
            Sign in to resume your exam attempt
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#4a5d58", margin: "0 0 20px 0" }}>
            Your login session expired or could not be verified. Any unsaved answers in this
            browser tab have been preserved—sign in within this same tab to recover and sync your
            work before the exam timer ends.
          </p>
          <div>
            <Link
              href={`/onboarding?mode=signin&redirect=/exams/${examId}`}
              className="button button-primary"
              style={{
                backgroundColor: "#047857",
                borderColor: "#047857",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              Sign in to continue exam →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Hydrating View
  if (hydrationState === "hydrating") {
    return (
      <main id="main-content" className="page-shell pilot-dashboard" style={{ marginTop: "40px" }}>
        <p role="status" style={{ fontSize: "14px", fontWeight: 600, color: "#4a5d58" }}>
          Verifying account session and syncing exam attempt…
        </p>
      </main>
    );
  }

  // Error View
  if (hydrationState === "error") {
    return (
      <main id="main-content" className="page-shell pilot-dashboard" style={{ maxWidth: "560px", marginTop: "40px" }}>
        <div
          role="alert"
          className="pilot-card"
          style={{
            border: "2px solid #a33e37",
            backgroundColor: "#fffdfd",
            padding: "24px",
          }}
        >
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#a33e37", margin: "0 0 8px 0" }}>
            Unable to load exam attempt
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#4a5d58", margin: 0 }}>
            Any unsynced answers in this tab remain untouched. Check your network connection
            and reload this page.
          </p>
        </div>
      </main>
    );
  }

  const currentItem = attempt?.items[activeIndex];
  const isReadOnly =
    hydrationState !== "ready" ||
    attempt?.status !== "active" ||
    syncState === "expired_submitted";

  const mins = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const secs = remainingSeconds !== null ? remainingSeconds % 60 : 0;

  return (
    <div className="page-shell pilot-dashboard">
      <p className="eyebrow-label">Timed assessment · Asia/Manila</p>
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
            The timer continues if you disconnect. Your latest saved answers are
            submitted when time expires.
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
          <Link href="/exams">Back to exams</Link>
        </section>
      )}

      {/* Active Exam Attempt */}
      {attempt && attempt.status === "active" && (
        <>
          {/* Header Card: Timer + Submit Button + Truthful Status Bar */}
          <div className="pilot-card" style={{ border: "2px solid #047857" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong
                  role="timer"
                  aria-label="Remaining exam time"
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    backgroundColor:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "#fdf2f2"
                        : "#f0f7f1",
                    color:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "#a33e37"
                        : "#047857",
                    border:
                      remainingSeconds !== null && remainingSeconds <= 120
                        ? "2px solid #a33e37"
                        : "2px solid #047857",
                  }}
                >
                  Time left: {mins}:{String(secs).padStart(2, "0")}
                </strong>
              </div>

              <button
                type="button"
                className="button button-primary"
                disabled={isReadOnly || isSubmittingExam}
                onClick={() => void handleManualSubmitExam()}
                style={{
                  backgroundColor: "#047857",
                  borderColor: "#047857",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                {isSubmittingExam ? "Confirming & submitting…" : "Submit exam"}
              </button>
            </div>

            {/* Truthful Accessible Save Status Bar */}
            <div
              role={
                syncState === "conflict" || syncState === "unsaved_local"
                  ? "alert"
                  : "status"
              }
              aria-live="polite"
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderRadius: "12px",
                border:
                  syncState === "saved"
                    ? "1px solid #a7d3b8"
                    : syncState === "saving"
                    ? "1px solid #c7d9cb"
                    : syncState === "unsaved_local"
                    ? "1px solid #f6c870"
                    : syncState === "conflict"
                    ? "2px solid #f09590"
                    : "1px solid #c7d9cb",
                backgroundColor:
                  syncState === "saved"
                    ? "#f0f7f1"
                    : syncState === "saving"
                    ? "#fafbfa"
                    : syncState === "unsaved_local"
                    ? "#fefbf2"
                    : syncState === "conflict"
                    ? "#fff5f5"
                    : "#f5f7f2",
                padding: "12px 16px",
                fontSize: "14px",
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
                          ? "#047857"
                          : syncState === "saving"
                          ? "#e49a5b"
                          : syncState === "unsaved_local"
                          ? "#b46b1a"
                          : syncState === "conflict"
                          ? "#a33e37"
                          : "#63756f",
                    }}
                  />
                  <span>
                    {syncState === "saving" && "Saving"}
                    {syncState === "saved" &&
                      (lastConfirmedSaveTime
                        ? `Saved to your account at ${lastConfirmedSaveTime}`
                        : "Saved to your account")}
                    {syncState === "unsaved_local" && "Unsaved on this device"}
                    {syncState === "conflict" && "Resolve answer conflict"}
                    {syncState === "expired_submitted" &&
                      "Time ended; latest server-saved answers submitted"}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#4a5d58",
                    fontWeight: 500,
                  }}
                >
                  Last confirmed save:{" "}
                  <strong
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      color: "#162322",
                    }}
                  >
                    {lastConfirmedSaveTime || "None yet"}
                  </strong>
                </div>
              </div>

              {syncState === "unsaved_local" && (
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "13px",
                    color: "#8a5814",
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
                  border: "1px solid #f09590",
                  backgroundColor: "#fff5f5",
                  color: "#a33e37",
                  fontSize: "14px",
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
                border: "2px solid #a33e37",
                backgroundColor: "#fffdfd",
                outline: "none",
              }}
            >
              <h2
                id="conflict-heading"
                style={{ color: "#a33e37", margin: "0 0 8px 0" }}
              >
                Resolve answer conflict
              </h2>
              <p style={{ margin: "0 0 16px 0", color: "#4a5d58", fontSize: "14px" }}>
                Another tab saved revision #{conflictData.serverRevision}
                {conflictData.serverSavedAt
                  ? ` at ${conflictData.serverSavedAt}`
                  : ""}{" "}
                while this tab had unsaved edits. Both versions are preserved below.
                Choose which answers to keep for your exam.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                {/* Local Copy */}
                <div
                  style={{
                    border: "1px solid #f6c870",
                    borderRadius: "10px",
                    padding: "14px",
                    backgroundColor: "#fffcf5",
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
                    <strong style={{ color: "#8a5814", fontSize: "14px" }}>
                      This device’s unsaved answers
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
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
                      background: "#162322",
                      color: "#d1fae5",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "12px",
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
                      backgroundColor: "#047857",
                      borderColor: "#047857",
                      color: "#fff",
                    }}
                    onClick={() => void handleResolveKeepLocal()}
                  >
                    Use this device’s unsaved answers
                  </button>
                </div>

                {/* Server Copy */}
                <div
                  style={{
                    border: "1px solid #c7d9cb",
                    borderRadius: "10px",
                    padding: "14px",
                    backgroundColor: "#f9fbfa",
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
                    <strong style={{ color: "#162322", fontSize: "14px" }}>
                      Account’s saved answers (Rev #{conflictData.serverRevision})
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        backgroundColor: "#d1fae5",
                        color: "#047857",
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
                      background: "#162322",
                      color: "#e2e8f0",
                      padding: "10px",
                      borderRadius: "6px",
                      fontSize: "12px",
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
                      borderColor: "#c7d9cb",
                      color: "#162322",
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
                  <p style={{ color: "#4a5d58", fontSize: "13px", margin: "0 0 6px" }}>
                    Task {activeIndex + 1} of {attempt.items.length} ·{" "}
                    {currentItem.points} points
                  </p>
                  <h2 id="exam-item-title">{currentItem.title}</h2>
                  <p style={{ lineHeight: 1.6, color: "#162322" }}>
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
                          fontSize: "14px",
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

                      <h3 style={{ fontSize: "1rem", marginTop: "16px" }}>
                        Visible samples
                      </h3>
                      {currentItem.samples?.map((s, idx) => (
                        <p
                          key={idx}
                          style={{
                            background: "#f5f7f2",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #dbe3db",
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
                            color: "#047857",
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
              <div role="tablist" aria-label="Exam tasks">
                {attempt.items.map((task, index) => {
                  const isAnswered =
                    task.kind === "quiz"
                      ? answers[task.id] &&
                        Object.keys(
                          (answers[task.id] as Record<string, string>) || {}
                        ).length > 0
                      : typeof answers[task.id] === "string" &&
                        Boolean((answers[task.id] as string).trim());

                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={index === activeIndex}
                      aria-current={index === activeIndex ? "step" : undefined}
                      className="pilot-task"
                      key={task.id}
                      onClick={() => setActiveIndex(index)}
                      style={{
                        borderColor:
                          index === activeIndex ? "#047857" : undefined,
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
                  onClick={() => void handleManualSubmitExam()}
                  style={{
                    width: "100%",
                    backgroundColor: "#047857",
                    borderColor: "#047857",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
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
              : "Exam closed"}
          </h2>

          {syncState === "expired_submitted" && (
            <div
              role="alert"
              style={{
                marginBottom: "16px",
                padding: "12px 16px",
                borderRadius: "8px",
                backgroundColor: "#f5f7f2",
                border: "1px solid #c7d9cb",
                fontWeight: 700,
                color: "#162322",
              }}
            >
              Time ended; latest server-saved answers submitted
            </div>
          )}

          {!attempt.results_released && (
            <p>
              Your instructor will release scores and solutions after the exam
              closes.
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
                    border: "1px solid #dbe3db",
                    borderRadius: "8px",
                  }}
                >
                  <strong>
                    {res.points_earned} / {res.points_possible} points
                  </strong>
                  <pre
                    style={{
                      background: "#162322",
                      color: "#d1fae5",
                      padding: "10px",
                      borderRadius: "6px",
                      overflow: "auto",
                      marginTop: "6px",
                    }}
                  >
                    {typeof res.solution === "string"
                      ? res.solution
                      : JSON.stringify(res.solution, null, 2)}
                  </pre>
                </div>
              ))}
            </>
          )}

          {info?.can_start && (
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

          <div style={{ marginTop: "16px" }}>
            <Link href="/dashboard">Return to dashboard</Link>
          </div>
        </section>
      )}
    </div>
  );
}
