"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useSignOut } from "@/hooks/use-sign-out";
import type { Profile } from "@/lib/types";

interface ProgressAttemptApi {
  attempt_id: string;
  title: string | null;
  activity_type: "quiz" | "challenge";
  score_percentage: number;
  is_successful: boolean;
  xp_awarded: number;
  created_at: string;
}

interface ProgressBadgeApi {
  code: string | null;
  name: string;
  description: string;
  xp_bonus: number;
}

interface ProgressResponseApi {
  total_attempts: number;
  attempts: ProgressAttemptApi[];
  badges: ProgressBadgeApi[];
  next_recommendation: {
    target_activity_id: string | null;
    rationale: string;
  } | null;
}

interface JourneyBadge {
  id: string;
  name: string;
  description: string;
  xpBonus: number;
}

interface JourneySubmission {
  id: string;
  title: string;
  language: string;
  type: string;
  timestamp: string;
  score: string;
  xp: number;
}

export function JourneyView() {
  const { isSigningOut, error: signOutError, signOut } = useSignOut();
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [liveProgress, setLiveProgress] = useState<ProgressResponseApi | null>(null);
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSignedIn(Boolean(data.session));
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSignedIn(false);
          setLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSignedIn(Boolean(session));
        setLoading(false);
        if (!session) {
          setProfile(null);
          setLiveProgress(null);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;

    void apiRequest<Profile>("/profile/me")
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) setProfile(null);
      });

    void apiRequest<ProgressResponseApi>("/quests/progress?limit=20&offset=0")
      .then((value) => {
        if (active) setLiveProgress(value);
      })
      .catch(() => {
        if (active) setLiveProgress(null);
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  const effectivePseudonym = profile?.pseudonym_id ?? "Learner";
  const effectiveLevel = profile?.current_level ?? 1;
  const effectiveXp = profile?.xp_points ?? 0;

  const effectiveRecommended = liveProgress?.next_recommendation
    ? {
        title: liveProgress.next_recommendation.rationale,
        href: liveProgress.next_recommendation.target_activity_id
          ? `/quests#quest-${liveProgress.next_recommendation.target_activity_id}`
          : "/quests",
      }
    : {
        title: "Continue with the next published activity in this language track.",
        href: "/quests",
      };

  const effectiveBadges: JourneyBadge[] =
    liveProgress?.badges.map((badge) => ({
      id: badge.code || badge.name,
      name: badge.name,
      description: badge.description,
      xpBonus: badge.xp_bonus,
    })) ?? [];

  const effectiveSubmissions: JourneySubmission[] =
    liveProgress?.attempts.map((attempt) => ({
      id: attempt.attempt_id,
      title: attempt.title || "Quest attempt",
      language: profile?.enrolled_language
        ? profile.enrolled_language.toUpperCase()
        : "Code",
      type: attempt.activity_type === "quiz" ? "Lessons Review" : "Code Challenge",
      timestamp: new Date(attempt.created_at).toLocaleString([], {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      score: `${Math.round(attempt.score_percentage)}%`,
      xp: attempt.xp_awarded,
    })) ?? [];

  return (
    <section className="qm-panel hub-panel journey-panel" aria-labelledby="journey-title">
      <div className="hub-panel-heading">
        <div className="hub-panel-copy">
          <h1 id="journey-title">Your Journey</h1>
          <p>Your level, XP, badges, next recommendation, and recent submissions.</p>
        </div>
        {signedIn && <span className="profile-status-pill">Level {effectiveLevel}</span>}
      </div>

      {loading ? (
        <p className="hub-loading" role="status">
          Loading your journey…
        </p>
      ) : signedIn ? (
        <div className="drawer-journey-card hub-journey-card">
          <div className="drawer-user-identity">
            <span className="profile-level-badge">L{effectiveLevel}</span>
            <div className="drawer-user-names">
              <strong className="drawer-pseudonym" title={effectivePseudonym}>
                {effectivePseudonym}
              </strong>
              <span className="drawer-role-pill">
                {profile?.role || "student"} ·{" "}
                {profile?.enrolled_language
                  ? profile.enrolled_language.toUpperCase()
                  : "TRACK"}
              </span>
            </div>
            <div className="drawer-xp-pill">
              <span>✦</span> {effectiveXp} XP
            </div>
          </div>

          <div className="profile-recommendation-card" style={{ margin: "4px 0 0" }}>
            <p className="profile-rec-eyebrow">NEXT RECOMMENDATION</p>
            <p className="profile-rec-text">{effectiveRecommended.title}</p>
            <Link href={effectiveRecommended.href} className="profile-rec-link">
              View recommended quest <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="drawer-badges-preview">
            <div className="drawer-subheading">
              <span>Badges Earned</span>
              <span className="profile-count-pill">{effectiveBadges.length}</span>
            </div>
            {effectiveBadges.length > 0 ? (
              <div className="profile-badges-list">
                {effectiveBadges.slice(0, 3).map((badge) => (
                  <div key={badge.id} className="profile-badge-item">
                    <span className="profile-badge-icon" aria-hidden="true">
                      ✦
                    </span>
                    <div className="profile-badge-info">
                      <p className="profile-badge-name">{badge.name}</p>
                      <p className="profile-badge-desc">{badge.description}</p>
                    </div>
                    <span className="profile-badge-xp">+{badge.xpBonus} XP</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hub-empty-note">
                No badges earned yet. Complete your first activity to start your collection.
              </p>
            )}
          </div>

          <div className="drawer-submissions-preview">
            <div className="drawer-subheading">
              <span>Recent Submissions</span>
              <span className="profile-count-pill">{effectiveSubmissions.length}</span>
            </div>
            {effectiveSubmissions.length > 0 ? (
              <>
                <div className="profile-history-list">
                  {(showAllSubmissions
                    ? effectiveSubmissions
                    : effectiveSubmissions.slice(0, 2)
                  ).map((item) => (
                    <div key={item.id} className="profile-history-card">
                      <div className="profile-history-card-top">
                        <span className="profile-history-title" title={item.title}>
                          {item.title}
                        </span>
                        <span className="profile-history-status">Passed</span>
                      </div>
                      <div className="profile-history-card-bottom">
                        <span>
                          {item.type} · {item.score}
                        </span>
                        <span className="profile-history-xp">+{item.xp} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
                {effectiveSubmissions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSubmissions((current) => !current)}
                    className="profile-history-toggle-btn"
                  >
                    {showAllSubmissions
                      ? "Show fewer submissions"
                      : `View all ${effectiveSubmissions.length} submissions`}
                  </button>
                )}
              </>
            ) : (
              <p className="hub-empty-note">
                No submissions yet. Your attempts and scores will appear here.
              </p>
            )}
          </div>

          <div className="drawer-account-actions">
            <Link href="/onboarding?mode=change_track" className="drawer-action-link">
              Change learning track
            </Link>
            <button
              type="button"
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              onClick={() => void signOut()}
              className="drawer-signout-btn"
            >
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
          {signOutError && (
            <p className="profile-signout-error" role="status">
              {signOutError}
            </p>
          )}
        </div>
      ) : (
        <div className="drawer-signin-box hub-signin-box">
          <p>Sign in to save your quest submissions, track XP, and unlock badges.</p>
          <Link
            href="/onboarding"
            className="button button-primary"
            style={{ width: "100%", justifyContent: "center", minHeight: 40 }}
          >
            Sign in or get started →
          </Link>
        </div>
      )}
    </section>
  );
}
