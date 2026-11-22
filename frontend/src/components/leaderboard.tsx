"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useApi } from "@/components/workspace/ui";

interface LeaderboardEntry {
  rank: number;
  handle: string | null;
  xp_points: number;
  current_level: number;
  is_me: boolean;
}

interface LeaderboardStanding {
  rank: number | null;
  handle: string | null;
  xp_points: number;
  current_level: number;
}

export interface LeaderboardData {
  track: string;
  entries: LeaderboardEntry[];
  you: LeaderboardStanding | null;
  total_ranked: number;
}

const TRACK_LABEL: Record<string, string> = { python: "Python", cpp: "C++", java: "Java" };
const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
export const CHOOSE_HANDLE_HREF = "/profile?edit=handle";

function LearnerName({ handle }: { handle: string | null }) {
  return handle
    ? <span className="leader-name-tag" title={`@${handle}`}>@{handle}</span>
    : <span className="leader-name-tag is-anonymous">Anonymous learner</span>;
}

function Row({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const medal = MEDAL[entry.rank];
  return (
    <div
      role="row"
      className={`leader-row-card${entry.is_me ? " is-current-user" : ""}${medal ? ` rank-top-${entry.rank}` : ""}`}
      style={{ "--i": Math.min(index, 10) } as CSSProperties}
      aria-current={entry.is_me ? "true" : undefined}
    >
      <span role="cell" className={`leader-rank-badge${medal ? " top-rank" : ""}`}>
        {medal ? <span aria-hidden="true">{medal} </span> : null}
        <span className="sr-only">Rank </span>{String(entry.rank).padStart(2, "0")}
      </span>
      <span role="cell" className="leader-identity">
        <LearnerName handle={entry.handle} />
        {entry.is_me ? <span className="leader-you-pill">You</span> : null}
      </span>
      <span role="cell" className="leader-level-pill">Level {entry.current_level}</span>
      <span role="cell" className="leader-xp-highlight">{entry.xp_points.toLocaleString()} XP</span>
    </div>
  );
}

function Standing({ you, total }: { you: LeaderboardStanding; total: number }) {
  return (
    <section className="leaderboard-standing" aria-labelledby="your-standing-title">
      <div className="leaderboard-standing-rank" aria-hidden="true">{you.rank ? `#${you.rank}` : "—"}</div>
      <div className="leaderboard-standing-copy">
        <h2 id="your-standing-title">
          {you.rank ? `You're #${you.rank} of ${total} ranked ${total === 1 ? "learner" : "learners"}` : "You're not ranked yet"}
        </h2>
        <p>
          {you.rank
            ? `${you.xp_points.toLocaleString()} XP · Level ${you.current_level}`
            : "Earn XP from any quest to join the leaderboard."}
        </p>
        <p className="leaderboard-standing-identity">
          {you.handle ? <>Classmates see you as <strong>@{you.handle}</strong>.</> : <>Classmates see you as <strong>Anonymous learner</strong>.</>}
        </p>
      </div>
      <div className="leaderboard-standing-actions">
        {you.handle ? null : <Link className="button button-primary small" href={CHOOSE_HANDLE_HREF}>Choose your @handle</Link>}
        {you.rank ? null : <Link className="button button-outline small" href="/quests">Go to Quest Map</Link>}
      </div>
    </section>
  );
}

export function Leaderboard() {
  const { data, loading, error, reload } = useApi<LeaderboardData>("/quests/leaderboard");
  const track = data ? TRACK_LABEL[data.track] ?? data.track.toUpperCase() : "your";
  const entries = data?.entries ?? [];
  const you = data?.you ?? null;
  const youOutsideTop = Boolean(you?.rank) && !entries.some((entry) => entry.is_me);

  return (
    <div className="leaderboard-full-view">
      <div className="leaderboard-header-row">
        <div>
          <p className="eyebrow-label">Track rankings</p>
          <h1>Leaderboard</h1>
          <p className="leaderboard-desc">Top learners on the {track} track. Earn XP by passing code challenges and concept quizzes.</p>
        </div>
        <Link href="/quests" className="button button-outline leaderboard-back">← Back to Quest Map</Link>
      </div>

      {loading && !data ? (
        <section className="panel leaderboard-panel" role="status" aria-label="Loading leaderboard">
          <div className="ws-skeleton leaderboard-skeleton-standing" />
          {[0, 1, 2, 3].map((row) => <div key={row} className="ws-skeleton leaderboard-skeleton-row" />)}
        </section>
      ) : error ? (
        <section className="panel leaderboard-panel">
          <p className="notice warning" role="alert">{error}</p>
          <button type="button" className="button button-outline small" onClick={reload}>Try again</button>
        </section>
      ) : data ? (
        <>
          {you ? <Standing you={you} total={data.total_ranked} /> : null}

          <section className="panel leaderboard-panel" aria-labelledby="top-learners-title">
            <h2 id="top-learners-title" className="sr-only">Top learners</h2>
            {entries.length === 0 ? (
              <div className="leaderboard-empty">
                <p>No one on the {track} track has earned XP yet.</p>
                <Link className="button button-primary small" href="/quests">Start a quest to claim the top spot</Link>
              </div>
            ) : (
              <div className="leaderboard-table-container" role="table" aria-labelledby="top-learners-title">
                <div className="leaderboard-table-head" role="row">
                  <span role="columnheader" className="col-rank">Rank</span>
                  <span role="columnheader" className="col-learner">Learner</span>
                  <span role="columnheader" className="col-level">Level</span>
                  <span role="columnheader" className="col-xp">Experience</span>
                </div>
                <div className="leaderboard-table-rows" role="rowgroup">
                  {entries.map((entry, index) => (
                    <Row key={`${entry.rank}-${index}`} entry={entry} index={index} />
                  ))}
                  {youOutsideTop && you?.rank ? (
                    <>
                      <div className="leader-row-gap" aria-hidden="true">⋯</div>
                      <Row
                        entry={{ rank: you.rank, handle: you.handle, xp_points: you.xp_points, current_level: you.current_level, is_me: true }}
                        index={entries.length}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            )}

            <p className="leaderboard-note">
              Only public @handles appear here, never names or email addresses. Learners join once they earn XP, and equal XP
              shares a rank.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
