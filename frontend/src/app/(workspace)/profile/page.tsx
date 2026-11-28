"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { apiRequest, ApiError, getErrorMessage } from "@/lib/api";
import { Button, ConfirmDialog, Notice, StatCard } from "@/components/workspace/ui";
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
} from "@/lib/workspace";
import type { Profile } from "@/lib/types";
import { ProfileHeader, ROLE_LABEL } from "@/components/profile/profile-header";
import { MeterList } from "@/components/insights/ui";
import { DebuggerCodex } from "@/components/profile/debugger-codex";
import { StudentProgress } from "@/components/profile/student-progress";
import { MasteryMap } from "@/components/mastery-map";
import { MemoryCheck } from "@/components/memory-check";
import { Leaderboard } from "@/components/leaderboard";

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
  const analyticsRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const tabParam = searchParams.get("tab");
  const student = profile?.role === "student";
  const activeTab = tabParam === "account" || (student && (tabParam === "mastery" || tabParam === "rankings"))
    ? tabParam : "activity";
  const progressKey = profile ? `${profile.id}:${profile.workshop_languages.join(",")}` : null;

  const loadAnalytics = useCallback(async () => {
    const request = ++analyticsRequest.current;
    setAnalyticsLoading(true);
    setAnalyticsError("");
    setAnalytics(null);
    try {
      const result = await getMyAnalytics();
      if (request === analyticsRequest.current) setAnalytics(result);
    } catch (caught) {
      if (request === analyticsRequest.current) setAnalyticsError(getErrorMessage(caught));
    } finally {
      if (request === analyticsRequest.current) setAnalyticsLoading(false);
    }
  }, []);
  const invalidateAnalytics = useCallback(() => { analyticsRequest.current++; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) {
        router.replace("/onboarding");
        return;
      }
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
  }, [router]);

  useEffect(() => {
    if (activeTab !== "activity" || !progressKey) return;
    // Reload for the current learner and language when opening Progress.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalytics();
    return invalidateAnalytics;
  }, [activeTab, progressKey, loadAnalytics, invalidateAnalytics]);

  // Consume edit deep links once the header has opened the requested field.
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
        editOnOpen={editParam === "handle" ? "handle" : editParam === "track" && student ? "track" : undefined}
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

      <nav className={student ? "profile-tabs profile-tabs-student" : "profile-tabs"} aria-label="Profile sections">
        <Link href="/profile?tab=activity" scroll={false} aria-current={activeTab === "activity" ? "page" : undefined}>{activityLabel}</Link>
        {student ? <>
          <Link href="/profile?tab=mastery" scroll={false} aria-current={activeTab === "mastery" ? "page" : undefined}>Mastery</Link>
          <Link href="/profile?tab=rankings" scroll={false} aria-current={activeTab === "rankings" ? "page" : undefined}>Rankings</Link>
        </> : null}
        <Link href="/profile?tab=account" scroll={false} aria-current={activeTab === "account" ? "page" : undefined}>Account</Link>
      </nav>

      {activeTab === "activity" && analyticsLoading ? (
        <section className="ws-panel" role="status" aria-label="Loading profile analytics">
          <span className="ws-skeleton ws-skeleton-line" style={{ width: "25%", height: 16 }} />
          <div className="ws-stat-grid" style={{ marginTop: 12 }}>
            {[0, 1, 2, 3].map((index) => <span key={index} className="ws-skeleton" style={{ height: 96 }} />)}
          </div>
        </section>
      ) : null}

      {activeTab === "activity" && analyticsError ? (
        <section className="ws-panel" aria-labelledby="analytics-error-title">
          <h2 id="analytics-error-title">Progress is temporarily unavailable</h2>
          <Notice tone="error">{analyticsError}</Notice>
          <Button variant="outline" onClick={() => void loadAnalytics()}>Retry progress</Button>
        </section>
      ) : null}

      {activeTab === "activity" && analytics?.student ? <StudentProgress key={progressKey} a={analytics.student} profile={profile} /> : null}
      {activeTab === "mastery" ? <>
        <MemoryCheck key={`memory:${progressKey}`} userId={profile.id} />
        <section className="ws-panel" aria-labelledby="mastery-title">
          <h2 id="mastery-title">Mastery map</h2>
          <p className="ws-muted">Choose a concept to practice it in the Quest Map.</p>
          <MasteryMap key={progressKey} />
        </section>
        <DebuggerCodex userId={profile.id} />
      </> : null}
      {activeTab === "rankings" ? <Leaderboard key={progressKey} /> : null}
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
