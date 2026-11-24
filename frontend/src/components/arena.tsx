"use client";

import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useShellProfile } from "@/components/app-shell";
import { ConfirmDialog, StatusChip } from "@/components/workspace/ui";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import { splitProblemStatement } from "@/lib/problem-statement";
import { newRequestId } from "@/lib/network";
import type { Evaluation, EvaluationTestResult, Quest } from "@/lib/types";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading code editor…</div>,
});
loader.config({ paths: { vs: "/monaco/vs" } });

const TOUCH_EDITOR_QUERY = "(max-width: 1023px) and (pointer: coarse)";

function subscribeToTouchEditor(onChange: () => void) {
  const query = window.matchMedia?.(TOUCH_EDITOR_QUERY);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function usesTouchEditor() {
  return window.matchMedia?.(TOUCH_EDITOR_QUERY).matches ?? false;
}

function draftKey(userId: string, activityId: string): string {
  return `bytequest:draft:${userId}:${activityId}`;
}

function readLocalDraft(userId: string, activityId: string): string | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId, activityId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "source_code" in value &&
        typeof value.source_code === "string" && value.source_code.length <= 50_000) return value.source_code;
  } catch { /* Storage may be blocked or contain an invalid older entry. */ }
  return null;
}

function writeLocalDraft(userId: string, activityId: string, code: string): void {
  try { window.localStorage.setItem(draftKey(userId, activityId), JSON.stringify({ source_code: code })); }
  catch { /* Storage may be blocked. */ }
}

interface SubmissionResponse {
  mode: string;
  attempt_id?: string;
  attempt_number?: number;
  xp_awarded?: number;
  evaluation: Evaluation;
}

interface SubmissionJob {
  id: string;
  activity_id: string;
  dry_run_only: boolean;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  result: SubmissionResponse | null;
  error: string | null;
}

type SampleRun = { key: string; id: string; sourceCode: string };

function readSampleRun(key: string): SampleRun | null {
  try {
    const run = JSON.parse(window.sessionStorage.getItem(key) || "null");
    if (typeof run?.id === "string" && run.id && typeof run.sourceCode === "string") {
      return { key, id: run.id, sourceCode: run.sourceCode };
    }
  } catch { /* Continue when session storage is unavailable. */ }
  return null;
}

function removeStoredRun(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Continue without session storage. */ }
}

function sampleRunStatus(job: SubmissionJob) {
  if (job.status === "running") return "Grading sample run";
  return job.attempts > 0 ? "Sample grading will retry" : "Sample run queued";
}

interface HintStatus {
  remaining: number;
  reviewed: { id: string; slot: number; body: string | null }[];
  ai_hints: { id: string; body: string }[];
}

const MAX_HINTS = 5;
const LANGUAGE_NAMES: Record<string, string> = { python: "Python", cpp: "C++", java: "Java" };

function starterCode(language: string): string {
  if (language === "cpp") return '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n';
  if (language === "java") return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n';
  return "# Write your solution here\n";
}

function getActivityHref(quest: Quest): string {
  return quest.activity_type === "quiz" ? `/quiz/${quest.id}` : `/arena/${quest.id}`;
}

