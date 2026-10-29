"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { ErrorExplanation, Evaluation, Profile, Quest } from "@/lib/types";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading code editor…</div>,
});

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
  new_total_xp?: number;
  new_level?: number;
  new_badges_unlocked?: string[];
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

function starterCode(language: string): string {
  if (language === "cpp") return '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n';
  if (language === "java") return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n';
  return "# Write your solution here\n";
}

function getActivityHref(quest: Quest): string {
  return quest.activity_type === "quiz" ? `/quiz/${quest.id}` : `/arena/${quest.id}`;
}

export default function Arena({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [trackActivities, setTrackActivities] = useState<Quest[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState("");
  type SyncState = "synced" | "saving" | "offline-local" | "saved-local" | "error";
  const [syncState, setSyncState] = useState<SyncState>("synced");
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showSolution, setShowSolution] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Loading draft…");
  const latestCodeRef = useRef("");
  const lastSyncedCodeRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | "">("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [aiExplaining, setAiExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<ErrorExplanation | null>(null);
  const [aiError, setAiError] = useState("");
  const [hintStatus, setHintStatus] = useState<HintStatus | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [solution, setSolution] = useState("");
  const [terminalView, setTerminalView] = useState<"console" | "testcases">("console");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [terminalCleared, setTerminalCleared] = useState(false);
  const [terminalCopied, setTerminalCopied] = useState(false);
  const [terminalError, setTerminalError] = useState("");
  const initialStarterCodeRef = useRef("");

  const questId = quest?.id;
  const userId = profile?.id;

  const flushDraftToServer = useCallback(
    async (nextCode: string) => {
      if (!questId || !userId) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncState("offline-local");
        setDraftStatus("Offline — saved to device");
        return;
      }

      setSyncState("saving");
      setDraftStatus("Saving draft…");
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
        const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setSyncState("synced");
        setDraftStatus(`Synced to server at ${nowStr}`);
      } catch {
        setSyncState("saved-local");
        setDraftStatus("Saved locally");
      }
    },
    [userId, questId]
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState("offline-local");
      setDraftStatus("Offline — saved to device");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (!data.session) { if (active) setMessage("Sign in to open the coding arena."); return; }
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
          if (active) setHintStatus(value);
        }).catch(() => {});

        const defaultCode = target.starter_code || starterCode(me.enrolled_language);
        initialStarterCodeRef.current = defaultCode;

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
          if (cachedLocal !== null) {
            setDraftStatus("Saved locally — syncing to your account");
            setSyncState("saved-local");
          }
        } catch {
          const cachedLocal = readLocalDraft(me.id, target.id);
          restoredCode = cachedLocal ?? defaultCode;
          latestCodeRef.current = restoredCode;
          setCode(restoredCode);
          setDraftStatus("Could not load server draft — refresh to retry");
          setSyncState("error");
          setIsError(true);
          setMessage("Your edits are saved on this device. Refresh when the connection returns to load your server draft before syncing.");
          return;
        }
        latestCodeRef.current = restoredCode;
        setCode(restoredCode);
        if (readLocalDraft(me.id, target.id) !== null) {
          setDraftStatus("Saved locally — syncing to your account");
          setSyncState("saved-local");
        } else if (restoredCode !== defaultCode) {
          const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          setDraftStatus(`Synced to server at ${nowStr}`);
          setSyncState("synced");
        } else {
          setDraftStatus("Synced to server");
          setSyncState("synced");
        }
        setDraftLoaded(true);
      } catch (error) { if (active) { setIsError(true); setMessage(getErrorMessage(error)); } }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [activityId]);

  useEffect(() => {
    if (!questId || !draftLoaded || !isOnline) return;
    latestCodeRef.current = code;
    const timer = window.setTimeout(() => {
      if (savingRef.current) return;
      savingRef.current = true;
      void (async () => {
        try {
          let lastSaved = lastSyncedCodeRef.current;
          while (lastSaved !== latestCodeRef.current) {
            const next = latestCodeRef.current;
            await flushDraftToServer(next);
            lastSaved = next;
          }
        } finally {
          savingRef.current = false;
        }
      })();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [code, draftLoaded, isOnline, questId, flushDraftToServer]);

  function handleCodeChange(newCode: string | undefined) {
    const updated = newCode ?? "";
    setCode(updated);
    if (questId && profile?.id) writeLocalDraft(profile.id, questId, updated);
    if (!draftLoaded) {
      setSyncState("error");
      setDraftStatus("Saved on this device — refresh to load server draft");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncState("offline-local");
      setDraftStatus("Offline — saved to device");
    } else {
      setSyncState("saving");
      setDraftStatus("Saving draft…");
    }
  }

  function handleResetCode() {
    if (!initialStarterCodeRef.current) return;
    setCode(initialStarterCodeRef.current);
    if (questId && userId) writeLocalDraft(userId, questId, initialStarterCodeRef.current);
  }

  async function runCode(dryRun: boolean) {
    if (!quest) return;
    setBusy(dryRun ? "run" : "submit"); setMessage(""); setIsError(false); setResult(null);
    setAiExplanation(null);
    setAiError("");
    setTerminalCleared(false);
    setTerminalError("");
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
        body: JSON.stringify({ activity_id: quest.id, source_code: code, dry_run_only: dryRun }),
      });
      try { window.sessionStorage.removeItem(pendingKey); } catch { /* Storage may be blocked. */ }
      if (!dryRun) {
        router.push(`/submissions/${accepted.id}`);
        return;
      }
      let job = accepted;
      for (let tries = 0; tries < 90 && job.status !== "completed" && job.status !== "failed"; tries++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        job = await apiRequest<SubmissionJob>(`/submission-jobs/${accepted.id}`);
      }
      if (job.status === "failed") throw new Error(job.error || "Sample run failed. Try again.");
      if (!job.result) throw new Error("Sample run is still pending. Return to this challenge shortly.");
      const response = job.result;
      setResult(response);
      const failedIdx = response.evaluation.test_results?.findIndex((t) => !t.passed && !t.is_hidden) ?? -1;
      if (failedIdx >= 0) {
        setActiveCaseIndex(failedIdx);
      } else {
        setActiveCaseIndex(0);
      }
      if (dryRun) {
        setMessage("Sample run finished. It did not create an attempt.");
      } else {
        const completionMessage = response.evaluation.is_successful
          ? response.xp_awarded
            ? `Challenge complete: +${response.xp_awarded} XP.`
            : "Challenge passed. Completion XP was already awarded on an earlier attempt."
          : "No XP awarded. Review the visible results and try again.";
        setMessage(`Submission ${response.attempt_number} saved. ${completionMessage}`);
        if (response.new_total_xp !== undefined || response.new_level !== undefined) {
          setProfile((current) => current ? {
            ...current,
            xp_points: response.new_total_xp ?? current.xp_points,
            current_level: response.new_level ?? current.current_level,
          } : current);
        }
        if (response.evaluation.is_successful) {
          setQuest((current) => current ? { ...current, is_completed: true } : current);
        }
      }
    } catch (error) {
      const reason = getErrorMessage(error);
      setIsError(true);
      setMessage(reason);
      setTerminalError(reason);
    }
    finally { setBusy(""); }
  }

  async function requestErrorExplanation() {
    if (!quest || !evaluation || evaluation.is_successful) return;
    setAiExplaining(true);
    setAiError("");
    try {
      const hint = await apiRequest<{ body: string; remaining: number }>(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({
          source: "ai", request_key: crypto.randomUUID(),
        }),
      });
      setAiExplanation({ title: "A guiding hint", summary: hint.body,
        concept_explanation: "Use this clue to inspect your own approach.",
        hints: [hint.body], pedagogical_tip: "Try another sample run after making a change." });
      setHintStatus(await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`));
    } catch (err) {
      setAiError(getErrorMessage(err));
    } finally {
      setAiExplaining(false);
    }
  }

  async function revealReviewedHint(hintId: string) {
    if (!quest) return;
    setHintBusy(true);
    setAiError("");
    setHintStatus((prev) =>
      prev
        ? {
            ...prev,
            remaining: Math.max(0, prev.remaining - 1),
          }
        : prev
    );
    try {
      await apiRequest(`/pilot/activities/${quest.id}/hints/reveal`, {
        method: "POST",
        body: JSON.stringify({ source: "reviewed", hint_id: hintId, request_key: crypto.randomUUID() }),
      });
      setHintStatus(await apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`));
    } catch (cause) {
      setAiError(getErrorMessage(cause));
      void apiRequest<HintStatus>(`/pilot/activities/${quest.id}/hints`).then(setHintStatus).catch(() => {});
    } finally {
      setHintBusy(false);
    }
  }

  const maxHints = 5;
  const hintsUsed = hintStatus ? Math.max(0, maxHints - hintStatus.remaining) : 0;
  const canViewSolution = Boolean((quest?.is_completed || quest?.is_closed) && solution);

  const language = profile?.enrolled_language || "python";
  const monacoLanguage = language === "cpp" ? "cpp" : language;
  const evaluation = result?.evaluation;
  const visibleResults = evaluation?.test_results?.filter((test) => !test.is_hidden) ?? [];
  const hiddenTestsRan = Boolean(evaluation && result?.mode === "official_submit" && evaluation.total_test_cases > visibleResults.length);

  function getShellCommand(lang: string): string {
    if (lang === "cpp") return "g++ -O2 solution.cpp -o solution && ./solution";
    if (lang === "java") return "javac Main.java && java Main";
    return "python3 solution.py";
  }

  function handleCopyTerminal() {
    const activeCase = visibleResults[activeCaseIndex] || visibleResults[0];
    let text = `$ ${getShellCommand(language)}\n`;
    if (terminalError) text += `[Run failed]\n${terminalError}\n\n`;
    if (activeCase) {
      if (activeCase.stdin) text += `[Input (stdin)]\n${activeCase.stdin}\n\n`;
      if (activeCase.stdout) text += `[Standard Output (stdout)]\n${activeCase.stdout}\n\n`;
      if (activeCase.stderr) text += `[Standard Error (stderr)]\n${activeCase.stderr}\n\n`;
      if (activeCase.compile_output) text += `[Compiler Diagnostics]\n${activeCase.compile_output}\n\n`;
      text += `[Status: ${activeCase.status_description} | Time: ${activeCase.execution_time_ms}ms | Memory: ${activeCase.memory_used_kb}KB]\n`;
    } else {
      text += `ByteQuest Interactive Sandbox [v2.0]\nRuntime: ${language.toUpperCase()}\nStatus: Ready to execute\n`;
    }
    void navigator.clipboard.writeText(text);
    setTerminalCopied(true);
    setTimeout(() => setTerminalCopied(false), 2000);
  }

  // Compute activity navigation in the student track
  const currentActivityIndex = trackActivities.findIndex((a) => a.id === activityId);
  const prevActivity = currentActivityIndex > 0 ? trackActivities[currentActivityIndex - 1] : null;
  const nextActivity = currentActivityIndex >= 0 && currentActivityIndex < trackActivities.length - 1 ? trackActivities[currentActivityIndex + 1] : null;

  return (
    <div className="page-shell">
      {/* Offline/Network Reconnect Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="assertive"
          className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-xs"
        >
          <span>Connection lost — your code is being saved safely on this device and will sync automatically when reconnected.</span>
          <span className="font-mono uppercase font-bold text-[10px] tracking-wider bg-amber-200/80 px-2 py-0.5 rounded">
            Offline Mode
          </span>
        </div>
      )}

      {/* Top Activity Navigation Bar */}
      <nav className="activity-topbar" aria-label="Activity navigation">
        <Link href="/quests" className="button button-quiet small">
          ← Back to quest map
        </Link>
        <div className="activity-nav-group">
          {prevActivity ? (
            <Link href={getActivityHref(prevActivity)} className="button button-outline small">
              ← Previous activity
            </Link>
          ) : (
            <button type="button" className="button button-outline small" disabled>
              ← Previous activity
            </button>
          )}
          {nextActivity ? (
            <Link href={getActivityHref(nextActivity)} className="button button-outline small">
              Next activity →
            </Link>
          ) : (
            <button type="button" className="button button-outline small" disabled>
              Next activity →
            </button>
          )}
        </div>
      </nav>

      <div className="page-heading">
        <div>
          <p className="eyebrow-label">CODING ARENA · {language.toUpperCase()}</p>
          <h1>{quest?.title || "Your coding challenge"}</h1>
          <p>{quest ? `${quest.topic_concept} · ${quest.xp_reward} XP on first completion` : "Write, run a sample, then submit your solution."}</p>
        </div>
        {quest && (
          <div className="quest-meta" style={{ margin: 0 }}>
            <span className="tag">{quest.topic_concept}</span>
            <span className="tag">Difficulty {quest.difficulty_level}</span>
            <span className="tag xp">✦ {quest.xp_reward} XP</span>
            {quest.is_completed && <span className="completion">✓ Completed</span>}
          </div>
        )}
      </div>

      {loading ? (
        <section className="panel" role="status">Loading your challenge…</section>
      ) : message && !quest ? (
        <section className="panel">
          <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>
          <Link className="button button-primary" href="/onboarding">Sign in</Link>
        </section>
      ) : quest && (
        <div className="arena-layout">
          <section className="panel problem-panel">
            <div className="quest-meta">
              <span className="tag">{quest.topic_concept}</span>
              <span className="tag">Difficulty {quest.difficulty_level}</span>
              <span className="tag xp">✦ {quest.xp_reward} XP</span>
            </div>
            <h2>Problem</h2>
            <div className="problem-text">{quest.problem_statement || "Read the prompt and write a program that satisfies the sample and hidden test cases."}</div>
            <div className="divider" style={{ margin: "22px 0" }} />
            <div className="callout">
              <h3>Submissions & Grading</h3>
              <p>Run sample checks as often as you like with sample test cases. Official submissions evaluate the complete test suite and record your progress.</p>
            </div>
            {quest.is_closed && <p className="notice warning" role="status">This challenge is closed for new submissions.</p>}

            {/* Guarded Reference Solution Display */}
            {canViewSolution && (
              <div className="pilot-card" style={{ marginTop: 14 }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#156046]">Instructor Reference Solution</h3>
                  <button
                    type="button"
                    onClick={() => setShowSolution((v) => !v)}
                    className="button button-outline small"
                  >
                    {showSolution ? "Hide Solution" : "View Reference Solution"}
                  </button>
                </div>
                <p className="text-xs text-slate-600">Unlocked after completing the challenge or instructor release.</p>
                {showSolution && (
                  <pre className="mono mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-100">
                    {solution}
                  </pre>
                )}
              </div>
            )}

            {/* Progressive Hints Panel with Counter */}
            <div className="pilot-card" style={{ marginTop: 18 }}>
              <div className="flex items-center justify-between mb-2">
                <h3>Guiding hints</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  💡 Hints ({hintsUsed} / {maxHints})
                </span>
              </div>
              <p>{hintStatus ? `${hintStatus.remaining} of ${maxHints} uses left` : "Loading hint availability…"}. Revealed hints stay available for free.</p>
              {hintStatus?.reviewed.map((hint) => <div key={hint.id} className="row">
                <strong>Instructor hint {hint.slot}</strong>
                {hint.body ? <p>{hint.body}</p> : <button type="button" className="button button-outline small"
                  disabled={hintBusy || hintStatus.remaining === 0 || hintsUsed >= maxHints}
                  onClick={() => void revealReviewedHint(hint.id)}>Reveal hint</button>}
              </div>)}
              {hintStatus?.ai_hints.map((hint) => <p key={hint.id} className="notice">AI hint: {hint.body}</p>)}
              {aiError && <p className="notice error" role="alert">{aiError}</p>}
            </div>
          </section>

          <section className="panel">
            <div className="editor-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="role-pill">{language}</span>
                {/* Live Synced Draft Status Pill */}
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      syncState === "synced"
                        ? "bg-emerald-600"
                        : syncState === "saving"
                        ? "bg-amber-500 animate-pulse"
                        : syncState === "offline-local"
                        ? "bg-amber-600"
                        : "bg-slate-400"
                    }`}
                  />
                  <span className="font-semibold text-slate-700">{draftStatus}</span>
                </div>
              </div>
              <button type="button" className="text-button" style={{ fontSize: "var(--text-xs)" }} onClick={handleResetCode}>
                Reset to starter code
              </button>
            </div>


            <div className="editor-frame">
              <Editor
                height="440px"
                language={monacoLanguage}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 22,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                  automaticLayout: true,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                }}
              />
            </div>

            <div className="editor-actions">
              <button
                className="button button-outline"
                type="button"
                onClick={() => void runCode(true)}
                disabled={!draftLoaded || busy !== "" || !code.trim()}
              >
                {busy === "run" ? "Running sample…" : "Run sample"}
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void runCode(false)}
                disabled={!draftLoaded || busy !== "" || !code.trim() || Boolean(quest.is_closed)}
              >
                {busy === "submit" ? "Grading…" : "Submit for grading"}
              </button>
            </div>

            {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}{syncState === "error" && <button type="button" className="button button-outline small" onClick={() => window.location.reload()}>Retry loading draft</button>}</p>}

            {evaluation && (
              <>
                <div className="evaluation-summary">
                  <span className={`tag ${evaluation.is_successful ? "pass" : ""}`}>
                    {evaluation.is_successful ? "PASS" : "NEEDS WORK"}
                  </span>
                  <span className="tag">{evaluation.passed_test_cases}/{evaluation.total_test_cases} tests passed</span>
                  <span className="tag">{Number(evaluation.score_percentage).toFixed(1)}%</span>
                  {result?.attempt_number && <span className="tag">Attempt #{result.attempt_number}</span>}
                  {result?.xp_awarded !== undefined && <span className="tag xp">+{result.xp_awarded} XP</span>}
                </div>
                {hiddenTestsRan && (
                  <p className="hidden-test-note">
                    Hidden tests were included in the official score. Their inputs and individual results stay private.
                  </p>
                )}
              </>
            )}

            {/* Interactive Code Sandbox Terminal */}
            <div className="sandbox-terminal" role="region" aria-label="Interactive Sandbox Terminal">
              <div className="terminal-header">
                <div className="terminal-left-group">
                  <div className="terminal-title-bar">
                    <span className="terminal-prompt-icon" aria-hidden="true" data-tooltip="Code output and test results appear here.">&gt;_</span>
                    <span>TERMINAL OUTPUT</span>
                  </div>

                  {busy ? (
                    <span className="terminal-status-badge running">
                      <span className="pulse-dot" /> Executing in sandbox…
                    </span>
                  ) : terminalError ? (
                    <span className="terminal-status-badge failed">✕ Run failed</span>
                  ) : evaluation ? (
                    evaluation.is_successful ? (
                      <span className="terminal-status-badge passed">✓ All Sample Cases Passed</span>
                    ) : (
                      <span className="terminal-status-badge failed">
                        ✕ {evaluation.dominant_error_category === "syntax_error"
                          ? "Compilation Error"
                          : evaluation.dominant_error_category === "timeout"
                          ? "Time Limit Exceeded"
                          : evaluation.dominant_error_category === "runtime_error"
                          ? "Runtime Error"
                          : "Test Failed"}
                      </span>
                    )
                  ) : (
                    <span className="terminal-status-badge idle">● Ready</span>
                  )}
                </div>

                <div className="terminal-controls">
                  <div className="terminal-view-tabs" role="tablist" aria-label="Terminal views">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={terminalView === "console"}
                      className={`terminal-view-tab ${terminalView === "console" ? "is-active" : ""}`}
                      onClick={() => setTerminalView("console")}
                    >
                      &gt;_ Console
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={terminalView === "testcases"}
                      className={`terminal-view-tab ${terminalView === "testcases" ? "is-active" : ""}`}
                      onClick={() => setTerminalView("testcases")}
                    >
                      📋 Test Cases ({visibleResults.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    className="terminal-btn"
                    onClick={handleCopyTerminal}
                    data-tooltip="Copy the terminal output to your clipboard."
                    disabled={!evaluation && !busy && !terminalError}
                  >
                    {terminalCopied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="terminal-btn"
                    onClick={() => setTerminalCleared(true)}
                    data-tooltip="Clear the visible terminal output."
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Sample Test Case Subtabs when multiple cases exist */}
              {terminalView === "console" && visibleResults.length > 1 && !terminalCleared && (
                <div className="terminal-case-tabs" role="tablist" aria-label="Sample test case tabs">
                  {visibleResults.map((test, idx) => (
                    <button
                      key={test.order_index}
                      type="button"
                      role="tab"
                      aria-selected={activeCaseIndex === idx}
                      className={`case-tab-btn ${activeCaseIndex === idx ? "is-active" : ""}`}
                      onClick={() => setActiveCaseIndex(idx)}
                    >
                      <span className={`case-indicator-dot ${test.passed ? "passed" : "failed"}`} />
                      Case {test.order_index} {test.passed ? "✓" : "✕"}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCaseIndex === -1}
                    className={`case-tab-btn ${activeCaseIndex === -1 ? "is-active" : ""}`}
                    onClick={() => setActiveCaseIndex(-1)}
                  >
                    All Cases View
                  </button>
                </div>
              )}

              {/* Terminal Screen Output */}
              {terminalView === "console" ? (
                <div className="terminal-screen" tabIndex={0} aria-live="polite">
                  {busy ? (
                    <div className="terminal-running-state">
                      <div className="terminal-cmd-line">$ {getShellCommand(language)}</div>
                      <div className="terminal-stream-msg">
                        <span className="terminal-spinner" /> Compiling and executing in isolated Judge0 sandbox…
                      </div>
                    </div>
                  ) : terminalCleared ? (
                    <div className="terminal-idle-state">
                      <div className="terminal-cmd-line">$ clear</div>
                      <div className="terminal-idle-msg">Console cleared. Click &quot;Run sample&quot; or &quot;Submit for grading&quot; to execute code.</div>
                    </div>
                  ) : terminalError ? (
                    <div className="terminal-failure-state" role="alert">
                      <div className="terminal-cmd-line">$ {getShellCommand(language)}</div>
                      <div className="terminal-stream-block">
                        <span className="terminal-stream-label error">Run failed — no output was returned</span>
                        <pre className="terminal-stream-stderr">{terminalError}</pre>
                      </div>
                      <div className="terminal-failure-hint">
                        Your draft is saved. Check the service notice above, then run the sample again.
                      </div>
                      <button
                        type="button"
                        className="terminal-btn"
                        onClick={() => void runCode(true)}
                        disabled={busy !== ""}
                      >
                        Run sample again
                      </button>
                    </div>
                  ) : !evaluation ? (
                    <div className="terminal-idle-state">
                      <div className="terminal-banner-title">ByteQuest Interactive Sandbox [v2.0]</div>
                      <div className="terminal-banner-sub">Target Runtime: {language.toUpperCase()} ({monacoLanguage})</div>
                      <div className="terminal-cmd-line">$ ready</div>
                      <div className="terminal-idle-msg">
                        • Press &quot;Run sample&quot; to test your code against visible sample inputs.<br />
                        • Output from print(), cout, or System.out statements will appear here.<br />
                        • If an error or exception occurs, your printed output and traceback will be clearly displayed here for debugging.
                      </div>
                    </div>
                  ) : visibleResults.length === 0 ? (
                    <div>
                      <div className="terminal-cmd-line">$ {getShellCommand(language)}</div>
                      <div className="terminal-stream-empty">No visible test outputs returned.</div>
                    </div>
                  ) : (
                    <div className="terminal-output-container">
                      {(activeCaseIndex === -1 ? visibleResults : [visibleResults[activeCaseIndex] || visibleResults[0]]).map((testCase) => (
                        <div key={testCase.order_index} className="terminal-case-block">
                          {visibleResults.length > 1 && (
                            <div className="terminal-case-header-divider">
                              ─── Sample Case {testCase.order_index} [{testCase.status_description}] ───
                            </div>
                          )}

                          <div className="terminal-cmd-line">
                            $ {getShellCommand(language)} {testCase.stdin ? "< input.txt" : ""}
                          </div>

                          {testCase.stdin && (
                            <div className="terminal-stream-block">
                              <span className="terminal-stream-label">Standard Input (stdin)</span>
                              <pre className="terminal-stream-stdin">{testCase.stdin}</pre>
                            </div>
                          )}

                          {/* Stdout (What the student printed) */}
                          <div className="terminal-stream-block">
                            <span className="terminal-stream-label">Standard Output (stdout)</span>
                            {testCase.stdout ? (
                              <pre className="terminal-stream-stdout">{testCase.stdout}</pre>
                            ) : (
                              <div className="terminal-stream-empty">
                                [No standard output was printed by your program]
                              </div>
                            )}
                          </div>

                          {/* Stderr (Traceback / Runtime Error) */}
                          {testCase.stderr && (
                            <div className="terminal-stream-block">
                              <span className="terminal-stream-label error">Standard Error / Traceback (stderr)</span>
                              <pre className="terminal-stream-stderr">{testCase.stderr}</pre>
                            </div>
                          )}

                          {/* Compile Output (Compilation Diagnostics) */}
                          {testCase.compile_output && (
                            <div className="terminal-stream-block">
                              <span className="terminal-stream-label error">Compiler Diagnostics</span>
                              <pre className="terminal-stream-compile">{testCase.compile_output}</pre>
                            </div>
                          )}

                          {/* Evaluation comparison if Wrong Answer */}
                          {!testCase.passed && !testCase.stderr && !testCase.compile_output && (
                            <div className="terminal-comparison-box">
                              <span className="terminal-stream-label warning">Test Case Mismatch</span>
                              <div className="comparison-row">
                                <span className="comp-label">Expected:</span>
                                <code>{testCase.expected_stdout || "<expected value not specified>"}</code>
                              </div>
                              <div className="comparison-row">
                                <span className="comp-label">Actual:</span>
                                <code>{testCase.stdout || "<no output>"}</code>
                              </div>
                            </div>
                          )}

                          {/* Process completed metrics */}
                          <div className="terminal-meta-footer">
                            <span>
                              {testCase.passed ? "✓ Status: Accepted" : `✕ Status: ${testCase.status_description}`}
                            </span>
                            <span>Time: {testCase.execution_time_ms}ms</span>
                            <span>Memory: {testCase.memory_used_kb} KB</span>
                          </div>
                        </div>
                      ))}

                      {/* Error Alert inside terminal */}
                      {!evaluation.is_successful && (
                        <div className="terminal-error-callout" role="alert">
                          <div className="terminal-error-callout-text">
                            <strong>Execution Error Detected:</strong> Review your printed output and traceback above.
                          </div>
                          {!aiExplanation && (
                            <button
                              type="button"
                              className="terminal-inline-help-btn"
                              onClick={() => void requestErrorExplanation()}
                              disabled={aiExplaining}
                            >
                              {aiExplaining ? "Analyzing…" : "Learn about error"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Test Cases structured view */
                <div className="terminal-testcases-view">
                  <ol className="test-results" aria-label="Visible test results">
                    {visibleResults.map((test) => (
                      <li className={`test-result ${test.passed ? "passed" : "failed"}`} key={`${test.order_index}-${test.status_description}`}>
                        <div className="test-result-heading">
                          <strong>Sample Case {test.order_index}</strong>
                          <span>{test.status_description}</span>
                        </div>
                        {test.stdin && (
                          <div className="test-case-detail-row">
                            <span className="muted-label">Input:</span>
                            <code>{test.stdin}</code>
                          </div>
                        )}
                        {test.expected_stdout && (
                          <div className="test-case-detail-row">
                            <span className="muted-label">Expected:</span>
                            <code>{test.expected_stdout}</code>
                          </div>
                        )}
                        <div className="test-case-detail-row">
                          <span className="muted-label">Your Output:</span>
                          <code>{test.stdout || "(empty)"}</code>
                        </div>
                        {(test.stderr || test.compile_output) && (
                          <pre>{test.compile_output || test.stderr}</pre>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {evaluation && !evaluation.is_successful && (
              <div className="ai-tutor-container">
                {!aiExplanation && (
                  <div className="ai-tutor-trigger-card">
                    <div className="ai-tutor-trigger-info">
                      <span className="ai-tutor-pill">✦ AI Debugging Tutor</span>
                      <h4>Stuck on this error?</h4>
                      <p>Ask Gemini to analyze your code and explain the issue in plain terms, with guiding hints to help you fix it.</p>
                    </div>
                    <button
                      type="button"
                      className="button button-primary ai-tutor-btn"
                      onClick={() => void requestErrorExplanation()}
                      disabled={aiExplaining}
                      data-label="Learn about the errror with Gemini"
                    >
                      {aiExplaining ? "Analyzing your code…" : "Learn about the error with Gemini"}
                    </button>
                  </div>
                )}

                {aiError && (
                  <p className="notice error" style={{ marginTop: 12 }}>
                    {aiError}
                  </p>
                )}

                {aiExplanation && (
                  <section className="ai-tutor-panel" aria-label="AI Tutor Explanation">
                    <div className="ai-tutor-header">
                      <div className="ai-tutor-pill">
                        <span>✦</span> ByteQuest AI Tutor
                      </div>
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: "var(--text-xs)" }}
                        onClick={() => void requestErrorExplanation()}
                        disabled={aiExplaining}
                        data-tooltip="Ask the AI tutor to explain this error again."
                      >
                        {aiExplaining ? "Refreshing…" : "↻ Re-explain"}
                      </button>
                    </div>

                    <h3 className="ai-tutor-title">{aiExplanation.title}</h3>
                    <p className="ai-tutor-summary">{aiExplanation.summary}</p>

                    <div className="ai-tutor-section">
                      <span className="ai-tutor-section-label">Why this happens in {language.toUpperCase()}</span>
                      <p>{aiExplanation.concept_explanation}</p>
                    </div>

                    <div className="ai-tutor-section">
                      <span className="ai-tutor-section-label">Guiding Hints to Fix It</span>
                      <ol className="ai-tutor-hints">
                        {aiExplanation.hints.map((hint, idx) => (
                          <li key={idx}>
                            <span className="hint-num">{idx + 1}</span>
                            <span className="hint-text">{hint}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {aiExplanation.pedagogical_tip && (
                      <div className="ai-tutor-tip">
                        <strong>Concept Tip:</strong> {aiExplanation.pedagogical_tip}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {result?.new_badges_unlocked?.length ? (
        <section className="panel badge-unlocks" aria-live="polite">
          <h2>New badge{result.new_badges_unlocked.length === 1 ? "" : "s"} unlocked</h2>
          <p>{result.new_badges_unlocked.join(" · ")}</p>
        </section>
      ) : null}

      {profile && (
        <p className="footer-note">
          Signed in as {profile.pseudonym_id} · Level {profile.current_level} · {profile.xp_points} XP · Your code is saved safely with official attempts.
        </p>
      )}
    </div>
  );
}
