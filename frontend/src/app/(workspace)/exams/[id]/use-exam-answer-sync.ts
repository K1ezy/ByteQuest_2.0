"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import {
  areExamAnswersCanonicallyEqual,
  clearUnsyncedExamSnapshot,
  clearUnsyncedExamSnapshotIfMatched,
  readUnsyncedExamSnapshot,
  writeUnsyncedExamSnapshot,
} from "@/lib/supabase";
import {
  formatClockTime,
  type Attempt,
  type ExamAnswers,
  type ExamSyncBannerState,
  type SaveAnswersResponse,
} from "./exam-model";

export interface ExamConflict {
  serverRevision: number;
  serverSavedAt: string | null;
  serverAnswers: ExamAnswers;
  localUnsavedAnswers: ExamAnswers;
}

interface ExamAnswerSyncOptions {
  /** The attempt on screen; edits and saves act on it. */
  attempt: Attempt | null;
  /** Edits are locked until the page has finished loading and reconciling. */
  ready: boolean;
  setAttempt: Dispatch<SetStateAction<Attempt | null>>;
  /** The sign-in session was lost; the page shows the sign-in view. */
  onSessionLost: () => void;
}

/**
 * Exam answer persistence: debounced autosave, a single-flight save queue with
 * bounded retry, attempt-scoped tab snapshots, conflict resolution, delivery at
 * the deadline, and final submission. The page owns loading and layout only.
 */
