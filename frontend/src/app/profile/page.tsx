"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { apiRequest, ApiError, getErrorMessage } from "@/lib/api";
import { Button, ConfirmDialog, Notice, StatCard, StatusChip, shortId } from "@/components/workspace/ui";
import { useToast } from "@/components/toast";
import { UserAvatar } from "@/components/user-avatar";
import { usePasswordReset } from "@/hooks/use-password-reset";
import { useSignOut } from "@/hooks/use-sign-out";
import { cropCompressImage } from "@/lib/image";
import { publishProfileUpdate } from "@/lib/profile-events";
import {
  deleteMyAvatar,
  formatDate,
  formatDateTime,
  getMyAnalytics,
  getMyProfile,
  updateMyProfile,
  updateMyTrack,
  uploadMyAvatar,
  type AdminAnalytics,
  type InstructorAnalytics,
  type ProfileAction,
  type ProfileAnalytics,
  type ProfileAuditEntry,
  type StudentAnalytics,
  type TrendPoint,
} from "@/lib/workspace";
import type { Profile, ProgrammingLanguage } from "@/lib/types";

const LANGUAGES: { value: ProgrammingLanguage; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
];

const ROLE_LABEL: Record<Profile["role"], string> = {
  student: "Student",
  instructor: "Faculty",
  admin: "Administrator",
};

const LANGUAGE_LABEL: Record<string, string> = {
  python: "Python",
  cpp: "C++",
  java: "Java",
};

