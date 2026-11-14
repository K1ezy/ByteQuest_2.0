"use client";

import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog, StatusChip } from "@/components/workspace/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { splitProblemStatement } from "@/lib/problem-statement";
import { getSupabase } from "@/lib/supabase";
import type { Evaluation, EvaluationTestResult, Profile, Quest } from "@/lib/types";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading code editor…</div>,
});
loader.config({ paths: { vs: "/monaco/vs" } });

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
  status: "queued" | "running" | "completed" | "failed";
  result: SubmissionResponse | null;
  error: string | null;
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
  const router = useRouter();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [trackActivities, setTrackActivities] = useState<Quest[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
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
  const [busy, setBusy] = useState<"run" | "submit" | "">("");
  const [loading, setLoading] = useState(true);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiError, setAiError] = useState("");
  const [hintStatus, setHintStatus] = useState<HintStatus | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [hintError, setHintError] = useState("");
  const [hintsOpen, setHintsOpen] = useState(false);
  const [solution, setSolution] = useState("");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [copyState, setCopyState] = useState<"" | "copied" | "failed">("");
  const [confirmReset, setConfirmReset] = useState(false);

  const questId = quest?.id;
  const userId = profile?.id;

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
        const { data } = await getSupabase().auth.getSession();
        if (!data.session) {
          if (active) { setNeedsSignIn(true); setMessage("Sign in to open the coding arena."); }
          return;
        }
        const [me, activities] = await Promise.all([apiRequest<Profile>("/profile/me"), apiRequest<Quest[]>("/quests")]);
        if (!active) return;
        setProfile(me);
        if (me.role !== "student") throw new Error("Code submissions are available to student accounts.");
        setTrackActivities(activities);
        const target = activities.find((item) => item.id === activityId && item.activity_type === "challenge");
        if (!target) throw new Error("This published challenge is not available on your selected language track.");
        setQuest(target);
        if (target.is_completed || target.is_closed) {
          void apiRequest<{ source_code: string }>(`/pilot/activities/${target.id}/solution`)
            .then((value) => { if (active) setSolution(value.source_code || ""); })
            .catch(() => {});
        }
        void apiRequest<HintStatus>(`/pilot/activities/${target.id}/hints`).then((value) => {
          if (!active) return;
          setHintStatus(value);
          if (value.reviewed.some((hint) => hint.body) || value.ai_hints.length) setHintsOpen(true);
        }).catch(() => {});

        const defaultCode = target.starter_code || starterCode(me.enrolled_language);
        setStarter(defaultCode);

        // Restore any unsynced account-scoped backup before the server draft.
        let restoredCode = defaultCode;
        try {
          const cachedLocal = readLocalDraft(me.id, target.id);
          const savedDraft = await apiRequest<{ source_code: string } | null>(`/pilot/drafts/${target.id}`);
          const serverCode = savedDraft?.source_code ?? defaultCode;
          lastSyncedCodeRef.current = serverCode;
          if (cachedLocal === serverCode) {
            try { window.localStorage.removeItem(draftKey(me.id, target.id)); }
            catch { /* Storage may be blocked. */ }
          }
          restoredCode = cachedLocal ?? serverCode;
        } catch {
          const cachedLocal = readLocalDraft(me.id, target.id);
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
        if (readLocalDraft(me.id, target.id) !== null) {
          setDraftStatus("Recovered from this device · syncing");
          setSyncState("saved-local");
        } else {
          setDraftStatus(restoredCode !== defaultCode ? "Saved to your account" : "Starter code");
          setSyncState("synced");
        }
        setDraftLoaded(true);
      } catch (error) { if (active) setMessage(getErrorMessage(error)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [activityId]);

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
    if (questId && profile?.id) writeLocalDraft(profile.id, questId, updated);
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
    if (!quest || busy) return;
    setBusy(dryRun ? "run" : "submit");
    setResult(null);
    setRunError("");
    setAiHint("");
    setAiError("");
    setCopyState("");
    setAnnouncement(dryRun ? "Running your code on the sample cases." : "Submitting your code for official grading.");
    try {
      const pendingKey = `bytequest:pending-job:${quest.id}:${dryRun ? "sample" : "official"}`;
      let idempotencyKey = crypto.randomUUID();
      try {
        const previous = JSON.parse(window.sessionStorage.getItem(pendingKey) || "null") as
          { sourceCode?: string; key?: string } | null;
        if (previous?.sourceCode === code && previous.key) idempotencyKey = previous.key;
        else window.sessionStorage.setItem(pendingKey, JSON.stringify({ sourceCode: code, key: idempotencyKey }));
      } catch { /* Continue without session storage if the browser blocks it. */ }
      const accepted = await apiRequest<SubmissionJob>("/submission-jobs", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          activity_id: quest.id,
          source_code: code,
          dry_run_only: dryRun,
          time_spent_seconds: workedSeconds(),
        }),
      });
      try { window.sessionStorage.removeItem(pendingKey); } catch { /* Storage may be blocked. */ }
      if (!dryRun) {
        router.push(`/submissions/${accepted.id}`);
        return;
      }
      const ranCode = code;
      let job = accepted;
      for (let tries = 0; tries < 90 && job.status !== "completed" && job.status !== "failed"; tries++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        job = await apiRequest<SubmissionJob>(`/submission-jobs/${accepted.id}`);
      }
      if (job.status === "failed") throw new Error(job.error || "Sample run failed. Try again.");
      if (!job.result) throw new Error("Sample run is still pending. Return to this challenge shortly.");
      const response = job.result;
      const visible = response.evaluation.test_results?.filter((test) => !test.is_hidden) ?? [];
      const failedIdx = visible.findIndex((test) => !test.passed);
      setResult(response);
      setResultCode(ranCode);
      setActiveCaseIndex(Math.max(0, failedIdx));
      setAnnouncement(`Sample run finished: ${runHeadline(response.evaluation, visible)}. No attempt was recorded.`);
    } catch (error) {
      const reason = getErrorMessage(error);
      setRunError(reason);
      setAnnouncement(`${dryRun ? "Sample run" : "Submission"} failed: ${reason}`);
    }
    finally { setBusy(""); }
  }

  async function requestAiHint() {
    if (!quest || !evaluation || evaluation.is_successful) return;
    if (!navigator.onLine) {
      setAiError("AI hints need an internet connection. Your code and sample runs still work offline.");
      return;
    }
    setAiBusy(true);
    setAiError("");
    try {
      const hint = await apiRequest<{ body: string; remaining: number }>(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({ source: "ai", request_key: crypto.randomUUID() }),
      });
      setAiHint(hint.body);
      setAnnouncement(`AI hint ready. ${hint.remaining} hint ${hint.remaining === 1 ? "use" : "uses"} left.`);
      setHintStatus(await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`));
    } catch (err) {
      setAiError(getErrorMessage(err));
    } finally {
      setAiBusy(false);
    }
  }

  async function revealReviewedHint(hintId: string) {
    if (!quest) return;
    setHintBusy(true);
    setHintError("");
    setHintStatus((prev) => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : prev);
    try {
      await apiRequest(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({ source: "reviewed", hint_id: hintId, request_key: crypto.randomUUID() }),
      });
      const next = await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`);
      setHintStatus(next);
      setAnnouncement(`Hint revealed. ${next.remaining} hint ${next.remaining === 1 ? "use" : "uses"} left.`);
    } catch (cause) {
      setHintError(getErrorMessage(cause));
      void apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`).then(setHintStatus).catch(() => {});
    } finally {
      setHintBusy(false);
    }
  }

  const language = profile?.enrolled_language || "python";
  const languageName = LANGUAGE_NAMES[language] ?? language;
  const monacoLanguage = language === "cpp" ? "cpp" : language;
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
  const revealedReviewed = hintStatus?.reviewed.filter((hint) => hint.body) ?? [];
  const lockedReviewed = hintStatus?.reviewed.filter((hint) => !hint.body) ?? [];
  const runBlockedReason = !draftLoaded ? "Waiting for your saved code to load." : !code.trim() ? "Write some code first." : "";

  return (
    <div className="page-shell arena-page">
      <p className="arena-sr-only" role="status" aria-live="polite">{announcement}</p>
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
            <p className="eyebrow-label">Code challenge · {languageName}</p>
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

          {statement.samples.length > 0 && (
            <section className="arena-section" aria-labelledby="arena-sample-title">
              <h2 id="arena-sample-title">{statement.samples.length === 1 ? "Example" : "Examples"}</h2>
              {statement.samples.map((sample, index) => (
                <dl className="arena-sample" key={index}>
                  <div><dt>Input</dt><dd><pre>{sample.input}</pre></dd></div>
                  <div><dt>Expected output</dt><dd><pre>{sample.output}</pre></dd></div>
                </dl>
              ))}
            </section>
          )}

          <details className="arena-disclosure" open={hintsOpen} onToggle={(event) => setHintsOpen(event.currentTarget.open)}>
            <summary>
              <span className="arena-disclosure-title">Stuck? Hints</span>
              <span className="arena-disclosure-meta">
                {hintStatus ? `${hintStatus.remaining} of ${MAX_HINTS} uses left` : "Loading…"}
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
              {hintError && <p className="notice error">{hintError}</p>}
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
            <Editor
              height="100%"
              language={monacoLanguage}
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              options={{
                ariaLabel: `${languageName} code editor for ${quest.title || "this challenge"}`,
                minimap: { enabled: false },
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
              >
                {busy === "submit" ? "Submitting…" : "Submit for grading"}
              </button>
              <p id="arena-submit-help">
                <strong>Official.</strong>{" "}
                {quest.is_closed
                  ? "Closed for new submissions."
                  : quest.is_completed
                    ? "Records an attempt. You already earned this XP."
                    : "Grades all tests and records an attempt."}
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
              <p className="arena-state running"><span className="arena-spinner" aria-hidden="true" />Running your code on the example cases. This usually takes a few seconds.</p>
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
                            : `An AI hint looks at this run and suggests where to look. It uses 1 hint${hintsLeft !== undefined ? ` (${hintsLeft} left)` : ""}.`}
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