export function useExamAnswerSync({ attempt, ready, setAttempt, onSessionLost }: ExamAnswerSyncOptions) {
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [syncState, setSyncState] = useState<ExamSyncBannerState>("saved");
  const [lastConfirmedSaveTime, setLastConfirmedSaveTime] = useState<string | null>(null);
  const [submitErrorBanner, setSubmitErrorBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictData, setConflictData] = useState<ExamConflict | null>(null);
  const [deadlineAttemptId, setDeadlineAttemptId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Deterministic refs for single-pass reconciliation & the single-flight save queue
  const authUserIdRef = useRef<string | null>(null);
  const reconciledAttemptKeyRef = useRef<string | null>(null);
  const serverRevisionRef = useRef<number>(0);
  const clientEditSeqRef = useRef<number>(0);
  const lastConfirmedEditSeqRef = useRef<number>(0);
  const latestAnswersRef = useRef<ExamAnswers>({});
  const inFlightSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const retryCountRef = useRef<number>(0);
  const lastSaveFailedTransientlyRef = useRef(false);
  const deadlineAttemptRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverOffsetRef = useRef<number>(0);
  const conflictBannerRef = useRef<HTMLElement | null>(null);
  const flushSaveQueueRef = useRef<
    ((currentAttempt: Attempt, overrideBaseRevision?: number) => Promise<boolean>) | null
  >(null);
  // Kept in a ref so the save queue's identity never changes with the page's callback.
  const onSessionLostRef = useRef(onSessionLost);
  useEffect(() => {
    onSessionLostRef.current = onSessionLost;
  });

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

  const bindUser = useCallback((userId: string | null) => {
    if (authUserIdRef.current !== userId) clearTimers();
    authUserIdRef.current = userId;
  }, [clearTimers]);

  const currentUserId = useCallback(() => authUserIdRef.current, []);

  /** Aligns the countdown with the server clock. */
  const noteServerNow = useCallback((serverNow: string | undefined) => {
    if (serverNow) {
      serverOffsetRef.current = new Date(serverNow).getTime() - Date.now();
    }
  }, []);

  const serverNowMs = useCallback(() => Date.now() + serverOffsetRef.current, []);

  /**
   * Transitions ONLY this attempt into the authoritative expired/completed state.
   * Blast-radius isolation: NEVER purges snapshots for other exam attempts.
   */
  const enterAuthoritativeExpiredState = useCallback(
    async (currentAttempt: Attempt, currentUserId: string) => {
      if (authUserIdRef.current !== currentUserId) return;
      clearTimers();
      clearUnsyncedExamSnapshot(currentUserId, currentAttempt.id);
      setConflictData(null);
      setSyncState("expired_submitted");
      const attemptPath = `/exams/attempts/${currentAttempt.id}`;
      async function refreshAfterDeadline(waitForCutoff: boolean) {
        try {
          const finalAttempt = await apiRequest<Attempt>(attemptPath);
          if (authUserIdRef.current !== currentUserId) return;
          // The worker waits for the last autosave window to close before grading.
          if (finalAttempt.status === "active" && waitForCutoff) {
            const cutoffMs = Date.parse(finalAttempt.answers_accepted_until ?? finalAttempt.due_at);
            const nowMs = finalAttempt.server_now ? Date.parse(finalAttempt.server_now) : serverNowMs();
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void refreshAfterDeadline(false);
            }, Math.max(100, cutoffMs - nowMs + 100));
            return;
          }
          setAttempt(finalAttempt);
          setAnswers(finalAttempt.answers);
          latestAnswersRef.current = finalAttempt.answers;
          serverRevisionRef.current = finalAttempt.revision;
          if (finalAttempt.last_saved_at) {
            setLastConfirmedSaveTime(formatClockTime(finalAttempt.last_saved_at));
          }
        } catch {
          if (authUserIdRef.current !== currentUserId) return;
          setAttempt((prev) => ({ ...(prev ?? currentAttempt), status: "auto_submitted" }));
        }
      }
      await refreshAfterDeadline(true);
    },
    [clearTimers, serverNowMs, setAttempt]
  );

  /**
   * Enters the 409 Conflict flow while preserving both server and local copies.
   */
  const enterConflictResolutionFlow = useCallback(
    async (currentAttempt: Attempt, currentUserId: string, localDraftAnswers: ExamAnswers) => {
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
    async (currentAttempt: Attempt, overrideBaseRevision?: number): Promise<boolean> => {
      const currentUserId = authUserIdRef.current;
      if (!currentUserId || currentAttempt.status !== "active") {
        return false;
      }

      if (inFlightSavePromiseRef.current) {
        return inFlightSavePromiseRef.current;
      }

      const executeSingleFlight = async (): Promise<boolean> => {
        let currentExpectedRevision = overrideBaseRevision ?? serverRevisionRef.current;
        lastSaveFailedTransientlyRef.current = false;

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
            if (authUserIdRef.current !== currentUserId) return false;

            retryCountRef.current = 0;
            serverRevisionRef.current = response.revision;
            currentExpectedRevision = response.revision;
            lastConfirmedEditSeqRef.current = Math.max(lastConfirmedEditSeqRef.current, snapshotSeq);
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
          if (authUserIdRef.current !== currentUserId) return false;
          const snapshotAnswers = { ...latestAnswersRef.current };
          if (err instanceof ApiError) {
            if (err.status === 401) {
              clearTimers();
              onSessionLostRef.current();
              return false;
            }
            if (err.status === 409) {
              if (err.message.includes("Exam time has ended") || err.message.includes("no longer active")) {
                await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
                return false;
              }
              await enterConflictResolutionFlow(currentAttempt, currentUserId, snapshotAnswers);
              return false;
            }
            if (err.status === 403 || err.status === 410 || err.code === "attempt_expired") {
              await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
              return false;
            }
          }

          // Transient failure or 5xx: keep sessionStorage intact, bounded backoff retry
          lastSaveFailedTransientlyRef.current = true;
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
   * At due_at: lock editing, then deliver unsaved edits before the server's
   * cutoff (answers_accepted_until), so the last seconds of work are graded.
   * Only network failures are retried; a conflict or lost session is final.
   */
  const finishAtDeadline = useCallback(
    async (currentAttempt: Attempt, currentUserId: string) => {
      if (deadlineAttemptRef.current === currentAttempt.id) return;
      deadlineAttemptRef.current = currentAttempt.id;
      setDeadlineAttemptId(currentAttempt.id);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const cutoffMs = new Date(currentAttempt.answers_accepted_until ?? currentAttempt.due_at).getTime();
      while (
        clientEditSeqRef.current > lastConfirmedEditSeqRef.current &&
        Date.now() + serverOffsetRef.current < cutoffMs
      ) {
        if (await flushSaveQueue(currentAttempt)) break;
        if (!lastSaveFailedTransientlyRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await enterAuthoritativeExpiredState(currentAttempt, currentUserId);
    },
    [enterAuthoritativeExpiredState, flushSaveQueue]
  );

  /**
   * Single-pass reconciliation of a loaded attempt with this tab's unsynced snapshot.
   * Runs strictly ONCE per (userId, attemptId).
   */
  const adoptServerAttempt = useCallback(
    (serverAttempt: Attempt, userId: string) => {
      serverRevisionRef.current = serverAttempt.revision;
      if (serverAttempt.server_now) {
        serverOffsetRef.current = new Date(serverAttempt.server_now).getTime() - Date.now();
      }
      if (serverAttempt.last_saved_at) {
        setLastConfirmedSaveTime(formatClockTime(serverAttempt.last_saved_at));
      }

      const reconciliationKey = `${userId}:${serverAttempt.id}`;
      if (reconciledAttemptKeyRef.current === reconciliationKey) return;
      reconciledAttemptKeyRef.current = reconciliationKey;

      // If attempt is already completed or expired, remove ONLY this attempt's snapshot
      if (serverAttempt.status !== "active") {
        clearUnsyncedExamSnapshot(userId, serverAttempt.id);
        setAnswers(serverAttempt.answers);
        latestAnswersRef.current = serverAttempt.answers;
        setSyncState("expired_submitted");
        return;
      }

      const unsynced = readUnsyncedExamSnapshot(userId, serverAttempt.id);
      if (!unsynced) {
        setAnswers(serverAttempt.answers);
        latestAnswersRef.current = serverAttempt.answers;
        setSyncState("saved");
        return;
      }

      // Seed monotonic edit sequence from stored snapshot
      clientEditSeqRef.current = unsynced.editSeq;

      // Case A: Identical answers -> clear only this attempt's snapshot
      if (areExamAnswersCanonicallyEqual(unsynced.answers, serverAttempt.answers)) {
        clearUnsyncedExamSnapshot(userId, serverAttempt.id);
        lastConfirmedEditSeqRef.current = unsynced.editSeq;
        setAnswers(serverAttempt.answers);
        latestAnswersRef.current = serverAttempt.answers;
        setSyncState("saved");
        return;
      }

      // Case B: Same base revision -> Restore unsynced answers and queue save
      if (unsynced.baseRevision === serverAttempt.revision) {
        setAnswers(unsynced.answers);
        latestAnswersRef.current = unsynced.answers;
        setSyncState("unsaved_local");
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
    },
    [flushSaveQueue]
  );

  useEffect(() => {
    const userId = authUserIdRef.current;
    if (!ready || !userId || attempt?.status !== "active") return;
    const tick = () => {
      if (authUserIdRef.current !== userId) return;
      const seconds = Math.max(0, Math.ceil((new Date(attempt.due_at).getTime() - serverNowMs()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) void finishAtDeadline(attempt, userId);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, ready, finishAtDeadline, serverNowMs]);

  /**
   * Network Reconnect & Visibilitychange Immediate Triggers
   */
  useEffect(() => {
    if (!ready || !attempt || attempt.status !== "active") {
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
  }, [attempt, flushSaveQueue, ready, syncState]);

  /**
   * One edit: snapshot it to this tab, then autosave after a pause (locked until ready).
   */
  const applyEdit = (build: (current: ExamAnswers) => ExamAnswers) => {
    const currentUserId = authUserIdRef.current;
    if (
      !ready ||
      !currentUserId ||
      !attempt ||
      attempt.status !== "active" ||
      syncState === "expired_submitted" ||
      deadlineAttemptRef.current === attempt.id
    ) {
      return;
    }

    const nextAnswers = build(latestAnswersRef.current);
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

  const changeQuizAnswer = (itemId: string, questionId: string, optionKey: string) =>
    applyEdit((current) => ({
      ...current,
      [itemId]: { ...((current[itemId] as Record<string, string> | undefined) || {}), [questionId]: optionKey },
    }));

  const changeCodeAnswer = (itemId: string, code: string) =>
    applyEdit((current) => ({ ...current, [itemId]: code }));

  /**
   * Conflict Resolution Handlers
   */
  const resolveKeepLocal = async () => {
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

  const resolveKeepServer = () => {
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
   * Manual Submission Gate: never submits until the latest answers are confirmed saved.
   */
  const submitExam = async () => {
    const currentUserId = authUserIdRef.current;
    if (!ready || !currentUserId || !attempt || attempt.status !== "active") {
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

    setIsSubmitting(true);
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
        onSessionLostRef.current();
      } else if (err instanceof ApiError && err.status === 409) {
        if (err.message.includes("Exam time has ended") || err.message.includes("no longer active")) {
          await enterAuthoritativeExpiredState(attempt, currentUserId);
        } else {
          await enterConflictResolutionFlow(attempt, currentUserId, latestAnswersRef.current);
          setSubmitErrorBanner(
            "Submission has not been confirmed because newer answers were saved in another tab. Please resolve the conflict first."
          );
        }
      } else if (err instanceof ApiError && (err.status === 403 || err.status === 410)) {
        await enterAuthoritativeExpiredState(attempt, currentUserId);
      } else {
        setSubmitErrorBanner(
          "Submission has not been confirmed because your latest answers could not be saved to your account."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    answers,
    syncState,
    lastConfirmedSaveTime,
    submitErrorBanner,
    isSubmitting,
    conflictData,
    conflictBannerRef,
    deadlineAttemptId,
    remainingSeconds,
    bindUser,
    currentUserId,
    noteServerNow,
    clearTimers,
    adoptServerAttempt,
    changeQuizAnswer,
    changeCodeAnswer,
    resolveKeepLocal,
    resolveKeepServer,
    submitExam,
  };
}