/** Inline score-trend sparkline (0–100%), oldest → newest. */
function Sparkline({ points }: { points: TrendPoint[] }) {
  if (points.length < 2) return <p className="ws-muted">Not enough attempts yet to chart a trend.</p>;
  const width = 520;
  const height = 120;
  const pad = 8;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = pad + index * step;
    const y = height - pad - (Math.max(0, Math.min(100, point.score_percentage)) / 100) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const first = Math.round(points[0].score_percentage);
  const latest = Math.round(points[points.length - 1].score_percentage);
  return (
    <svg
      className="profile-spark"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Recent score trend across ${points.length} released or practice attempts, from ${first}% to ${latest}%`}
    >
      <polygon className="profile-spark-fill" points={area} />
      <polyline className="profile-spark-line" points={line} />
      {coords.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={2.5} className="profile-spark-dot" />
      ))}
    </svg>
  );
}

/** Horizontal labelled bars for breakdowns (value is 0–100). */
function BarList({ items }: { items: { label: string; value: number; caption?: string }[] }) {
  if (items.length === 0) return <p className="ws-muted">No data yet.</p>;
  return (
    <ul className="profile-bars">
      {items.map((item) => (
        <li key={item.label}>
          <div className="profile-bar-head">
            <span>{item.label}</span>
            <strong>{Math.round(item.value)}%{item.caption ? ` · ${item.caption}` : ""}</strong>
          </div>
          <div
            className="profile-bar-track"
            role="progressbar"
            aria-label={item.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(item.value)}
          >
            <div className="profile-bar-fill" style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StudentOverview({ a }: { a: StudentAnalytics }) {
  const nextHref = a.next_action.activity_id
    ? `/${a.next_action.kind === "quiz" ? "quiz" : "arena"}/${a.next_action.activity_id}`
    : "/quests";
  return (
    <section className="ws-panel profile-overview-panel" aria-labelledby="student-stats-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">LEARNING OVERVIEW</p>
          <h2 id="student-stats-title">Your progress at a glance</h2>
        </div>
      </div>
      <div className="profile-overview-grid">
        <div className="profile-level-progress">
          <div className="profile-level-ring" style={{ "--level-progress": `${a.level_progress_percent * 3.6}deg` } as CSSProperties} aria-hidden="true">
            <span>Lv {a.current_level}</span>
          </div>
          <div className="profile-level-copy">
            <strong>{a.xp_to_next_level} XP to Level {a.current_level + 1}</strong>
            <span>{a.xp_into_level} of {a.xp_per_level} XP earned in this level</span>
            <div className="profile-level-track" role="progressbar" aria-label={`Progress toward level ${a.current_level + 1}`} aria-valuemin={0} aria-valuemax={a.xp_per_level} aria-valuenow={a.xp_into_level}>
              <span style={{ width: `${a.level_progress_percent}%` }} />
            </div>
          </div>
        </div>
        <div className="profile-next-action">
          <div>
            <span>Recommended next</span>
            <strong>{a.next_action.title || (a.next_action.recommended_action === "completed_track" ? "Track complete" : "Explore your quest map")}</strong>
            <p>{a.next_action.rationale}</p>
          </div>
          <Link className="button button-primary" href={nextHref}>{a.next_action.activity_id ? "Continue learning" : "View quest map"} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      <div className="ws-stat-grid">
        <StatCard label="Total XP" value={a.xp_points} hint={`Level ${a.current_level}`} icon="★" tone="good" />
        <StatCard label="Pass rate" value={`${Math.round(a.pass_rate)}%`} hint={`${a.successful_attempts}/${a.total_attempts} passed`} icon="✓" tone={a.pass_rate >= 60 ? "good" : "wait"} />
        <StatCard label="Average score" value={`${Math.round(a.average_score)}%`} hint={`Best ${Math.round(a.best_score)}%`} icon="◎" tone="info" />
        <StatCard label="Badges" value={a.badge_count} hint={`${Math.round(a.total_time_seconds / 60)} min practised`} icon="▲" tone="info" />
      </div>
    </section>
  );
}

function StudentSections({ a }: { a: StudentAnalytics }) {
  const typeLabel = (t: string) => (t === "quiz" ? "Quizzes" : t === "challenge" ? "Coding challenges" : t);
  return (
    <>

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

      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="trend-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">TREND</p>
              <h2 id="trend-title">Recent score trend</h2>
            </div>
          </div>
          <Sparkline points={a.score_trend} />
          {a.score_trend.length > 0 ? (
            <ul className="ws-compact-list profile-recent">
              {[...a.score_trend].reverse().slice(0, 6).map((point, index) => (
                <li key={index}>
                  <strong>{point.title || "Activity"}</strong>
                  <span>{Math.round(point.score_percentage)}% · {formatDateTime(point.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="ws-stack">
          <section className="ws-panel" aria-labelledby="bytype-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">BY TYPE</p>
                <h2 id="bytype-title">Performance by activity type</h2>
              </div>
            </div>
            <BarList items={a.by_type.map((t) => ({ label: typeLabel(t.activity_type), value: t.pass_rate, caption: `${t.attempts} tries` }))} />
          </section>

          <section className="ws-panel" aria-labelledby="bytopic-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">BY TOPIC</p>
                <h2 id="bytopic-title">Average score by topic</h2>
              </div>
            </div>
            <BarList items={a.by_topic.map((t) => ({ label: t.topic, value: t.average_score, caption: `${t.attempts} tries` }))} />
          </section>
        </div>
      </div>

      <section className="ws-panel" aria-labelledby="exams-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">EXAMS</p>
            <h2 id="exams-title">Exam history</h2>
          </div>
        </div>
        {a.exam_history.length === 0 ? (
          <p className="ws-muted">No exam attempts yet.</p>
        ) : (
          <ul className="ws-list">
            {a.exam_history.map((exam, index) => (
              <li className="ws-row" key={`${exam.exam_id}-${index}`}>
                <div className="ws-row-main">
                  <strong>{exam.title}</strong>
                  <span className="ws-row-meta">
                    {exam.submitted_at
                      ? exam.results_released
                        ? `Results released · submitted ${formatDateTime(exam.submitted_at)}`
                        : `Awaiting release · submitted ${formatDateTime(exam.submitted_at)}`
                      : "In progress"}
                  </span>
                </div>
                <div className="ws-row-actions">
                  <StatusChip state={exam.status} />
                  <strong>
                    {!exam.results_released
                      ? "Awaiting release"
                      : exam.score === null
                        ? "—"
                        : `${Math.round(exam.score)}${exam.max_score ? ` / ${Math.round(exam.max_score)}` : ""}`}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ws-panel" aria-labelledby="badges-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">ACHIEVEMENTS</p>
            <h2 id="badges-title">Badges</h2>
          </div>
        </div>
        {a.badges.length === 0 ? (
          <p className="ws-muted">No badges earned yet — keep questing to unlock them.</p>
        ) : (
          <ul className="profile-badges">
            {a.badges.map((badge) => (
              <li key={badge.code} data-tooltip={badge.description || undefined}>
                <span className="profile-badge-icon" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badge.icon_url} alt="" />
                </span>
                <span className="profile-badge-copy">
                  <strong>{badge.name}</strong>
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

/** The one dominant call to action for this role, per Von Restorff emphasis. */
function RecommendedAction({ action, eyebrow }: { action: ProfileAction | null; eyebrow: string }) {
  if (!action) return null;
  const calm = action.kind === "workspace" || action.kind === "dashboard";
  return (
    <div className={`profile-next-action${calm ? " is-calm" : ""}`}>
      <div>
        <span>{eyebrow}</span>
        <strong>{action.title}</strong>
        <p>{action.detail}</p>
      </div>
      <div className="profile-next-action-side">
        <StatusChip state={action.status} label={action.status} tone={calm ? "good" : "wait"} />
        <Link className="button button-primary" href={action.href}>
          {calm ? "Open workspace" : "Review now"} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

/** Counts of work waiting on this user. Numbers carry the meaning, not colour. */
function AttentionSummary({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; hint: string; href: string }[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="ws-panel" aria-labelledby="attention-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">NEEDS ATTENTION</p>
          <h2 id="attention-title">{title}</h2>
        </div>
      </div>
      {total === 0 ? (
        <p className="ws-muted">Nothing is waiting on you right now.</p>
      ) : null}
      <div className="ws-stat-grid">
        {items.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            hint={item.hint}
            href={item.href}
            icon={item.value > 0 ? "!" : "✓"}
            tone={item.value > 0 ? "wait" : "good"}
          />
        ))}
      </div>
    </section>
  );
}

/** Actions this person performed themselves — never a productivity score. */
function PersonalTimeline({
  entries,
  title,
  emptyLabel,
}: {
  entries: ProfileAuditEntry[];
  title: string;
  emptyLabel: string;
}) {
  return (
    <section className="ws-panel" aria-labelledby="personal-timeline-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">YOUR RECENT WORK</p>
          <h2 id="personal-timeline-title">{title}</h2>
        </div>
      </div>
      <p className="profile-context-note">Only actions you performed. This is a record, not a target.</p>
      {entries.length === 0 ? (
        <p className="ws-muted">{emptyLabel}</p>
      ) : (
        <ul className="ws-compact-list">
          {entries.map((entry, index) => (
            <li key={`${entry.action}-${index}`}>
              <strong>{entry.summary}</strong>
              <span>
                {entry.action} · {formatDateTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InstructorOverview({ a }: { a: InstructorAnalytics }) {
  return (
    <section className="ws-panel profile-overview-panel" aria-labelledby="teach-overview-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">TEACHING IMPACT</p>
          <h2 id="teach-overview-title">The learning you support</h2>
        </div>
        <Link className="button button-outline" href="/faculty">Open faculty workspace <span aria-hidden="true">→</span></Link>
      </div>
      <RecommendedAction action={a.next_action} eyebrow="Highest priority" />
      <div className="ws-stat-grid">
        <StatCard label="Courses" value={a.courses} hint="Assigned to you" icon="▦" tone="info" />
        <StatCard label="Learners taught" value={a.learners_taught} hint="Across your courses" icon="◉" tone="good" />
        <StatCard label="Published activities" value={a.activities_published} hint={`${a.activities_created} created`} icon="✎" tone="info" />
        <StatCard label="Reviews completed" value={a.drafts_reviewed} hint="Drafts reviewed" icon="✓" tone="good" />
      </div>
    </section>
  );
}

function InstructorSections({ a }: { a: InstructorAnalytics }) {
  // Tolerate an older or partial payload rather than failing the whole view.
  const attention = a.attention ?? {
    drafts_awaiting_review: 0,
    materials_needing_attention: 0,
    upcoming_activities: 0,
  };
  return (
    <>
      <AttentionSummary
        title="Work waiting in your courses"
        items={[
          {
            label: "Materials needing attention",
            value: attention.materials_needing_attention,
            hint: "PDFs that cannot be cited yet",
            href: "/faculty/materials?status=attention",
          },
          {
            label: "Drafts awaiting review",
            value: attention.drafts_awaiting_review,
            hint: "Hidden from students until approved",
            href: "/faculty/review?status=open",
          },
          {
            label: "Upcoming activities",
            value: attention.upcoming_activities,
            hint: "Opening in the next 14 days",
            href: "/faculty/activities?status=scheduled",
          },
        ]}
      />
    <section className="ws-panel" aria-labelledby="teach-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">YOUR CONTRIBUTIONS</p>
          <h2 id="teach-title">Teaching activity</h2>
        </div>
        <Link className="button button-outline" href="/faculty">Manage teaching</Link>
      </div>
      <div className="ws-stat-grid">
        <StatCard label="Activities created" value={a.activities_created} hint={`${a.activities_published} published`} icon="✎" tone="info" />
        <StatCard label="Drafts reviewed" value={a.drafts_reviewed} hint="Learning content checked" icon="✓" tone="good" />
        <StatCard label="Materials uploaded" value={a.materials_uploaded} hint="Teaching resources" icon="▤" tone="info" />
        <StatCard label="Learners reached" value={a.learners_taught} hint={`Across ${a.courses} courses`} icon="◉" tone="good" />
      </div>
      <p className="ws-footnote">Detailed review queues, materials, schedules, and class performance remain in the faculty workspace.</p>
    </section>
      <PersonalTimeline
        entries={a.recent_activity ?? []}
        title="Your recent contributions"
        emptyLabel="Your reviews, uploads and publishing will appear here."
      />
    </>
  );
}

function AdminOverview({ a }: { a: AdminAnalytics }) {
  return (
    <section className="ws-panel profile-overview-panel" aria-labelledby="admin-overview-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">PLATFORM STEWARDSHIP</p>
          <h2 id="admin-overview-title">ByteQuest at a glance</h2>
        </div>
        <Link className="button button-outline" href="/admin">Open admin workspace <span aria-hidden="true">→</span></Link>
      </div>
      <RecommendedAction action={a.next_action} eyebrow="Highest priority" />
      <div className="ws-stat-grid">
        <StatCard label="Accounts" value={a.total_accounts} hint="All roles" icon="◉" tone="info" />
        <StatCard label="Courses" value={a.total_courses} icon="▦" tone="info" />
        <StatCard label="Activities" value={a.total_activities} icon="▣" tone="info" />
        <StatCard label="Materials" value={a.total_materials} hint="Current versions" icon="▤" tone="good" />
      </div>
    </section>
  );
}

function AdminSections({ a }: { a: AdminAnalytics }) {
  const total = Object.values(a.accounts_by_role).reduce((sum, value) => sum + value, 0) || 1;
  // Tolerate an older or partial payload rather than failing the whole view.
  const attention = a.attention ?? {
    accounts_needing_action: 0,
    failed_jobs: 0,
    availability_changes: 0,
  };
  return (
    <>
      <AttentionSummary
        title="Operational work waiting"
        items={[
          {
            label: "Failed jobs",
            value: attention.failed_jobs,
            hint: "Processing that needs investigation",
            href: "/admin/monitoring?status=failed",
          },
          {
            label: "Accounts needing action",
            value: attention.accounts_needing_action,
            hint: "Blocked from course access",
            href: "/admin/accounts?status=attention",
          },
          {
            label: "Availability changes",
            value: attention.availability_changes,
            hint: "Scheduled or closed activities",
            href: "/admin/activities?status=attention",
          },
        ]}
      />
      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="roles-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">ACCOUNTS</p>
              <h2 id="roles-title">Accounts by role</h2>
            </div>
          </div>
          <BarList
            items={Object.entries(a.accounts_by_role).map(([role, count]) => ({
              label: ROLE_LABEL[role as Profile["role"]] || role,
              value: (count / total) * 100,
              caption: `${count}`,
            }))}
          />
        </section>

        <section className="ws-panel" aria-labelledby="audit-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">AUDIT</p>
              <h2 id="audit-title">Recent platform activity</h2>
            </div>
          </div>
          <p className="profile-context-note">This is a platform-wide audit view, not a measure of individual productivity.</p>
          {(a.recent_audit ?? []).length === 0 ? (
            <p className="ws-muted">No recorded activity yet.</p>
          ) : (
            <ul className="ws-compact-list">
              {(a.recent_audit ?? []).map((event, index) => (
                <li key={index}>
                  <strong>{event.summary}</strong>
                  <span>{event.action} · {formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <PersonalTimeline
        entries={a.recent_activity ?? []}
        title="Your recent administration"
        emptyLabel="Account, course and configuration changes you make will appear here."
      />
    </>
  );
}

interface ConsentStatus {
  available: boolean;
  version: string | null;
  choice: "accepted" | "declined" | "withdrawn" | null;
}

function AccountPanel({
  profile,
  memberSince,
  profileTipsDismissed,
  onRestoreProfileTips,
}: {
  profile: Profile;
  memberSince: string | null;
  profileTipsDismissed: boolean;
  onRestoreProfileTips: () => void;
}) {
  const { isLoading: resetBusy, error: resetError, statusMessage: resetStatus, requestResetLink } = usePasswordReset();
  const { isSigningOut, error: signOutError, signOut } = useSignOut();
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [consentError, setConsentError] = useState("");

  useEffect(() => {
    if (profile.role !== "student") return;
    let active = true;
    apiRequest<ConsentStatus>("/pilot/research/consent")
      .then((result) => {
        if (active) setConsent(result);
      })
      .catch((caught) => {
        if (active) setConsentError(getErrorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [profile.role]);

  return (
    <div className="profile-account-grid">
      <section className="ws-panel" aria-labelledby="identity-settings-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">IDENTITY</p>
            <h2 id="identity-settings-title">Your ByteQuest account</h2>
          </div>
        </div>
        <dl className="profile-account-details">
          <div><dt>Email</dt><dd>{profile.email || "No email is stored on this profile"}</dd></div>
          <div><dt>Role</dt><dd>{ROLE_LABEL[profile.role]}</dd></div>
          <div><dt>Account ID</dt><dd><code>{profile.pseudonym_id}</code></dd></div>
          <div><dt>Member since</dt><dd>{memberSince || "Not available"}</dd></div>
        </dl>
        <div className="profile-privacy-note">
          <span aria-hidden="true">◆</span>
          <div>
            <strong>Private by default</strong>
            <p>Your profile details and role analytics are visible only to you while signed in.</p>
          </div>
        </div>
      </section>

      <section className="ws-panel" aria-labelledby="security-settings-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">SECURITY</p>
            <h2 id="security-settings-title">Sign-in and password</h2>
          </div>
        </div>
        <div className="profile-setting-row">
          <div>
            <strong>Password reset</strong>
            <p>{profile.email ? `Send a secure reset link to ${profile.email}.` : "Ask an administrator to add an email before resetting your password."}</p>
          </div>
          <Button variant="outline" disabled={!profile.email || resetBusy} onClick={() => profile.email && void requestResetLink(profile.email)}>
            {resetBusy ? "Sending…" : "Email reset link"}
          </Button>
        </div>
        {resetStatus ? <Notice tone="success">{resetStatus}</Notice> : null}
        {resetError ? <Notice tone="error">{resetError}</Notice> : null}
        <div className="profile-setting-row profile-setting-row-danger">
          <div>
            <strong>Sign out on this device</strong>
            <p>Clears local ByteQuest session data from this browser.</p>
          </div>
          <Button variant="outline" disabled={isSigningOut} onClick={() => void signOut()}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
        {signOutError ? <Notice tone="error">{signOutError}</Notice> : null}
      </section>

      <section className="ws-panel" aria-labelledby="preferences-settings-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">PREFERENCES</p>
            <h2 id="preferences-settings-title">Comfort and guidance</h2>
          </div>
        </div>
        <div className="profile-setting-row">
          <div>
            <strong>Accessibility settings</strong>
            <p>Adjust motion, contrast, text, and interaction preferences.</p>
          </div>
          <Link className="button button-outline" href="/quests?view=accessibility">Open settings</Link>
        </div>
        <div className="profile-setting-row">
          <div>
            <strong>Profile tips</strong>
            <p>{profileTipsDismissed ? "Show the optional setup guidance on Overview again." : "Optional setup guidance is currently available on Overview."}</p>
          </div>
          <Button variant="outline" disabled={!profileTipsDismissed} onClick={onRestoreProfileTips}>Show tips again</Button>
        </div>
      </section>

      {profile.role === "student" ? (
        <section className="ws-panel" aria-labelledby="research-settings-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">PRIVACY</p>
              <h2 id="research-settings-title">Research participation</h2>
            </div>
          </div>
          {consentError ? <Notice tone="error">Research consent status is temporarily unavailable. {consentError}</Notice> : null}
          {!consent && !consentError ? <span className="ws-skeleton ws-skeleton-line" style={{ width: "65%" }} /> : null}
          {consent ? (
            <div className="profile-setting-row">
              <div>
                <strong>{consent.available ? `Status: ${consent.choice || "not chosen"}` : "Research telemetry is disabled"}</strong>
                <p>Participation is optional and never changes access to quests, exams, or grades.</p>
              </div>
              <Link className="button button-outline" href="/account/research">Manage consent</Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

const COMPLETE_STEPS = [
  { key: "name", label: "Add your name" },
  { key: "bio", label: "Add a bio" },
] as const;

function setupDismissalKey(profileId: string) {
  return `bytequest:profile-setup-dismissed:${profileId}`;
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingField, setEditingField] = useState<"name" | "bio" | null>(null);
  const editingRef = useRef<"name" | "bio" | null>(null);
  const [draft, setDraft] = useState("");
  const [savingField, setSavingField] = useState(false);

  const [trackOpen, setTrackOpen] = useState(false);
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [yearLevel, setYearLevel] = useState(1);
  const [semester, setSemester] = useState(1);
  const [trackSaving, setTrackSaving] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [profileTipsDismissed, setProfileTipsDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "activity" || tabParam === "account" ? tabParam : "overview";

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    setAnalytics(null);
    try {
      setAnalytics(await getMyAnalytics());
    } catch (caught) {
      setAnalyticsError(getErrorMessage(caught));
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) {
        router.replace("/onboarding");
        return;
      }
      void loadAnalytics();
      const currentProfile = await getMyProfile();
      setProfile(currentProfile);
      setProfileTipsDismissed(window.localStorage.getItem(setupDismissalKey(currentProfile.id)) === "true");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/onboarding");
        return;
      }
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [loadAnalytics, router]);

  useEffect(() => {
    // Kicking off the initial load is the effect's whole purpose here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const startEdit = (field: "name" | "bio", current: string) => {
    editingRef.current = field;
    setDraft(current);
    setEditingField(field);
  };

  const applyProfileUpdate = (updated: Profile) => {
    setProfile(updated);
    publishProfileUpdate(updated);
  };

  const cancelEdit = () => {
    editingRef.current = null;
    setEditingField(null);
  };

  // Claimed via editingRef so Enter + blur (which both fire) only save once,
  // and Escape (which clears the ref) never saves.
  const saveField = async () => {
    const field = editingRef.current;
    if (!profile || !field) return;
    editingRef.current = null;
    const value = draft.trim();
    setSavingField(true);
    try {
      const updated = await updateMyProfile(field === "name" ? { display_name: value } : { bio: value });
      applyProfileUpdate(updated);
      setEditingField(null);
      toast.show(field === "name" ? "Name updated" : "Bio updated", "success");
    } catch (caught) {
      editingRef.current = field;
      toast.show(getErrorMessage(caught), "error");
    } finally {
      setSavingField(false);
    }
  };

  const saveTrack = async () => {
    setTrackSaving(true);
    try {
      const updated = await updateMyTrack({ enrolled_language: language, year_level: yearLevel, semester });
      applyProfileUpdate(updated);
      setTrackOpen(false);
      toast.show("Learning track updated", "success");
    } catch (caught) {
      toast.show(getErrorMessage(caught), "error");
    } finally {
      setTrackSaving(false);
    }
  };

  const onAvatarPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    try {
      const processed = await cropCompressImage(file);
      const ext = processed.type === "image/webp" ? "webp" : "jpg";
      const updated = await uploadMyAvatar(new File([processed], `avatar.${ext}`, { type: processed.type }));
      applyProfileUpdate(updated);
      toast.show("Photo updated", "success");
    } catch (caught) {
      toast.show(getErrorMessage(caught), "error");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      const updated = await deleteMyAvatar();
      applyProfileUpdate(updated);
      toast.show("Photo removed", "success");
    } catch (caught) {
      toast.show(getErrorMessage(caught), "error");
    } finally {
      setAvatarBusy(false);
      setConfirmRemove(false);
    }
  };

  const dismissProfileTips = () => {
    if (!profile) return;
    window.localStorage.setItem(setupDismissalKey(profile.id), "true");
    setProfileTipsDismissed(true);
  };

  const restoreProfileTips = () => {
    if (!profile) return;
    window.localStorage.removeItem(setupDismissalKey(profile.id));
    setProfileTipsDismissed(false);
    toast.show("Profile tips restored", "success");
  };

  if (loading) {
    return (
      <div className="page-shell profile-shell">
        <section className="profile-header ws-panel">
          <span className="ws-skeleton ws-skeleton-avatar" />
          <div className="profile-header-main" style={{ width: "100%" }}>
            <span className="ws-skeleton ws-skeleton-line" style={{ width: "40%", height: 22 }} />
            <span className="ws-skeleton ws-skeleton-line" style={{ width: "60%" }} />
            <span className="ws-skeleton ws-skeleton-line" style={{ width: "30%" }} />
          </div>
        </section>
        <section className="ws-panel">
          <span className="ws-skeleton ws-skeleton-line" style={{ width: "25%", height: 16 }} />
          <div className="ws-stat-grid" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="ws-skeleton" style={{ height: 96 }} />
            ))}
          </div>
        </section>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="page-shell profile-shell">
        <Notice tone="error">{error || "Profile unavailable."}</Notice>
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={() => void load()}>Try again</Button>
          <Link className="button button-outline" href="/onboarding">Sign in again</Link>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name?.trim() || "Add your name";
  const memberSince = profile.created_at ? formatDate(profile.created_at) : null;
  const activityLabel = profile.role === "student" ? "Progress" : profile.role === "instructor" ? "Teaching" : "Stewardship";
  const done: Record<string, boolean> = {
    name: Boolean(profile.display_name?.trim()),
    bio: Boolean(profile.bio?.trim()),
  };
  const actOnStep = (key: string) => {
    if (key === "name") startEdit("name", profile.display_name || "");
    else startEdit("bio", profile.bio || "");
  };

  return (
    <div className="page-shell profile-shell">
      <section className="profile-header ws-panel">
        <div className="profile-avatar-col">
          <div className="profile-avatar-control">
            <UserAvatar seed={profile.pseudonym_id} name={displayName} url={profile.avatar_url} size="profile" busy={avatarBusy} />
            <details className="profile-avatar-menu">
              <summary aria-label="Edit profile photo" title="Edit profile photo"><span aria-hidden="true">✎</span></summary>
              <div className="profile-avatar-menu-popover">
                <button type="button" disabled={avatarBusy} onClick={() => fileInputRef.current?.click()}>
                  {profile.avatar_url ? "Change photo" : "Add a photo"}
                </button>
                {profile.avatar_url ? (
                  <button type="button" disabled={avatarBusy} onClick={() => setConfirmRemove(true)}>Remove photo</button>
                ) : null}
              </div>
            </details>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void onAvatarPicked(event)}
          />
          {!profile.avatar_url ? <span className="profile-avatar-optional">Photo optional</span> : null}
        </div>

        <div className="profile-header-main">
          <div className="profile-header-top">
            {editingField === "name" ? (
              <span className="profile-inline-name" style={{ flex: 1 }}>
                <input
                  className="profile-inline-input"
                  aria-label="Display name"
                  autoFocus
                  maxLength={120}
                  value={draft}
                  disabled={savingField}
                  placeholder="Your name"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveField();
                    if (event.key === "Escape") cancelEdit();
                  }}
                  onBlur={() => void saveField()}
                />
              </span>
            ) : (
              <button
                type="button"
                className="profile-editable"
                data-tooltip="Click to edit your name"
                onClick={() => startEdit("name", profile.display_name || "")}
              >
                <h1 style={{ margin: 0 }}>{displayName}</h1>
                <span className="profile-edit-pencil" aria-hidden="true">✎</span>
              </button>
            )}
            <StatusChip
              state={profile.role}
              label={ROLE_LABEL[profile.role]}
              tone={profile.role === "admin" ? "muted" : profile.role === "instructor" ? "info" : "good"}
            />
          </div>

          <p className="profile-header-meta">
            Account ID <code>{shortId(profile.pseudonym_id)}</code>
            {memberSince ? <> · Member since {memberSince}</> : null}
          </p>

          {profile.role === "student" ? (
            <p className="profile-header-meta">
              {LANGUAGE_LABEL[profile.enrolled_language] || profile.enrolled_language} track · Year {profile.year_level} · Semester {profile.semester}{" "}
              <button
                type="button"
                className="ws-inline-link"
                onClick={() => {
                  if (!trackOpen) {
                    setLanguage((profile.enrolled_language as ProgrammingLanguage) || "python");
                    setYearLevel(profile.year_level || 1);
                    setSemester(profile.semester || 1);
                  }
                  setTrackOpen((open) => !open);
                }}
              >
                {trackOpen ? "Close" : "Edit track"}
              </button>
            </p>
          ) : null}

          {trackOpen && profile.role === "student" ? (
            <div className="profile-track-edit">
              <div className="profile-track-grid">
                <label className="profile-track-field">
                  <span>Learning language</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)}>
                    {LANGUAGES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="profile-track-field">
                  <span>Year level</span>
                  <select value={yearLevel} onChange={(event) => setYearLevel(Number(event.target.value))}>
                    {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Year {value}</option>)}
                  </select>
                </label>
                <label className="profile-track-field">
                  <span>Semester</span>
                  <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                    {[1, 2].map((value) => <option key={value} value={value}>Semester {value}</option>)}
                  </select>
                </label>
              </div>
              <div className="ws-inline-actions" style={{ marginTop: 10 }}>
                <Button variant="primary" disabled={trackSaving} onClick={() => void saveTrack()}>
                  {trackSaving ? "Saving…" : "Save track"}
                </Button>
                <Button variant="quiet" disabled={trackSaving} onClick={() => setTrackOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}

          {editingField === "bio" ? (
            <div style={{ marginTop: 10 }}>
              <textarea
                className="profile-inline-textarea"
                aria-label="Bio"
                autoFocus
                rows={3}
                maxLength={500}
                value={draft}
                disabled={savingField}
                placeholder="A short line about you"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") cancelEdit();
                }}
              />
              <div className="profile-inline-actions">
                <Button variant="primary" disabled={savingField} onClick={() => void saveField()}>
                  {savingField ? "Saving…" : "Save bio"}
                </Button>
                <Button variant="quiet" disabled={savingField} onClick={cancelEdit}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="profile-editable profile-bio"
              data-tooltip="Click to edit your bio"
              onClick={() => startEdit("bio", profile.bio || "")}
            >
              <span className={profile.bio ? "" : "ws-muted"}>{profile.bio || "Add a short introduction — optional"}</span>
              <span className="profile-edit-pencil" aria-hidden="true">✎</span>
            </button>
          )}
        </div>
      </section>

      <nav className="profile-tabs" aria-label="Profile sections">
        <Link href="/profile" scroll={false} aria-current={activeTab === "overview" ? "page" : undefined}>Overview</Link>
        <Link href="/profile?tab=activity" scroll={false} aria-current={activeTab === "activity" ? "page" : undefined}>{activityLabel}</Link>
        <Link href="/profile?tab=account" scroll={false} aria-current={activeTab === "account" ? "page" : undefined}>Account</Link>
      </nav>

      {activeTab === "overview" && !profileTipsDismissed && COMPLETE_STEPS.some((step) => !done[step.key]) ? (
        <section className="profile-setup-card" aria-labelledby="profile-tips-title">
          <div className="profile-setup-copy">
            <p className="eyebrow-label">OPTIONAL PROFILE TIPS</p>
            <h2 id="profile-tips-title">Make ByteQuest feel more personal</h2>
            <p>These details help ByteQuest address you clearly. They never affect access, grades, or permissions.</p>
          </div>
          <ul className="profile-complete-list">
            {COMPLETE_STEPS.filter((step) => !done[step.key]).map((step) => (
              <li key={step.key}>
                <button type="button" onClick={() => actOnStep(step.key)}>{step.label}</button>
              </li>
            ))}
          </ul>
          <div className="profile-setup-footer">
            <span>Profile photo is always optional.</span>
            <button type="button" className="ws-inline-link" onClick={dismissProfileTips}>Not now</button>
          </div>
        </section>
      ) : null}

      {activeTab !== "account" && analyticsLoading ? (
        <section className="ws-panel" role="status" aria-label="Loading profile analytics">
          <span className="ws-skeleton ws-skeleton-line" style={{ width: "25%", height: 16 }} />
          <div className="ws-stat-grid" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3].map((index) => <span key={index} className="ws-skeleton" style={{ height: 96 }} />)}
          </div>
        </section>
      ) : null}

      {activeTab !== "account" && analyticsError ? (
        <section className="ws-panel" aria-labelledby="analytics-error-title">
          <h2 id="analytics-error-title">Progress is temporarily unavailable</h2>
          <Notice tone="error">{analyticsError}</Notice>
          <Button variant="outline" onClick={() => void loadAnalytics()}>Retry progress</Button>
        </section>
      ) : null}

      {activeTab === "overview" && analytics?.student ? <StudentOverview a={analytics.student} /> : null}
      {activeTab === "overview" && analytics?.instructor ? <InstructorOverview a={analytics.instructor} /> : null}
      {activeTab === "overview" && analytics?.admin ? <AdminOverview a={analytics.admin} /> : null}

      {activeTab === "activity" && analytics?.student ? <StudentSections a={analytics.student} /> : null}
      {activeTab === "activity" && analytics?.instructor ? <InstructorSections a={analytics.instructor} /> : null}
      {activeTab === "activity" && analytics?.admin ? <AdminSections a={analytics.admin} /> : null}

      {activeTab === "account" ? (
        <AccountPanel
          profile={profile}
          memberSince={memberSince}
          profileTipsDismissed={profileTipsDismissed}
          onRestoreProfileTips={restoreProfileTips}
        />
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove profile photo?"
        confirmLabel="Remove photo"
        tone="danger"
        busy={avatarBusy}
        onConfirm={() => void removeAvatar()}
        onCancel={() => setConfirmRemove(false)}
      >
        Your avatar will fall back to the generated pattern. You can upload a new photo any time.
      </ConfirmDialog>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="page-shell profile-shell"><section className="profile-header ws-panel"><span className="ws-skeleton ws-skeleton-avatar" /></section></div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
