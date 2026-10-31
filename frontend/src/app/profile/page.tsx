"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/api";
import { Button, Notice, StatCard, StatusChip, shortId } from "@/components/workspace/ui";
import {
  deleteMyAvatar,
  formatDateTime,
  getMyAnalytics,
  getMyProfile,
  updateMyProfile,
  updateMyTrack,
  uploadMyAvatar,
  type AdminAnalytics,
  type InstructorAnalytics,
  type ProfileAnalytics,
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

function initialOf(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] || "?").toUpperCase();
}

function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

function ProfileAvatar({ name, seed, url }: { name: string; seed: string; url?: string | null }) {
  const hue = hueFromSeed(seed);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="profile-avatar" src={url} alt="" />;
  }
  return (
    <span
      className="profile-avatar profile-avatar-mono"
      aria-hidden="true"
      style={{ background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 52% 32%)` }}
    >
      {initialOf(name)}
    </span>
  );
}

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
  return (
    <svg className="profile-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent score trend">
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
          <div className="profile-bar-track">
            <div className="profile-bar-fill" style={{ width: `${Math.max(2, Math.min(100, item.value))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function StudentSections({ a }: { a: StudentAnalytics }) {
  const typeLabel = (t: string) => (t === "quiz" ? "Quizzes" : t === "challenge" ? "Coding challenges" : t);
  return (
    <>
      <section className="ws-panel" aria-labelledby="student-stats-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">PROGRESS</p>
            <h2 id="student-stats-title">Your results at a glance</h2>
          </div>
        </div>
        <div className="ws-stat-grid">
          <StatCard label="Level" value={a.current_level} hint={`${a.xp_points} XP`} icon="★" tone="good" />
          <StatCard label="Pass rate" value={`${Math.round(a.pass_rate)}%`} hint={`${a.successful_attempts}/${a.total_attempts} passed`} icon="✓" tone={a.pass_rate >= 60 ? "good" : "wait"} />
          <StatCard label="Average score" value={`${Math.round(a.average_score)}%`} hint={`Best ${Math.round(a.best_score)}%`} icon="◎" tone="info" />
          <StatCard label="Badges" value={a.badge_count} hint={`${Math.round(a.total_time_seconds / 60)} min practised`} icon="▲" tone="info" />
        </div>
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
                    {exam.submitted_at ? `Submitted ${formatDateTime(exam.submitted_at)}` : "In progress"}
                  </span>
                </div>
                <div className="ws-row-actions">
                  <StatusChip state={exam.status} />
                  <strong>
                    {exam.score === null ? "—" : `${Math.round(exam.score)}${exam.max_score ? ` / ${Math.round(exam.max_score)}` : ""}`}
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
                <span className="profile-badge-icon" aria-hidden="true">★</span>
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

function InstructorSections({ a }: { a: InstructorAnalytics }) {
  return (
    <section className="ws-panel" aria-labelledby="teach-title">
      <div className="ws-panel-head">
        <div>
          <p className="eyebrow-label">TEACHING</p>
          <h2 id="teach-title">Your teaching activity</h2>
        </div>
      </div>
      <div className="ws-stat-grid">
        <StatCard label="Courses" value={a.courses} hint="Assigned to you" icon="▦" tone="info" />
        <StatCard label="Learners taught" value={a.learners_taught} hint="Across your courses" icon="◉" tone="good" />
        <StatCard label="Activities created" value={a.activities_created} hint={`${a.activities_published} published`} icon="✎" tone="info" />
        <StatCard label="Drafts reviewed" value={a.drafts_reviewed} hint={`${a.materials_uploaded} materials uploaded`} icon="✓" tone="good" />
      </div>
    </section>
  );
}

function AdminSections({ a }: { a: AdminAnalytics }) {
  const total = Object.values(a.accounts_by_role).reduce((sum, value) => sum + value, 0) || 1;
  return (
    <>
      <section className="ws-panel" aria-labelledby="admin-stats-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">PLATFORM</p>
            <h2 id="admin-stats-title">Platform overview</h2>
          </div>
        </div>
        <div className="ws-stat-grid">
          <StatCard label="Accounts" value={a.total_accounts} hint="All roles" icon="◉" tone="info" />
          <StatCard label="Courses" value={a.total_courses} icon="▦" tone="info" />
          <StatCard label="Activities" value={a.total_activities} icon="▣" tone="info" />
          <StatCard label="Materials" value={a.total_materials} hint="Current versions" icon="▤" tone="good" />
        </div>
      </section>

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
          {a.recent_audit.length === 0 ? (
            <p className="ws-muted">No recorded activity yet.</p>
          ) : (
            <ul className="ws-compact-list">
              {a.recent_audit.map((event, index) => (
                <li key={index}>
                  <strong>{event.summary}</strong>
                  <span>{event.action} · {formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState<ProgrammingLanguage>("python");
  const [yearLevel, setYearLevel] = useState(1);
  const [semester, setSemester] = useState(1);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) {
        router.replace("/onboarding");
        return;
      }
      const [me, stats] = await Promise.all([getMyProfile(), getMyAnalytics()]);
      setProfile(me);
      setAnalytics(stats);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Kicking off the initial load is the effect's whole purpose here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const beginEdit = useCallback(() => {
    if (!profile) return;
    setName(profile.display_name || "");
    setBio(profile.bio || "");
    setLanguage((profile.enrolled_language as ProgrammingLanguage) || "python");
    setYearLevel(profile.year_level || 1);
    setSemester(profile.semester || 1);
    setSaveError("");
    setEditing(true);
  }, [profile]);

  const save = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateMyProfile({ display_name: name, bio });
      if (profile.role === "student") {
        await updateMyTrack({ enrolled_language: language, year_level: yearLevel, semester });
      }
      setEditing(false);
      await load();
    } catch (caught) {
      setSaveError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [profile, name, bio, language, yearLevel, semester, load]);

  if (loading) {
    return (
      <div className="page-shell profile-shell">
        <p className="ws-muted">Loading your profile…</p>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="page-shell profile-shell">
        <Notice tone="error">{error || "Profile unavailable."}</Notice>
        <p><Link href="/onboarding">Sign in</Link></p>
      </div>
    );
  }

  const displayName = profile.display_name?.trim() || shortId(profile.pseudonym_id);
  const memberSince = profile.created_at ? formatDateTime(profile.created_at) : null;

  const onAvatarPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1_048_576) {
      setAvatarError("Image must be 1 MB or smaller.");
      return;
    }
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const updated = await uploadMyAvatar(file);
      setProfile(updated);
    } catch (caught) {
      setAvatarError(getErrorMessage(caught));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const updated = await deleteMyAvatar();
      setProfile(updated);
    } catch (caught) {
      setAvatarError(getErrorMessage(caught));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="page-shell profile-shell">
      <section className="profile-header ws-panel">
        <div className="profile-avatar-col">
          <ProfileAvatar name={displayName} seed={profile.pseudonym_id} url={profile.avatar_url} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void onAvatarPicked(event)}
          />
          <div className="profile-avatar-actions">
            <button
              type="button"
              className="ws-inline-link"
              disabled={avatarBusy}
              data-tooltip="Upload a profile photo (PNG, JPEG or WebP, up to 1 MB)"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarBusy ? "Working…" : profile.avatar_url ? "Change photo" : "Add photo"}
            </button>
            {profile.avatar_url ? (
              <button type="button" className="ws-inline-link" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                Remove
              </button>
            ) : null}
          </div>
          {avatarError ? <p className="profile-avatar-error" role="alert">{avatarError}</p> : null}
        </div>
        <div className="profile-header-main">
          <div className="profile-header-top">
            <h1>{displayName}</h1>
            <StatusChip state={profile.role} label={ROLE_LABEL[profile.role]} tone={profile.role === "admin" ? "bad" : profile.role === "instructor" ? "info" : "good"} />
          </div>
          <p className="profile-header-meta">
            <code>{shortId(profile.pseudonym_id)}</code>
            {profile.email ? <> · {profile.email}</> : null}
            {memberSince ? <> · Member since {memberSince}</> : null}
          </p>
          {profile.role === "student" ? (
            <p className="profile-header-meta">
              {LANGUAGE_LABEL[profile.enrolled_language] || profile.enrolled_language} track · Year {profile.year_level} · Semester {profile.semester}
            </p>
          ) : null}
          {profile.bio ? <p className="profile-bio">{profile.bio}</p> : <p className="ws-muted profile-bio">No bio yet.</p>}
        </div>
        {!editing ? (
          <Button variant="outline" data-tooltip="Edit your name, bio and details" onClick={beginEdit}>
            Edit profile
          </Button>
        ) : null}
      </section>

      {editing ? (
        <section className="ws-panel profile-edit" aria-label="Edit profile">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">EDIT</p>
              <h2>Edit your profile</h2>
            </div>
          </div>
          <label className="profile-field">
            <span>Display name</span>
            <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="How your name appears" />
          </label>
          <label className="profile-field">
            <span>Bio</span>
            <textarea value={bio} maxLength={500} rows={3} onChange={(event) => setBio(event.target.value)} placeholder="A short line about you (optional)" />
          </label>
          {profile.role === "student" ? (
            <div className="profile-field-row">
              <label className="profile-field">
                <span>Track</span>
                <select value={language} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)}>
                  {LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="profile-field">
                <span>Year</span>
                <select value={yearLevel} onChange={(event) => setYearLevel(Number(event.target.value))}>
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Year {value}</option>)}
                </select>
              </label>
              <label className="profile-field">
                <span>Semester</span>
                <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                  {[1, 2].map((value) => <option key={value} value={value}>Semester {value}</option>)}
                </select>
              </label>
            </div>
          ) : null}
          {saveError ? <Notice tone="error">{saveError}</Notice> : null}
          <div className="ws-inline-actions">
            <Button variant="primary" disabled={saving} data-tooltip="Save your profile changes" onClick={() => void save()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="quiet" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </section>
      ) : null}

      {analytics?.student ? <StudentSections a={analytics.student} /> : null}
      {analytics?.instructor ? <InstructorSections a={analytics.instructor} /> : null}
      {analytics?.admin ? <AdminSections a={analytics.admin} /> : null}
    </div>
  );
}
