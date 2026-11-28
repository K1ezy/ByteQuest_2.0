"use client";

import { activitiesPassedSentence, firstTryHeadline, firstTrySentence } from "@/lib/takeaway";
import { MetricCard } from "@/components/insights/metric-card";
import { languageList, workshopLanguages } from "@/components/workshops/workshop-ui";
import Link from "next/link";
import { useState } from "react";
import { InsightLineChart } from "@/components/insights/line-chart";
import { MeterList, PracticeLink } from "@/components/insights/ui";
import { ProgressRecap } from "@/components/progress-recap";
import { questHref } from "@/components/quest-card";
import { StatCard } from "@/components/workspace/ui";
import { metrics } from "@/lib/insight-metrics";
import type { Profile } from "@/lib/types";
import { formatDate, formatDateTime, type HelpPattern, type StudentAnalytics } from "@/lib/workspace";
import { formatManilaDateTime } from "@/lib/activity-date";

const RECENT_LIMIT = 5;

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (seconds && !minutes) return "<1 min";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

function ProgressOverview({ a, languages }: { a: StudentAnalytics; languages: Profile["workshop_languages"] }) {
  const language = languageList(languages);
  const { quests_completed: done, quests_total: total } = a;
  const completion = done !== undefined && total ? Math.round(done / total * 100) : 0;
  return (
    <div className="profile-progress-overview">
      {done !== undefined && total !== undefined ? <MetricCard metric="student_activities_passed" value={`${completion}%`}
        sentence={language ? activitiesPassedSentence(done, total, language) : "Join a workshop to see its activities."}>
        <progress aria-label={`${done} of ${total} activities passed`} value={completion} max={100} />
        {language ? <Link className="insight-practice" href="/quests">Open Quest Map</Link>
          : <Link className="insight-practice" href="/workshops">Join a workshop to see its activities</Link>}
      </MetricCard> : null}
      <section className="ws-panel" aria-labelledby="xp-progress-title">
        <h2 id="xp-progress-title">Level {a.current_level}</h2>
        <p><strong>{a.xp_points.toLocaleString()} XP</strong> · {a.xp_to_next_level} XP to Level {a.current_level + 1}</p>
        <progress aria-label={`XP toward level ${a.current_level + 1}`} value={a.xp_into_level} max={a.xp_per_level} />
        <Link className="insight-practice" href="/profile?tab=activity#badges">View badges</Link>
      </section>
    </div>
  );
}

