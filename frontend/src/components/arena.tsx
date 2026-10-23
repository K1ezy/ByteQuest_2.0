"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Evaluation, Profile, Quest } from "@/lib/types";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading code editor…</div>,
});

interface SubmissionResponse {
  mode: string;
  attempt_id?: string;
  attempt_number?: number;
  xp_awarded?: number;
  new_total_xp?: number;
  evaluation: Evaluation;
}

function starterCode(language: string): string {
  if (language === "cpp") return '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n';
  if (language === "java") return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n';
  return "# Write your solution here\n";
}

export default function Arena({ activityId }: { activityId: string }) {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<SubmissionResponse | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | "">("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
        const target = activities.find((item) => item.id === activityId && item.activity_type === "challenge");
        if (!target) throw new Error("This published challenge is not available on your selected language track.");
        setQuest(target); setCode(target.starter_code || starterCode(me.enrolled_language));
      } catch (error) { if (active) { setIsError(true); setMessage(getErrorMessage(error)); } }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [activityId]);

  async function runCode(dryRun: boolean) {
    if (!quest) return;
    setBusy(dryRun ? "run" : "submit"); setMessage(""); setIsError(false); setResult(null);
    try {
      const response = await apiRequest<SubmissionResponse>("/submissions/execute", {
        method: "POST",
        body: JSON.stringify({ activity_id: quest.id, source_code: code, dry_run_only: dryRun }),
      });
      setResult(response);
      setMessage(dryRun ? "Sample run finished. It did not create an attempt." : `Submission ${response.attempt_number} recorded as an append-only attempt.`);
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setBusy(""); }
  }

  const language = profile?.enrolled_language || "python";
  const monacoLanguage = language === "cpp" ? "cpp" : language;
  const evaluation = result?.evaluation;

  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow-label">CODING ARENA · {language.toUpperCase()}</p><h1>{quest?.title || "Your coding challenge"}</h1><p>{quest ? `${quest.topic_concept} · ${quest.xp_reward} XP on first completion` : "Write, run a sample, then submit your solution."}</p></div><Link href="/quests" className="button button-quiet">← Quest map</Link></div>
      {loading ? <section className="panel">Loading your challenge…</section> : message && !quest ? <section className="panel"><p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p><Link className="button button-primary" href="/onboarding">Sign in</Link></section> : quest && (
        <div className="arena-layout">
          <section className="panel problem-panel"><div className="quest-meta"><span className="tag">{quest.topic_concept}</span><span className="tag">Difficulty {quest.difficulty_level}</span></div><h2>Problem</h2><div className="problem-text">{quest.problem_statement || "Read the prompt and write a program that satisfies the sample and hidden test cases."}</div><div className="divider" style={{ margin: "20px 0" }} /><div className="callout"><h3>How submissions work</h3><p>Run sample checks as often as you like. Official submissions run against the full test suite and append a permanent attempt record.</p></div></section>
          <section className="panel"><div className="editor-toolbar"><span className="role-pill">{language}</span><span className="muted" style={{ fontSize: 11 }}>MONACO EDITOR</span></div><div className="editor-frame"><Editor height="420px" language={monacoLanguage} theme="vs-dark" value={code} onChange={(value) => setCode(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false, tabSize: 4, automaticLayout: true, wordWrap: "on", padding: { top: 14 } }} /></div><div className="editor-actions"><button className="button button-outline" type="button" onClick={() => void runCode(true)} disabled={busy !== "" || !code.trim()}>{busy === "run" ? "Running sample…" : "Run sample"}</button><button className="button button-primary" type="button" onClick={() => void runCode(false)} disabled={busy !== "" || !code.trim()}>{busy === "submit" ? "Grading…" : "Submit for grading"}</button></div>{message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}{evaluation && <><div className="evaluation-summary"><span className={`tag ${evaluation.is_successful ? "pass" : ""}`}>{evaluation.is_successful ? "PASS" : "NEEDS WORK"}</span><span className="tag">{evaluation.passed_test_cases}/{evaluation.total_test_cases} tests</span><span className="tag">{Number(evaluation.score_percentage).toFixed(1)}%</span>{result?.attempt_number && <span className="tag">Attempt #{result.attempt_number}</span>}{result?.xp_awarded !== undefined && <span className="tag">+{result.xp_awarded} XP</span>}</div><pre className="result-box">{JSON.stringify(evaluation, null, 2)}</pre></>}</section>
        </div>
      )}
      {profile && <p className="footer-note">Signed in as {profile.pseudonym_id} · Your source code is stored with official attempts.</p>}
    </div>
  );
}
