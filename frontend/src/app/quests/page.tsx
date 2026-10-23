"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { Profile, Quest } from "@/lib/types";

interface LeaderboardEntry { pseudonym_id: string; xp_points: number; current_level: number; is_me: boolean }
interface QuizResult { score_percentage: number; is_successful: boolean; xp_awarded: number; correct_answers: number; total_questions: number }

export default function QuestsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<Record<string, QuizResult>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");

  const loadQuests = useCallback(async () => {
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) { setMessage("Sign in to see your quest map."); return; }
      const me = await apiRequest<Profile>("/profile/me");
      setProfile(me);
      if (me.role !== "student") { router.replace("/instructor"); return; }
      const [questResult, leaderboardResult] = await Promise.allSettled([
        apiRequest<Quest[]>("/quests"),
        apiRequest<LeaderboardEntry[]>("/quests/leaderboard"),
      ]);
      if (questResult.status === "rejected") throw questResult.reason;
      setQuests(questResult.value);
      if (leaderboardResult.status === "fulfilled") setLeaders(leaderboardResult.value);
      else setLeaderboardError(getErrorMessage(leaderboardResult.reason));
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setLoading(false); }
  }, [router]);

  // loadQuests awaits Supabase and the API before its first state update.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadQuests(); }, [loadQuests]);

  async function submitQuiz(quest: Quest) {
    const quizAnswers = answers[quest.id] ?? {};
    if (!quest.quiz_questions?.length || Object.keys(quizAnswers).length === 0) {
      setIsError(true); setMessage("Choose an answer before submitting the quiz."); return;
    }
    setBusyId(quest.id); setMessage(""); setIsError(false);
    try {
      const result = await apiRequest<QuizResult & Record<string, unknown>>("/quests/submit-quiz", {
        method: "POST",
        body: JSON.stringify({ activity_id: quest.id, answers: quizAnswers }),
      });
      setResults((previous) => ({ ...previous, [quest.id]: result }));
      setMessage(`${result.correct_answers}/${result.total_questions} correct · ${result.xp_awarded} XP earned.`);
      setLoading(true);
      await loadQuests();
    } catch (error) { setIsError(true); setMessage(getErrorMessage(error)); }
    finally { setBusyId(""); }
  }

  return (
    <div className="page-shell">
      <div className="page-heading"><div><p className="eyebrow-label">STUDENT QUEST MAP</p><h1>Your next challenge awaits</h1><p>{profile ? `${profile.enrolled_language.toUpperCase()} track · Level ${profile.current_level} · ${profile.xp_points} XP` : "Published activities for your selected learning track."}</p></div>{profile && <span className="role-pill">{profile.pseudonym_id}</span>}</div>
      {loading ? <section className="panel">Loading your quest map…</section> : message && quests.length === 0 ? <section className="panel"><p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p><Link className="button button-primary" href="/onboarding">Sign in or choose a track</Link></section> : (
        <div className="two-column">
          <section className="stack">
            {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}
            {quests.length === 0 ? <div className="empty-state"><h2>Your path is ready for its first quest</h2><p>Once an instructor publishes a challenge or quiz for your language track, it will appear here.</p><Link className="button button-outline" href="/instructor">Open instructor studio</Link></div> : <div className="quest-grid">{quests.map((quest) => <article className="quest-card" key={quest.id}>
              <div className="quest-card-head"><span className="tag">{quest.activity_type === "quiz" ? "CONCEPT CHECK" : "CODE CHALLENGE"}</span>{quest.is_completed && <span className="completion">✓ Complete</span>}</div>
              <h2>{quest.title || quest.topic_concept}</h2>
              <p>{quest.problem_statement || `Practice ${quest.topic_concept} with a short knowledge check.`}</p>
              <div className="quest-meta"><span className="tag">{quest.topic_concept}</span><span className="tag">Difficulty {quest.difficulty_level}</span><span className="tag xp">✦ {quest.xp_reward} XP</span></div>
              {quest.activity_type === "challenge" ? <Link className="button button-primary" href={`/arena/${quest.id}`}>Open coding arena <span aria-hidden="true">→</span></Link> : <>
                {quest.quiz_questions?.map((question) => <fieldset className="quiz-options" key={question.id}><legend className="field-label">{question.prompt}</legend>{question.options.map((option) => <label className="quiz-option" key={option.key}><input type="radio" name={`${quest.id}-${question.id}`} value={option.key} checked={answers[quest.id]?.[question.id] === option.key} onChange={() => setAnswers((previous) => ({ ...previous, [quest.id]: { ...previous[quest.id], [question.id]: option.key } }))} /><span><strong>{option.key}.</strong> {option.text}</span></label>)}</fieldset>)}
                <button className="button button-primary" type="button" disabled={busyId === quest.id} onClick={() => void submitQuiz(quest)}>{busyId === quest.id ? "Grading…" : "Submit quiz"}</button>
                {results[quest.id] && <p className="notice">Score: {results[quest.id].score_percentage}% · {results[quest.id].is_successful ? "Passed" : "Keep practicing"}</p>}
              </>}
            </article>)}</div>}
          </section>
          <aside className="panel"><h2>Language leaderboard</h2><p className="panel-subtitle">Top learners in your track.</p>{leaderboardError ? <p className="notice warning">{leaderboardError}</p> : leaders.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No leaderboard entries yet.</p> : <div className="leaderboard">{leaders.map((entry, index) => <div className="leader-row" key={entry.pseudonym_id}><span className="leader-rank">{String(index + 1).padStart(2, "0")}</span><span className="leader-name">{entry.is_me ? `${entry.pseudonym_id} (you)` : entry.pseudonym_id}{entry.is_me && <span className="completion"> · YOU</span>}</span><span className="leader-xp">{entry.xp_points} XP</span></div>)}</div>}<div className="divider" style={{ margin: "17px 0" }} /><p className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>Your leaderboard identity is a generated pseudonym. Keep at it—your next successful quest adds experience.</p></aside>
        </div>
      )}
    </div>
  );
}