function RecentAttempts({ attempts, total }: { attempts: NonNullable<StudentAnalytics["recent_attempts"]>; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? attempts : attempts.slice(0, RECENT_LIMIT);
  return (
    <section className="ws-panel" aria-labelledby="recent-attempts-title">
      <div className="ws-panel-head">
        <h2 id="recent-attempts-title">Recent attempts</h2>
        <span className="ws-muted">{total} total</span>
      </div>
      {visible.length ? (
        <ul className="ws-list" id="profile-recent-attempts">
          {visible.map((attempt) => {
            const kind = attempt.activity_type === "quiz" ? "Quiz" : "Challenge";
            const title = attempt.title || kind;
            return (
              <li className="ws-row" key={attempt.attempt_id}>
                <div className="ws-row-main">
                  <strong>{attempt.can_open_quest ? (
                    <Link className="insight-practice" href={questHref({ id: attempt.activity_id, activity_type: attempt.activity_type })}>{title}</Link>
                  ) : title}</strong>
                  <p className="ws-row-meta">{kind} · {formatDateTime(attempt.created_at)}</p>
                </div>
                <span className="ws-muted">{attempt.is_successful ? "Passed" : "Below passing score"} · {Math.round(attempt.score_percentage)}%</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="ws-muted">Your attempts will appear here after you start a quest.</p>}
      {attempts.length > RECENT_LIMIT ? (
        <div className="ws-inline-actions">
          <button type="button" className="button button-outline small" aria-expanded={expanded}
            aria-controls="profile-recent-attempts" onClick={() => setExpanded((open) => !open)}>
            {expanded ? "Show fewer" : `Show ${attempts.length} recent attempts`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

// Informational feedback on process (independence, trying before asking), never a score or a penalty.
function habitsMessage(p: HelpPattern): string {
  if (p.challenges_solved === 0 && p.hinted_challenges === 0) return "Solve a coding challenge to see how you approach problems.";
  if (p.hinted_challenges > 0 && p.tried_before_hint * 2 < p.hinted_challenges) {
    return "Tip: a sample run often reveals the bug on its own. Try one before opening a hint.";
  }
  return "Trying first and asking for help when stuck is a strong learning habit. Hints are always there when you need them.";
}

function SolvingHabits({ pattern }: { pattern: HelpPattern }) {
  return (
    <section className="ws-panel" aria-labelledby="solving-habits-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">PROBLEM SOLVING</p>
          <h2 id="solving-habits-title">How you solve challenges</h2>
        </div>
      </div>
      <div className="ws-stat-grid">
        <StatCard label={metrics.self_solved.label} value={`${pattern.self_solved} of ${pattern.challenges_solved}`}
          hint="Challenges passed without opening a hint" icon="★" tone="good" />
        <StatCard label="3-star solves" value={pattern.three_star}
          hint="No hints, within 2 attempts" icon="✦" tone="info" />
        <StatCard label={metrics.tried_before_asking.label}
          value={pattern.hinted_challenges ? `${pattern.tried_before_hint} of ${pattern.hinted_challenges}` : "—"}
          hint={pattern.hinted_challenges ? "Hinted challenges where you ran code first" : "No hints used yet"} icon="↻" tone="info" />
      </div>
      <p className="profile-activity-note">{habitsMessage(pattern)}</p>
    </section>
  );
}

export function StudentProgress({ a, profile }: { a: StudentAnalytics; profile: Profile }) {
  const typeLabel = (t: string) => (t === "quiz" ? "Quizzes" : t === "challenge" ? "Coding challenges" : t);
  const firstTries = a.first_tries ?? [];
  const firstTryTitle = firstTryHeadline(firstTries.map(t => ({ score: t.score_percentage, passed: t.passed })));
  return (
    <>
      <ProgressOverview a={a} languages={profile.workshop_languages} />
      <ProgressRecap userId={profile.id} />
      <div className="ws-stat-grid">
        <MetricCard metric="first_try_passes"
          value={a.quests_completed ? `${Math.round(100 * (a.first_try_passes ?? 0) / a.quests_completed)}%` : "—"}
          sentence={firstTrySentence(a.first_try_passes ?? 0, a.quests_completed ?? 0)} />
        <StatCard label={metrics.average_attempt_score.label} value={a.total_attempts ? Math.round(a.average_score) + "%" : "—"} hint={a.total_attempts ? "Best " + Math.round(a.best_score) + "%" : "No attempts yet"} />
        <StatCard label="Practice time" value={duration(a.total_time_seconds)} hint="Time recorded for visible attempts" />
      </div>
      <section className="ws-panel" aria-labelledby="learning-activity-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">CONSISTENCY</p>
            <h2 id="learning-activity-title">Learning activity</h2>
          </div>
          <p className="profile-activity-summary">
            <strong>{a.active_days_30}</strong> active days · <strong>{a.current_streak}</strong> day current streak · <strong>{a.longest_streak}</strong> best
          </p>
        </div>
        <ol className="profile-activity-days" aria-label="Attempts during the last 30 days, in Asia Manila time">
          {a.activity_days.map((day) => (
            <li key={day.date} className={`level-${Math.min(4, day.attempts)}`}>
              <time dateTime={day.date} title={`${formatDate(day.date)}: ${day.attempts} attempt${day.attempts === 1 ? "" : "s"}`}>
                <span aria-hidden="true" />
                <span className="sr-only">{formatDate(day.date)}: {day.attempts} attempt{day.attempts === 1 ? "" : "s"}</span>
              </time>
            </li>
          ))}
        </ol>
        <p className="profile-activity-note">Activity is counted by calendar day in Asia/Manila. Breaks are normal—this view celebrates consistency without penalizing time away.</p>
      </section>

      {a.help_pattern ? <SolvingHabits pattern={a.help_pattern} /> : null}

      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="trend-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">FIRST TRIES</p>
              <h2 id="trend-title">{firstTryTitle}</h2>
              <p className="ws-muted">First-try score per activity, in the order you did them</p>
            </div>
          </div>
          <InsightLineChart label="First-try score per activity" xLabel="Activity" domain={[0,100]} numericX
            formatX={x => "Activity " + x}
            rows={firstTries.map((t, i) => ({ x: i + 1, score: t.score_percentage, title: t.title, language: t.language, passed: t.passed ? 1 : 0 }))}
            series={[{ key: "score", label: "First-try score (%)", token: "var(--chart-series)" }]}
            pointState={row => row.passed ? "passed" : "open"}
            tooltip={{ title: row => row.title + " · " + workshopLanguages[row.language as keyof typeof workshopLanguages],
              value: (_, row) => Math.round(Number(row.score)) + "% · " + (row.passed ? "passed" : "not passed yet") }}
            summary={firstTryTitle}
            table={<table className="ws-table analysis-table"><caption>First-try score per activity</caption>
              <thead><tr><th scope="col">Activity</th><th scope="col">Language</th><th scope="col">First-try score</th><th scope="col">Result</th></tr></thead>
              <tbody>{firstTries.map(t => <tr key={t.activity_id}><th scope="row">{t.title}</th><td>{workshopLanguages[t.language]}</td>
                <td>{Math.round(t.score_percentage)}%</td><td>{t.passed ? "passed" : "not passed yet"}</td></tr>)}</tbody></table>} />
        </section>

        <div className="ws-stack">
          <section className="ws-panel" aria-labelledby="bytype-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">BY TYPE</p>
                <h2 id="bytype-title">Performance by activity type</h2>
              </div>
            </div>
            <MeterList label="Performance by activity type" rows={a.by_type.map(t => ({
              name: typeLabel(t.activity_type), value: t.pass_rate, total: 100, detail: t.attempts + " tries", figure: Math.round(t.pass_rate) + "%",
            }))} />
          </section>

          <section className="ws-panel" aria-labelledby="bytopic-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">BY TOPIC</p>
                <h2 id="bytopic-title">Average score by topic</h2>
              </div>
            </div>
            <MeterList label="Average score by topic" rows={a.by_topic.map(t => ({
              id: `${t.language}:${t.topic}`, name: `${t.topic} · ${workshopLanguages[t.language]}`, value: t.average_score, total: 100,
              figure: Math.round(t.average_score) + "%",
              detail: <>{t.attempts} tries {t.topic !== "General" && <PracticeLink topic={t.topic} language={t.language} />}</>,
            }))} />
          </section>
        </div>
      </div>

      {a.recent_attempts ? <RecentAttempts attempts={a.recent_attempts} total={a.total_attempts} /> : null}

      <section className="ws-panel" id="badges" aria-labelledby="badges-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">ACHIEVEMENTS</p>
            <h2 id="badges-title">Badges</h2>
            <p className="ws-muted">{a.badge_count} earned</p>
          </div>
        </div>
        {a.badges.length === 0 ? (
          <p className="ws-muted">No badges earned yet — keep questing to unlock them.</p>
        ) : (
          <ul className="profile-badges">
            {a.badges.map((badge) => (
              <li key={badge.code}>
                <span className="profile-badge-icon" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badge.icon_url} alt="" />
                </span>
                <span className="profile-badge-copy">
                  <strong>{badge.name}</strong>
                  <span>{badge.description}</span>
                  <span>+{badge.xp_bonus} XP{badge.awarded_at ? ` · ${formatDateTime(badge.awarded_at)}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Actions this person performed themselves — never a productivity score. */
