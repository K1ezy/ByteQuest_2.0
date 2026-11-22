"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { apiRequest, ApiError, getErrorMessage } from "@/lib/api";
import { Button, ConfirmDialog, Notice, StatCard, StatusChip } from "@/components/workspace/ui";
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
  uploadMyAvatar,
  type AdminAnalytics,
  type InstructorAnalytics,
  type ProfileAnalytics,
  type ProfileAuditEntry,
  type StudentAnalytics,
  type HelpPattern,
} from "@/lib/workspace";
import type { Profile } from "@/lib/types";
import { ProfileHeader, ROLE_LABEL } from "@/components/profile/profile-header";
import { MeterList, PracticeLink } from "@/components/insights/ui";
import { InsightLineChart } from "@/components/insights/line-chart";
import { metrics } from "@/lib/insight-metrics";
import { DebuggerCodex } from "@/components/profile/debugger-codex";

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

function StudentSections({ a }: { a: StudentAnalytics }) {
  const typeLabel = (t: string) => (t === "quiz" ? "Quizzes" : t === "challenge" ? "Coding challenges" : t);
  return (
    <>

      <div className="ws-stat-grid">
        <StatCard label={metrics.attempts_passed.label} value={Math.round(a.pass_rate) + "%"} hint={a.successful_attempts + "/" + a.total_attempts + " passed"} />
        <StatCard label={metrics.average_attempt_score.label} value={Math.round(a.average_score) + "%"} hint={"Best " + Math.round(a.best_score) + "%"} />
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
              <p className="eyebrow-label">TREND</p>
              <h2 id="trend-title">Recent score trend</h2>
            </div>
          </div>
          <InsightLineChart label="Recent score trend" xLabel="Attempt date" domain={[0,100]} numericX
            formatX={time => formatDateTime(new Date(Number(time)).toISOString())}
            rows={a.score_trend.map(p => ({ x: Date.parse(p.created_at), score: p.score_percentage }))}
            series={[{ key: "score", label: "Score (%)", token: "var(--chart-series)" }]}
            summary={a.score_trend.length ? "From " + Math.round(a.score_trend[0].score_percentage) + "% to "
              + Math.round(a.score_trend[a.score_trend.length - 1].score_percentage) + "% across " + a.score_trend.length + " attempts." : ""} />
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
              name: t.topic, value: t.average_score, total: 100, figure: Math.round(t.average_score) + "%",
              detail: <>{t.attempts} tries {t.topic !== "General" && <PracticeLink topic={t.topic} />}</>,
            }))} />
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

      <section className="ws-panel" id="badges" aria-labelledby="badges-title">
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

function InstructorSections({ a }: { a: InstructorAnalytics }) {
  return (<>
    <section className="ws-panel" aria-labelledby="teach-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">YOUR CONTRIBUTIONS</p>
          <h2 id="teach-title">Teaching activity</h2>
        </div>
        <Link className="button button-outline" href="/instructor">Manage teaching</Link>
      </div>
      <div className="ws-stat-grid">
        <StatCard label="Courses" value={a.courses} />
        <StatCard label="Activities created" value={a.activities_created} hint={`${a.activities_published} published`} icon="✎" tone="info" />
        <StatCard label="Drafts reviewed" value={a.drafts_reviewed} hint="Learning content checked" icon="✓" tone="good" />
        <StatCard label="Materials uploaded" value={a.materials_uploaded} hint="Teaching resources" icon="▤" tone="info" />
        <StatCard label="Learners taught" value={a.learners_taught} hint={`Across ${a.courses} courses`} icon="◉" tone="good" />
      </div>
      <p className="ws-footnote">Review drafts, materials, schedules, and class performance remain in the instructor workspace.</p>
    </section>
      <PersonalTimeline
        entries={a.recent_activity ?? []}
        title="Your recent contributions"
        emptyLabel="Your reviews, uploads and publishing will appear here."
      />
    </>
  );
}

function AdminSections({ a }: { a: AdminAnalytics }) {
  return (<>
      <div className="ws-stat-grid">
        <StatCard label="Accounts" value={a.total_accounts} hint="All roles" icon="◉" tone="info" />
        <StatCard label="Courses" value={a.total_courses} icon="▦" tone="info" />
        <StatCard label="Activities" value={a.total_activities} icon="▣" tone="info" />
        <StatCard label="Materials" value={a.total_materials} hint="Current versions" icon="▤" tone="good" />
      </div>
      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="roles-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">ACCOUNTS</p>
              <h2 id="roles-title">Accounts by role</h2>
            </div>
          </div>
          <MeterList label="Accounts by role" rows={Object.entries(a.accounts_by_role).map(([role, count]) => ({
            name: ROLE_LABEL[role as Profile["role"]] || role, value: count, total: a.total_accounts, figure: String(count),
          }))} />
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
}: {
  profile: Profile;
  memberSince: string | null;
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
          <div><dt>Public handle</dt><dd>{profile.handle_chosen === false ? "Not chosen yet" : `@${profile.username}`}</dd></div>
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
          <Link className="button button-outline" href="/account/accessibility">Open settings</Link>
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

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "account" ? "account" : "activity";

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
      setProfile(await getMyProfile());
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

  // The ?edit=handle deep link is consumed once the header has mounted, so a refresh
  // does not reopen the editor.
  const editParam = searchParams.get("edit");
  useEffect(() => {
    if (profile && editParam) router.replace(activeTab === "activity" ? "/profile" : `/profile?tab=${activeTab}`, { scroll: false });
  }, [profile, editParam, activeTab, router]);

  useEffect(() => {
    // Kicking off the initial load is the effect's whole purpose here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const applyProfileUpdate = (updated: Profile) => {
    setProfile(updated);
    publishProfileUpdate(updated);
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

  // Alt text only; a generated starter handle would be noise to screen readers.
  const avatarName = profile.display_name?.trim() || (profile.handle_chosen === false ? ROLE_LABEL[profile.role] : `@${profile.username}`);
  const memberSince = profile.created_at ? formatDate(profile.created_at) : null;
  const activityLabel = profile.role === "student" ? "Progress" : profile.role === "instructor" ? "Teaching" : "Stewardship";

  return (
    <div className="page-shell profile-shell">
      <ProfileHeader
        profile={profile}
        onUpdated={applyProfileUpdate}
        editHandleOnOpen={searchParams.get("edit") === "handle"}
        avatar={(
        <div className="profile-avatar-col">
          <div className="profile-avatar-control">
            <UserAvatar seed={profile.pseudonym_id} name={avatarName} url={profile.avatar_url} size="profile" busy={avatarBusy} />
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

        )}
      />

      <nav className="profile-tabs" aria-label="Profile sections">
        <Link href="/profile?tab=activity" scroll={false} aria-current={activeTab === "activity" ? "page" : undefined}>{activityLabel}</Link>
        <Link href="/profile?tab=account" scroll={false} aria-current={activeTab === "account" ? "page" : undefined}>Account</Link>
      </nav>

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

      {/* Progress comes first; Debugger's Codex is a reward that may still be locked. */}
      {activeTab === "activity" && analytics?.student ? <StudentSections a={analytics.student} /> : null}
      {activeTab === "activity" && profile.role === "student" ? <DebuggerCodex userId={profile.id} /> : null}
      {activeTab === "activity" && analytics?.instructor ? <InstructorSections a={analytics.instructor} /> : null}
      {activeTab === "activity" && analytics?.admin ? <AdminSections a={analytics.admin} /> : null}

      {activeTab === "account" ? (
        <AccountPanel profile={profile} memberSince={memberSince} />
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
