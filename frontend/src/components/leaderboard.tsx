"use client";

import { useRouter } from "next/navigation";
import { useShellProfile } from "@/components/app-shell";
import { useApi } from "@/components/workspace/ui";

interface LeaderboardEntry {
  pseudonym_id: string;
  username: string;
  xp_points: number;
  current_level: number;
  is_me: boolean;
}

export function Leaderboard() {
  const router = useRouter();
  const profile = useShellProfile();
  const { data, loading, error: leaderboardError } = useApi<LeaderboardEntry[]>("/quests/leaderboard");
  const leaders = data ?? [];
  if (loading) return <section className="panel" role="status">Loading leaderboard…</section>;
  return (
        <div className="leaderboard-full-view">
          <div className="leaderboard-header-row">
            <div>
              <p className="eyebrow-label">TRACK RANKINGS</p>
              <h1>Leaderboard</h1><h2>Top learners in {profile?.enrolled_language.toUpperCase() || "your"} track</h2>
              <p className="leaderboard-desc">
                Earn XP by completing coding challenges and answering concept quizzes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/quests")}
              className="button button-outline"
            >
              ← Back to Quest map
            </button>
          </div>

          <section className="panel leaderboard-panel" aria-label="Leaderboard rankings">
            {leaderboardError ? (
              <p className="notice warning">{leaderboardError}</p>
            ) : leaders.length === 0 ? (
              <p className="muted">No leaderboard entries yet.</p>
            ) : (
              <div className="leaderboard-table-container">
                <div className="leaderboard-table-head">
                  <span className="col-rank">Rank</span>
                  <span className="col-learner">Learner</span>
                  <span className="col-level">Level</span>
                  <span className="col-xp">Experience</span>
                </div>
                <div className="leaderboard-table-rows">
                  {leaders.map((entry, index) => {
                    const isTopThree = index < 3;
                    return (
                      <div
                        className={`leader-row-card ${entry.is_me ? "is-current-user" : ""} ${
                          isTopThree ? `rank-top-${index + 1}` : ""
                        }`}
                        key={entry.pseudonym_id}
                      >
                        <span className={`leader-rank-badge ${isTopThree ? "top-rank" : ""}`}>
                          {index === 0
                            ? "🥇 01"
                            : index === 1
                            ? "🥈 02"
                            : index === 2
                            ? "🥉 03"
                            : String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="leader-identity">
                          <span className="leader-name-tag" title={`@${entry.username}`}>
                            @{entry.username}
                          </span>
                          {entry.is_me && <span className="leader-you-pill">YOU</span>}
                        </div>
                        <span className="leader-level-pill">Level {entry.current_level}</span>
                        <span className="leader-xp-highlight">{entry.xp_points} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="divider" style={{ margin: "24px 0 16px" }} />
            <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
              Your username appears on the leaderboard. Your position updates automatically whenever you submit passing code or complete a review quiz.
            </p>
          </section>
        </div>
  );
}