function savedAt(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Judge0 reports Python syntax errors as runtime errors; the traceback says what really happened.
const PYTHON_SYNTAX_ERROR = /^(SyntaxError|IndentationError|TabError)\b/m;

function caseVerdict(test: EvaluationTestResult): string {
  if (test.passed) return "Passed";
  if (test.error_category === "syntax_error") return "Compile error";
  if (PYTHON_SYNTAX_ERROR.test(test.stderr || "")) return "Syntax error";
  if (test.error_category === "runtime_error") return "Runtime error";
  if (test.error_category === "timeout") return "Time limit exceeded";
  if (test.error_category === "logic_error") return "Wrong answer";
  return test.status_description || "Did not pass";
}

function nextStep(test: EvaluationTestResult | undefined): string {
  if (!test) return "Check your code, then run the sample again.";
  if (test.compile_output || test.error_category === "syntax_error") {
    return "Read the compiler message below. Its line number points to where your code needs fixing.";
  }
  if (PYTHON_SYNTAX_ERROR.test(test.stderr || "")) {
    return "Python couldn't read your code. Check the line in the error message, and the line just above it, for a missing bracket, colon, or quote.";
  }
  if (test.error_category === "runtime_error") {
    return "Your program stopped with an error. Read the last line of the error message, fix that line, and run again.";
  }
  if (test.error_category === "timeout") {
    return "Your program took too long. Look for a loop that never ends or input that is read the wrong way.";
  }
  return "Compare the expected output with yours, fix the difference, and run the sample again.";
}

function OutputBlock({ label, text, empty, tone }: { label: string; text?: string; empty?: string; tone?: "error" }) {
  return (
    <div className={`arena-output${tone ? ` ${tone}` : ""}`}>
      <span className="arena-output-label">{label}</span>
      {text ? (
        <pre tabIndex={0} aria-label={label}>{text}</pre>
      ) : (
        <p className="arena-output-empty">{empty}</p>
      )}
    </div>
  );
}

export default function Arena({ activityId }: { activityId: string }) {
  const touchEditor = useSyncExternalStore(subscribeToTouchEditor, usesTouchEditor, () => false);
  const router = useRouter();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [trackActivities, setTrackActivities] = useState<Quest[]>([]);
  const { id: userId, role, enrolled_language: language } = useShellProfile();
  const [code, setCode] = useState("");
  const [starter, setStarter] = useState("");
  type SyncState = "synced" | "saving" | "saved-local" | "error";
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [retryTick, setRetryTick] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Loading your code…");
  const latestCodeRef = useRef("");
  const workedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const lastSyncedCodeRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [resultCode, setResultCode] = useState("");
  const [runError, setRunError] = useState("");
  const [sending, setSending] = useState<"run" | "submit" | "">("");
  const [sampleRun, setSampleRun] = useState<SampleRun | null>(null);
  const [sampleStatus, setSampleStatus] = useState("");
  const submissionRequest = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiError, setAiError] = useState("");
  const pendingHintRef = useRef<{ activityId: string; userId: string; key: string } | null>(null);
  const [hintStatus, setHintStatus] = useState<HintStatus | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintError, setHintError] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [solution, setSolution] = useState("");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [copyState, setCopyState] = useState<"" | "copied" | "failed">("");
  const [confirmReset, setConfirmReset] = useState(false);

  const questId = quest?.id;
  const sampleKey = userId && `bytequest:sample-job:${userId}:${activityId}`;
  const pendingSample = sampleRun?.key === sampleKey ? sampleRun : null;
  const busy = sending || (pendingSample ? "run" : "");

  const showSampleResult = useCallback((response: SubmissionResponse, source: string) => {
    const visible = response.evaluation.test_results?.filter((test) => !test.is_hidden) ?? [];
    setResult(response);
    setResultCode(source);
    setActiveCaseIndex(Math.max(0, visible.findIndex((test) => !test.passed)));
    setAnnouncement(`Sample run finished: ${runHeadline(response.evaluation, visible)}. No attempt was recorded.`);
  }, []);

  useEffect(() => {
    const cancel = () => submissionRequest.current?.abort();
    const signedOut = () => {
      cancel();
      setSending("");
      setSampleRun(null);
      setResult(null);
    };
    window.addEventListener("bytequest:auth-cleared", signedOut);
    return () => {
      window.removeEventListener("bytequest:auth-cleared", signedOut);
      cancel();
    };
  }, [activityId]);

  useEffect(() => {
    if (!pendingSample) return;
    const run = pendingSample;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 1500;

    function stop() {
      controller.abort();
      clearTimeout(timer);
    }

    async function checkStatus() {
      try {
        const job = await apiRequest<SubmissionJob>(`/submission-jobs/${encodeURIComponent(run.id)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (job.id !== run.id || job.activity_id !== activityId || !job.dry_run_only) {
          throw new Error("This saved sample run does not match the current challenge.");
        }
        if (job.status === "queued" || job.status === "running") {
          setSampleStatus(sampleRunStatus(job));
          timer = setTimeout(checkStatus, delay);
          delay = Math.min(8000, Math.round(delay * 1.4));
          return;
        }
        if (job.status === "failed" || !job.result) throw new Error(job.error || "Sample grading failed. Try again.");
        showSampleResult(job.result, run.sourceCode);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500)) {
          setSampleStatus("Connection interrupted. Checking this sample run again soon.");
          timer = setTimeout(checkStatus, Math.max(6000, (error.retryAfterSeconds ?? 0) * 1000));
          return;
        }
        setRunError(getErrorMessage(error));
        setAnnouncement(`Sample run failed: ${getErrorMessage(error)}`);
      }
      removeStoredRun(run.key);
      setSampleRun(null);
    }

    // Give the accepted state time to render before the first status check.
    timer = setTimeout(checkStatus, delay);
    window.addEventListener("bytequest:auth-cleared", stop);
    return () => {
      stop();
      window.removeEventListener("bytequest:auth-cleared", stop);
    };
  }, [activityId, pendingSample, showSampleResult]);

  const flushDraftToServer = useCallback(
    async (nextCode: string) => {
      if (!questId || !userId) return;

      setSyncState("saving");
      setDraftStatus("Saving…");
      try {
        await apiRequest(`/pilot/drafts/${questId}`, {
          method: "PUT",
          body: JSON.stringify({ source_code: nextCode }),
        });
        lastSyncedCodeRef.current = nextCode;
        try {
          const key = draftKey(userId, questId);
          if (readLocalDraft(userId, questId) === nextCode) window.localStorage.removeItem(key);
        } catch { /* Storage may be blocked. */ }
        setSyncState("synced");
        setDraftStatus(`Saved to your account at ${savedAt()}`);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        return true;
      } catch {
        setSyncState("saved-local");
        setDraftStatus("Saved on this device · retrying sync");
        return false;
      }
    },
    [userId, questId]
  );

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  // Count only the time this tab is actually in front, so a challenge left open
  // overnight does not report eight hours of work. Both handlers are idempotent.
  useEffect(() => {
    function startSegment() {
      if (segmentStartRef.current === null) segmentStartRef.current = Date.now();
    }
    function endSegment() {
      if (segmentStartRef.current !== null) {
        workedMsRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") startSegment();
      else endSegment();
    }
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", startSegment);
    window.addEventListener("blur", endSegment);
    return () => {
      endSegment();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", startSegment);
      window.removeEventListener("blur", endSegment);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (role !== "student") throw new Error("Code submissions are available to student accounts.");
        if (!language) throw new Error("Join a workshop to choose your language before opening a code challenge.");
        const activities = await apiRequest<Quest[]>(`/quests?details_for=${encodeURIComponent(activityId)}`);
        if (!active) return;
        setTrackActivities(activities);
        const target = activities.find((item) => item.id === activityId && item.activity_type === "challenge");
        if (!target) throw new Error("This published challenge is not available on your selected language track.");
        setQuest(target);
        const savedRun = readSampleRun(`bytequest:sample-job:${userId}:${target.id}`);
        setSampleRun(savedRun);
        setSampleStatus(savedRun ? "Checking saved sample run" : "");
        setHintStatus(null);
        setHintError("");
        if (target.is_completed || target.is_closed) {
          void apiRequest<{ source_code: string }>(`/pilot/activities/${target.id}/solution`)
            .then((value) => { if (active) setSolution(value.source_code || ""); })
            .catch(() => {});
        }
        void apiRequest<HintStatus>(`/pilot/activities/${target.id}/hints`).then((value) => {
          if (!active) return;
          setHintStatus(value);
          if (value.reviewed.some((hint) => hint.body) || value.ai_hints.length) setHintsOpen(true);
        }).catch((error) => { if (active) setHintError(getErrorMessage(error)); });

        const defaultCode = target.starter_code || starterCode(target.language);
        setStarter(defaultCode);

        // Restore any unsynced account-scoped backup before the server draft.
        let restoredCode = defaultCode;
        try {
          const cachedLocal = readLocalDraft(userId, target.id);
          const savedDraft = await apiRequest<{ source_code: string } | null>(`/pilot/drafts/${target.id}`);
          const serverCode = savedDraft?.source_code ?? defaultCode;
          lastSyncedCodeRef.current = serverCode;
          if (cachedLocal === serverCode) {
            try { window.localStorage.removeItem(draftKey(userId, target.id)); }
            catch { /* Storage may be blocked. */ }
          }
          restoredCode = cachedLocal ?? serverCode;
        } catch {
          const cachedLocal = readLocalDraft(userId, target.id);
          restoredCode = cachedLocal ?? defaultCode;
          latestCodeRef.current = restoredCode;
          setCode(restoredCode);
          setDraftStatus("Saved on this device only");
          setSyncState("error");
          setMessage("We couldn't load the code saved to your account. Edits stay on this device, and Run and Submit are paused until a reload loads your saved code.");
          return;
        }
        latestCodeRef.current = restoredCode;
        setCode(restoredCode);
        if (readLocalDraft(userId, target.id) !== null) {
          setDraftStatus("Recovered from this device · syncing");
          setSyncState("saved-local");
        } else {
          setDraftStatus(restoredCode !== defaultCode ? "Saved to your account" : "Starter code");
          setSyncState("synced");
        }
        setDraftLoaded(true);
      } catch (error) {
        if (active) {
          setNeedsSignIn(error instanceof ApiError && error.status === 401);
          setMessage(getErrorMessage(error));
        }
      }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [activityId, language, role, userId]);

  useEffect(() => {
    if (!questId || !draftLoaded) return;
    latestCodeRef.current = code;
    const timer = window.setTimeout(() => {
      if (savingRef.current) return;
      savingRef.current = true;
      void (async () => {
        try {
          let lastSaved = lastSyncedCodeRef.current;
          while (lastSaved !== latestCodeRef.current) {
            const next = latestCodeRef.current;
            const saved = await flushDraftToServer(next);
            if (!saved) {
              if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
              retryTimerRef.current = setTimeout(() => setRetryTick((tick) => tick + 1), 5000);
              break;
            }
            lastSaved = next;
          }
        } finally {
          savingRef.current = false;
        }
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [code, draftLoaded, questId, flushDraftToServer, retryTick]);

  function workedSeconds(): number {
    const openSegment = segmentStartRef.current === null ? 0 : Date.now() - segmentStartRef.current;
    return Math.min(86_400, Math.max(0, Math.round((workedMsRef.current + openSegment) / 1000)));
  }

  function handleCodeChange(newCode: string | undefined) {
    const updated = newCode ?? "";
    setCode(updated);
    if (questId) writeLocalDraft(userId, questId, updated);
    if (!draftLoaded) {
      setSyncState("error");
      setDraftStatus("Saved on this device only");
      return;
    }
    setSyncState("saving");
    setDraftStatus("Saving…");
  }

  function confirmResetCode() {
    setConfirmReset(false);
    handleCodeChange(starter);
    setAnnouncement("Your code was replaced with the starter code.");
  }

  async function runCode(dryRun: boolean) {
    if (!quest || !userId || !sampleKey || busy || submissionRequest.current) return;
    const request = new AbortController();
    submissionRequest.current = request;
    setSending(dryRun ? "run" : "submit");
    setSampleStatus(dryRun ? "Sending sample run" : "");
    setResult(null);
    setRunError("");
    setAiHint("");
    setAiError("");
    setCopyState("");
    setAnnouncement(dryRun ? "" : "Submitting your code for official grading.");
    try {
      const pendingKey = `bytequest:pending-job:${userId}:${quest.id}:${dryRun ? "sample" : "official"}`;
      let idempotencyKey = newRequestId();
      try {
        const previous = JSON.parse(window.sessionStorage.getItem(pendingKey) || "null") as
          { sourceCode?: string; key?: string } | null;
        if (previous?.sourceCode === code && previous.key) idempotencyKey = previous.key;
        else window.sessionStorage.setItem(pendingKey, JSON.stringify({ sourceCode: code, key: idempotencyKey }));
      } catch { /* Continue without session storage if the browser blocks it. */ }
      const accepted = await apiRequest<SubmissionJob>("/submission-jobs", {
        method: "POST",
        signal: request.signal,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          activity_id: quest.id,
          source_code: code,
          dry_run_only: dryRun,
          time_spent_seconds: workedSeconds(),
        }),
      });
      if (request.signal.aborted) return;
      if (!dryRun) {
        removeStoredRun(pendingKey);
        router.push(`/submissions/${accepted.id}`);
        return;
      }
      if (accepted.status === "queued" || accepted.status === "running") {
        const run = { key: sampleKey, id: accepted.id, sourceCode: code };
        try { window.sessionStorage.setItem(sampleKey, JSON.stringify(run)); } catch { /* Keep watching in this tab. */ }
        setSampleRun(run);
        setSampleStatus(sampleRunStatus(accepted));
      } else if (accepted.status === "completed" && accepted.result) {
        showSampleResult(accepted.result, code);
      } else {
        removeStoredRun(pendingKey);
        throw new Error(accepted.error || "Sample grading failed. Try again.");
      }
      removeStoredRun(pendingKey);
    } catch (error) {
      if (request.signal.aborted) return;
      const reason = getErrorMessage(error);
      setRunError(reason);
      setAnnouncement(`${dryRun ? "Sample run" : "Submission"} failed: ${reason}`);
    }
    finally {
      submissionRequest.current = null;
      if (!request.signal.aborted) setSending("");
    }
  }

  async function requestAiHint() {
    if (!quest || !userId || !evaluation || evaluation.is_successful) return;
    if (!navigator.onLine) {
      setAiError("AI hints need a connection. Your draft stays on this device.");
      return;
    }
    const previous = pendingHintRef.current;
    const pending = previous?.activityId === quest.id && previous.userId === userId
      ? previous
      : { activityId: quest.id, userId, key: newRequestId() };
    pendingHintRef.current = pending;
    setAiBusy(true);
    setAiError("");
    try {
      const hint = await apiRequest<{ body: string; remaining: number }>(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({ source: "ai", request_key: pending.key }),
      });
      if (pendingHintRef.current === pending) pendingHintRef.current = null;
      setAiHint(hint.body);
      setAnnouncement(`AI hint ready. ${hint.remaining} hint ${hint.remaining === 1 ? "use" : "uses"} left.`);
      try {
        setHintStatus(await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`));
        setHintError("");
      } catch (err) {
        setHintStatus(null);
        setHintError(getErrorMessage(err));
      }
    } catch (err) {
      setAiError(getErrorMessage(err));
      if (err instanceof ApiError && err.code === "exam_in_progress") {
        setHintStatus(null);
        setHintError(err.message);
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function retryHintStatus() {
    if (!quest) return;
    setHintBusy(true);
    setHintError("");
    try {
      setHintStatus(await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`));
    } catch (error) {
      setHintError(getErrorMessage(error));
    } finally {
      setHintBusy(false);
    }
  }

  async function revealReviewedHint(hintId: string) {
    if (!quest) return;
    setHintBusy(true);
    setHintError("");
    try {
      await apiRequest(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({ source: "reviewed", hint_id: hintId, request_key: newRequestId() }),
      });
      const next = await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`);
      setHintStatus(next);
      setAnnouncement(`Hint revealed. ${next.remaining} hint ${next.remaining === 1 ? "use" : "uses"} left.`);
    } catch (cause) {
      setHintError(getErrorMessage(cause));
      if (cause instanceof ApiError && cause.code === "exam_in_progress") setHintStatus(null);
      else void apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`).then(setHintStatus).catch(() => {});
    } finally {
      setHintBusy(false);
    }
  }

  const languageName = quest ? LANGUAGE_NAMES[quest.language] ?? quest.language : "";
  const monacoLanguage = quest?.language;
  const evaluation = result?.evaluation;
  const visibleResults = evaluation?.test_results?.filter((test) => !test.is_hidden) ?? [];
  const activeCase = visibleResults[activeCaseIndex] ?? visibleResults[0];
  const firstFailed = visibleResults.find((test) => !test.passed);
  const resultIsStale = Boolean(evaluation) && resultCode !== code;
  const hintsLeft = hintStatus?.remaining;
  const canViewSolution = Boolean((quest?.is_completed || quest?.is_closed) && solution);
  const codeChanged = draftLoaded && code !== starter;
  // Busy buttons stay focusable (aria-disabled) so a keyboard run keeps focus in place.
  const actionsBlocked = !draftLoaded || !code.trim();

  async function handleCopyOutput() {
    if (!activeCase) return;
    // Only the selected visible case is copied; hidden tests never reach this list.
    const parts = [`Case ${visibleResults.indexOf(activeCase) + 1}: ${caseVerdict(activeCase)}`];
    const add = (label: string, value: string | undefined) => { if (value) parts.push(`${label}:\n${value.replace(/\n+$/, "")}`); };
    add("Compiler message", activeCase.compile_output);
    add("Error message", activeCase.stderr);
    add("Input", activeCase.stdin);
    add("Expected output", activeCase.expected_stdout);
    parts.push(`Your output:\n${activeCase.stdout.replace(/\n+$/, "") || "(nothing printed)"}`);
    try {
      await navigator.clipboard.writeText(parts.join("\n\n"));
      setCopyState("copied");
      setAnnouncement("Output copied.");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState(""), 2000);
  }

  const currentActivityIndex = trackActivities.findIndex((a) => a.id === activityId);
  const prevActivity = currentActivityIndex > 0 ? trackActivities[currentActivityIndex - 1] : null;
  const nextActivity = currentActivityIndex >= 0 && currentActivityIndex < trackActivities.length - 1 ? trackActivities[currentActivityIndex + 1] : null;

  if (loading || !quest) {
    return (
      <div className="page-shell">
        {loading ? (
          <section className="panel" role="status">Loading your challenge…</section>
        ) : (
          <section className="panel">
            <p className="notice error" role="alert">{message || "This challenge could not be opened."}</p>
            <Link className="button button-primary" href={needsSignIn ? "/onboarding" : "/quests"} style={{ marginTop: 16 }}>
              {needsSignIn ? "Sign in" : "Back to quest map"}
            </Link>
          </section>
        )}
      </div>
    );
  }

  const statement = splitProblemStatement(
    quest.problem_statement || "Read the prompt and write a program that satisfies the sample and hidden test cases."
  );
  // The saved visible grading cases are what Run sample checks, so they win over examples typed into the prose.
  const samples = quest.sample_cases?.length
    ? quest.sample_cases.map((sample) => ({ input: sample.stdin, output: sample.expected_stdout }))
    : statement.samples;
  const revealedReviewed = hintStatus?.reviewed.filter((hint) => hint.body) ?? [];
  const lockedReviewed = hintStatus?.reviewed.filter((hint) => !hint.body) ?? [];
  const runBlockedReason = !draftLoaded ? "Waiting for your saved code to load." : !code.trim() ? "Write some code first." : "";

  return (
    <div className="page-shell arena-page">
      <p className="arena-sr-only" role="status" aria-live="polite">{busy === "run" ? sampleStatus : announcement}</p>
      <p className="arena-sr-only" role="status" aria-live="polite">
        {syncState === "saved-local"
          ? "Your code is saved on this device and will sync to your account when the connection returns."
          : syncState === "error"
            ? "Your code is saved on this device only. Reload to load the code saved to your account."
            : ""}
      </p>

      {/* Shown only when the layout stacks: the editor then sits below the problem. */}
      <nav className="arena-jump" aria-label="Jump to section">
        <a href="#arena-problem-title">Problem</a>
        <a href="#arena-editor">Editor</a>
        <a href="#arena-results-title">Results</a>
      </nav>

      <div className="arena-workspace">
        <section className="arena-brief" aria-labelledby="arena-title">
          <nav className="arena-nav" aria-label="Challenge navigation">
            <div className="arena-nav-steps">
              {prevActivity ? (
                <Link href={getActivityHref(prevActivity)} className="button button-outline small" aria-label={`Previous activity: ${prevActivity.title || "untitled"}`}>← Previous</Link>
              ) : (
                <button type="button" className="button button-outline small" disabled>← Previous</button>
              )}
              {nextActivity ? (
                <Link href={getActivityHref(nextActivity)} className="button button-outline small" aria-label={`Next activity: ${nextActivity.title || "untitled"}`}>Next →</Link>
              ) : (
                <button type="button" className="button button-outline small" disabled>Next →</button>
              )}
            </div>
          </nav>

          <header className="arena-head">
            <p className="eyebrow-label">Quest #{quest.position ?? quest.sequence_order} · Code challenge · {languageName}</p>
            <h1 id="arena-title">{quest.title || "Untitled challenge"}</h1>
            <ul className="arena-facts" aria-label="Challenge details">
              <li className="tag">{quest.topic_concept}</li>
              <li className="tag">Difficulty {quest.difficulty_level}</li>
              <li className="tag xp">{quest.xp_reward} XP</li>
              <li>
                {quest.is_completed ? (
                  <StatusChip state="complete" label="Completed" />
                ) : quest.is_closed ? (
                  <StatusChip state="closed" label="Closed" />
                ) : (
                  <StatusChip state="todo" tone="muted" label="Not completed yet" />
                )}
              </li>
            </ul>
            {quest.is_closed && (
              <p className="notice warning">This challenge is closed, so it can no longer be submitted for grading. You can still practise with sample runs.</p>
            )}
          </header>

          <section className="arena-section" aria-labelledby="arena-problem-title">
            <h2 id="arena-problem-title">Problem</h2>
            <div className="arena-statement">{statement.body}</div>
          </section>

          {samples.length > 0 && (
            <section className="arena-section" aria-labelledby="arena-sample-title">
              <h2 id="arena-sample-title">{samples.length === 1 ? "Example" : "Examples"}</h2>
              {samples.map((sample, index) => (
                <dl className="arena-sample" key={index}>
                  <div><dt>Input</dt><dd><pre>{sample.input || "(no input)"}</pre></dd></div>
                  <div><dt>Expected output</dt><dd><pre>{sample.output}</pre></dd></div>
                </dl>
              ))}
            </section>
          )}

          <details className="arena-disclosure" open={hintsOpen} onToggle={(event) => setHintsOpen(event.currentTarget.open)}>
            <summary>
              <span className="arena-disclosure-title">Stuck? Hints</span>
              <span className="arena-disclosure-meta">
                {hintStatus ? `${hintStatus.remaining} of ${MAX_HINTS} uses left` : hintError ? "Unavailable" : "Loading…"}
              </span>
            </summary>
            <div className="arena-disclosure-body">
              <p className="arena-help">
                Each new hint uses 1 of your {MAX_HINTS} hint uses for this challenge. Hints you have revealed stay here for free.
              </p>
              {hintStatus && (revealedReviewed.length > 0 || hintStatus.ai_hints.length > 0) && (
                <ol className="arena-hint-list" aria-label="Revealed hints">
                  {revealedReviewed.map((hint) => (
                    <li key={hint.id}><strong>Instructor hint {hint.slot}</strong><p>{hint.body}</p></li>
                  ))}
                  {hintStatus.ai_hints.map((hint) => (
                    <li key={hint.id}><strong>AI hint</strong><p>{hint.body}</p></li>
                  ))}
                </ol>
              )}
              {lockedReviewed.length > 0 && (
                <div className="arena-hint-actions">
                  {lockedReviewed.map((hint) => (
                    <button
                      key={hint.id}
                      type="button"
                      className="button button-outline small"
                      disabled={hintBusy || hintStatus?.remaining === 0}
                      onClick={() => void revealReviewedHint(hint.id)}
                    >
                      Reveal instructor hint {hint.slot}
                    </button>
                  ))}
                </div>
              )}
              {hintStatus && hintStatus.reviewed.length === 0 && hintStatus.remaining > 0 && (
                <p className="arena-help">
                  Your instructor hasn&apos;t added hints here. If a sample run fails, you can ask for an AI hint from the results.
                </p>
              )}
              {hintStatus?.remaining === 0 && (
                <p className="arena-help">You&apos;ve used all {MAX_HINTS} hint uses for this challenge.</p>
              )}
              {hintError && <p className="notice error" role="status">{hintError}</p>}
              {hintError && !hintStatus && (
                <button type="button" className="button button-outline small" disabled={hintBusy} onClick={() => void retryHintStatus()}>
                  Reload hints
                </button>
              )}
            </div>
          </details>

          {canViewSolution && (
            <details className="arena-disclosure">
              <summary>
                <span className="arena-disclosure-title">Reference solution</span>
                <span className="arena-disclosure-meta">{quest.is_completed ? "Unlocked: completed" : "Unlocked: closed"}</span>
              </summary>
              <div className="arena-disclosure-body">
                <p className="arena-help">Your instructor&apos;s solution. Compare it with your own approach.</p>
                <pre className="arena-code-block" tabIndex={0} aria-label="Reference solution code">{solution}</pre>
              </div>
            </details>
          )}
        </section>

        <section className="arena-work" id="arena-editor" aria-label="Your code">
          <div className="arena-editor-bar">
            <span className="role-pill" title="Your enrolled language">{languageName}</span>
            <span className={`arena-save ${syncState}`}>
              <span className="arena-save-dot" aria-hidden="true" />
              {draftStatus}
            </span>
            <button
              type="button"
              className="text-button arena-reset"
              onClick={() => { if (codeChanged) setConfirmReset(true); }}
              aria-disabled={!codeChanged}
              title={codeChanged ? undefined : "Your code already matches the starter code."}
            >
              Reset code
            </button>
          </div>

          {message && (
            <div className="notice error arena-load-error" role="alert">
              <span>{message}</span>
              <button type="button" className="button button-outline small" onClick={() => window.location.reload()}>Reload saved code</button>
            </div>
          )}

          <div className="arena-editor">
            {touchEditor ? (
              <textarea
                className="arena-touch-editor"
                aria-label={`${languageName} code editor for ${quest.title || "this challenge"}`}
                value={code}
                onChange={(event) => handleCodeChange(event.currentTarget.value)}
                readOnly={!draftLoaded}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                maxLength={50_000}
                wrap="off"
              />
            ) : (
              <>
                <Editor
                  height="100%"
                  language={monacoLanguage}
                  theme="vs-dark"
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    ariaLabel: `${languageName} code editor for ${quest.title || "this challenge"}`,
                    minimap: { enabled: false },
                    readOnly: !draftLoaded,
                    fontSize: 14,
                    lineHeight: 22,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    tabSize: 4,
                    automaticLayout: true,
                    wordWrap: "on",
                    padding: { top: 14, bottom: 14 },
                  }}
                />
                <p className="arena-editor-tip">Tab indents code. Press Ctrl+M (Ctrl+Shift+M on Mac), then Tab, to move out of the editor.</p>
              </>
            )}
          </div>

          <div className="arena-actions">
            <div className="arena-action">
              <button
                className="button button-outline"
                type="button"
                onClick={() => void runCode(true)}
                disabled={actionsBlocked}
                aria-disabled={busy !== ""}
                aria-describedby="arena-run-help"
                data-tooltip="Check the example test cases without recording an attempt."
              >
                {busy === "run" ? "Running…" : "Run sample"}
              </button>
              <p id="arena-run-help"><strong>Practice.</strong> Checks the example cases. No attempt recorded.</p>
            </div>
            <div className="arena-action">
              <button
                className="button button-primary"
                type="button"
                onClick={() => void runCode(false)}
                disabled={actionsBlocked || Boolean(quest.is_closed)}
                aria-disabled={busy !== ""}
                aria-describedby="arena-submit-help"
                data-tooltip={quest.is_closed ? undefined : "Check all test cases and record an official attempt."}
              >
                {busy === "submit" ? "Submitting…" : "Submit for grading"}
              </button>
              <p id="arena-submit-help">
                <strong>Official.</strong>{" "}
                {quest.is_closed
                  ? "Closed for new submissions."
                  : `Grades all tests and records an attempt. ${quest.pass_mark_percent != null && quest.pass_mark_percent < 100
                    ? `Score at least ${quest.pass_mark_percent}% to pass.`
                    : "Pass every test to complete the quest."}`}
              </p>
            </div>
            {runBlockedReason && !busy && <p className="arena-action-note">{runBlockedReason}</p>}
          </div>

          <section className="arena-results" aria-labelledby="arena-results-title" aria-busy={busy !== ""}>
            <div className="arena-results-head">
              <h2 id="arena-results-title">Results</h2>
              {activeCase && !busy && (
                <button type="button" className="text-button" onClick={() => void handleCopyOutput()}>
                  {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy output"}
                </button>
              )}
            </div>

            {busy === "run" ? (
              <p className="arena-state running"><span className="arena-spinner" aria-hidden="true" />{sampleStatus}</p>
            ) : busy === "submit" ? (
              <p className="arena-state running"><span className="arena-spinner" aria-hidden="true" />Submitting for official grading. Your results page will open next.</p>
            ) : runError ? (
              <div className="arena-verdict bad">
                <p className="arena-verdict-title"><span aria-hidden="true">!</span>Your code couldn&apos;t be run</p>
                <p className="arena-verdict-detail">{runError}</p>
                <p className="arena-verdict-detail">Your code is still saved. Try the sample run again in a moment.</p>
                <button type="button" className="button button-outline small" onClick={() => void runCode(true)} disabled={actionsBlocked}>
                  Run sample again
                </button>
              </div>
            ) : !evaluation ? (
              <p className="arena-state">Run a sample to test your code on the example cases. Your output and any error messages will appear here.</p>
            ) : (
              <>
                <div className={`arena-verdict ${evaluation.is_successful ? "good" : "bad"}`}>
                  <p className="arena-verdict-title">
                    <span aria-hidden="true">{evaluation.is_successful ? "✓" : "✕"}</span>
                    {runHeadline(evaluation, visibleResults)}
                  </p>
                  <p className="arena-verdict-detail">
                    {visibleResults.length > 0 && `${visibleResults.filter((test) => test.passed).length} of ${visibleResults.length} example cases passed · `}
                    Practice run, no attempt recorded.
                  </p>
                  <p className="arena-verdict-detail">
                    {evaluation.is_successful
                      ? "When you're ready, submit for grading. Official grading also runs hidden tests."
                      : nextStep(firstFailed)}
                  </p>
                </div>
                {resultIsStale && (
                  <p className="arena-stale">You&apos;ve changed your code since this run. Run the sample again to check the new version.</p>
                )}

                {visibleResults.length > 1 && (
                  <div className="arena-case-picker" role="group" aria-label="Choose an example case">
                    {visibleResults.map((test, index) => (
                      <button
                        key={test.order_index}
                        type="button"
                        className={`arena-case-button ${test.passed ? "passed" : "failed"}`}
                        aria-pressed={activeCase === test}
                        onClick={() => setActiveCaseIndex(index)}
                      >
                        <span aria-hidden="true">{test.passed ? "✓" : "✕"}</span>
                        Case {index + 1}
                        <span className="arena-sr-only">, {caseVerdict(test)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeCase ? (
                  <div className="arena-case">
                    <p className="arena-case-status">
                      Case {visibleResults.indexOf(activeCase) + 1}: <strong>{caseVerdict(activeCase)}</strong>
                      <span> · {activeCase.execution_time_ms} ms</span>
                    </p>
                    {activeCase.compile_output && <OutputBlock label="Compiler message" text={activeCase.compile_output} tone="error" />}
                    {activeCase.stderr && <OutputBlock label="Error message" text={activeCase.stderr} tone="error" />}
                    {activeCase.stdin && <OutputBlock label="Input" text={activeCase.stdin} />}
                    <div className="arena-compare">
                      {activeCase.expected_stdout !== undefined && (
                        <OutputBlock label="Expected output" text={activeCase.expected_stdout} empty="Nothing should be printed." />
                      )}
                      <OutputBlock label="Your output" text={activeCase.stdout} empty="Your program printed nothing." />
                    </div>
                  </div>
                ) : (
                  <p className="arena-state">No example output was returned for this run.</p>
                )}

                {!evaluation.is_successful && (
                  <div className="arena-stuck">
                    {aiHint ? (
                      <div className="arena-ai-hint">
                        <strong>AI hint</strong>
                        <p>{aiHint}</p>
                        <span className="arena-help">Saved under Hints for this challenge.</span>
                      </div>
                    ) : (
                      <>
                        <p>
                          <strong>Still stuck?</strong>{" "}
                          {hintsLeft === 0
                            ? `You've used all ${MAX_HINTS} hint uses for this challenge.`
                            : `An AI hint sends your sample code, visible diagnostics, and relevant course excerpts to Gemini. It uses 1 hint${hintsLeft !== undefined ? ` (${hintsLeft} left)` : ""}.`}
                        </p>
                        {hintsLeft !== 0 && (
                          <button
                            type="button"
                            className="button button-outline small"
                            onClick={() => void requestAiHint()}
                            disabled={aiBusy || resultIsStale}
                          >
                            {aiBusy ? "Getting hint…" : "Get an AI hint"}
                          </button>
                        )}
                      </>
                    )}
                    {aiError && <p className="notice error">{aiError}</p>}
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Replace your code?"
        confirmLabel="Replace with starter code"
        cancelLabel="Keep my code"
        tone="danger"
        onConfirm={confirmResetCode}
        onCancel={() => setConfirmReset(false)}
      >
        <p>Your current code will be replaced with the starter code. This can&apos;t be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

function runHeadline(evaluation: Evaluation, visible: EvaluationTestResult[]): string {
  if (evaluation.is_successful) {
    return visible.length > 1 ? `All ${visible.length} example cases passed` : "Example case passed";
  }
  const failedIndex = visible.findIndex((test) => !test.passed);
  if (failedIndex < 0) return "Your code did not pass the example cases";
  return `${caseVerdict(visible[failedIndex])} on case ${failedIndex + 1}`;
}
