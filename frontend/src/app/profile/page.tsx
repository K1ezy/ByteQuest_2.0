"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/api";
import { Button, ConfirmDialog, Notice, StatCard, StatusChip, shortId } from "@/components/workspace/ui";
import { useToast } from "@/components/toast";
import { cropCompressImage } from "@/lib/image";
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

function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

/** Deterministic left-right symmetric 5x5 identicon pattern from a seed. */
function identiconCells(seed: string): boolean[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = (h >>> 0) || 1;
  const nextBit = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return (x & 1) === 1;
  };
  const cells = new Array<boolean>(25).fill(false);
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const on = nextBit();
      cells[row * 5 + col] = on;
      cells[row * 5 + (4 - col)] = on;
    }
  }
  return cells;
}

function ProfileAvatar({ seed, url, busy }: { seed: string; url?: string | null; busy?: boolean }) {
  const hue = hueFromSeed(seed);
  return (
    <span className={`profile-avatar-wrap${busy ? " is-busy" : ""}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="profile-avatar" src={url} alt="" />
      ) : (
        <span className="profile-avatar" aria-hidden="true" style={{ display: "inline-block", lineHeight: 0, overflow: "hidden", background: `hsl(${hue} 70% 94%)` }}>
          <svg viewBox="0 0 5 5" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {identiconCells(seed).map((on, index) =>
              on ? (
                <rect key={index} x={index % 5} y={Math.floor(index / 5)} width="1" height="1" fill={`hsl(${hue} 52% 42%)`} />
              ) : null,
            )}
          </svg>
        </span>
      )}
      {busy ? <span className="profile-avatar-spinner" aria-hidden="true" /> : null}
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

const COMPLETE_STEPS = [
  { key: "name", label: "Add your name" },
  { key: "photo", label: "Add a photo" },
  { key: "bio", label: "Add a bio" },
] as const;

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null);
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

  const startEdit = (field: "name" | "bio", current: string) => {
    editingRef.current = field;
    setDraft(current);
    setEditingField(field);
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
      setProfile(updated);
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
      setProfile(updated);
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
      setProfile(updated);
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
      setProfile(updated);
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
        <p><Link href="/onboarding">Sign in</Link></p>
      </div>
    );
  }

  const displayName = profile.display_name?.trim() || shortId(profile.pseudonym_id);
  const memberSince = profile.created_at ? formatDateTime(profile.created_at) : null;
  const done: Record<string, boolean> = {
    name: Boolean(profile.display_name?.trim()),
    photo: Boolean(profile.avatar_url),
    bio: Boolean(profile.bio?.trim()),
  };
  const completePercent = Math.round((Object.values(done).filter(Boolean).length / COMPLETE_STEPS.length) * 100);
  const actOnStep = (key: string) => {
    if (key === "name") startEdit("name", profile.display_name || "");
    else if (key === "bio") startEdit("bio", profile.bio || "");
    else fileInputRef.current?.click();
  };

  return (
    <div className="page-shell profile-shell">
      <section className="profile-header ws-panel">
        <div className="profile-avatar-col">
          <ProfileAvatar seed={profile.pseudonym_id} url={profile.avatar_url} busy={avatarBusy} />
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
              data-tooltip="Upload a photo — it is cropped to a square and compressed automatically"
              onClick={() => fileInputRef.current?.click()}
            >
              {profile.avatar_url ? "Change photo" : "Add photo"}
            </button>
            {profile.avatar_url ? (
              <button type="button" className="ws-inline-link" disabled={avatarBusy} onClick={() => setConfirmRemove(true)}>
                Remove
              </button>
            ) : null}
          </div>
        </div>

        <div className="profile-header-main">
          {completePercent < 100 ? (
            <div className="profile-complete">
              <div className="profile-complete-top">
                <strong>Complete your profile</strong>
                <span>{completePercent}%</span>
              </div>
              <div className="profile-complete-bar">
                <div className="profile-complete-fill" style={{ width: `${completePercent}%` }} />
              </div>
              <ul className="profile-complete-list">
                {COMPLETE_STEPS.filter((step) => !done[step.key]).map((step) => (
                  <li key={step.key}>
                    <button type="button" onClick={() => actOnStep(step.key)}>{step.label}</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="profile-header-top">
            {editingField === "name" ? (
              <span className="profile-inline-name" style={{ flex: 1 }}>
                <input
                  className="profile-inline-input"
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
              tone={profile.role === "admin" ? "bad" : profile.role === "instructor" ? "info" : "good"}
            />
          </div>

          <p className="profile-header-meta">
            <code>{shortId(profile.pseudonym_id)}</code>
            {profile.email ? <> · {profile.email}</> : null}
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
                <select value={language} onChange={(event) => setLanguage(event.target.value as ProgrammingLanguage)}>
                  {LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select value={yearLevel} onChange={(event) => setYearLevel(Number(event.target.value))}>
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Year {value}</option>)}
                </select>
                <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                  {[1, 2].map((value) => <option key={value} value={value}>Semester {value}</option>)}
                </select>
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
              <span className={profile.bio ? "" : "ws-muted"}>{profile.bio || "Add a bio"}</span>
              <span className="profile-edit-pencil" aria-hidden="true">✎</span>
            </button>
          )}
        </div>
      </section>

      {analytics?.student ? <StudentSections a={analytics.student} /> : null}
      {analytics?.instructor ? <InstructorSections a={analytics.instructor} /> : null}
      {analytics?.admin ? <AdminSections a={analytics.admin} /> : null}

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
