"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest, ApiError, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { subscribeToProfileUpdates } from "@/lib/profile-events";
import { belongsTo, canOpenPath, pageLabel, primaryNavigation, questRedirect, roleLabels, usesInstructorCourseShell } from "@/lib/navigation";
import type { Profile } from "@/lib/types";
import { destinationFor } from "@/components/home-redirect";
import { AccountMenu } from "@/components/account-menu";
import { ChatShell } from "@/components/chat/chat-shell";
import { LegacyQuestRedirect } from "@/components/legacy-quest-redirect";
import { AppNavIcon } from "@/components/workspace/app-nav-icon";

const ProfileContext = createContext<Profile | null>(null);

export function useShellProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("The workspace requires a signed-in profile.");
  return profile;
}

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<{ profile?: Profile; message?: string; forbidden?: boolean; redirect?: boolean } | null>(null);
  const refreshVersion = useRef(0);
  // A visitor who arrives without a session goes straight to sign-in. Someone who was
  // signed in and then signs out is sent on by the sign-out flow, so that case keeps the card.
  const hadProfile = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const { data, error } = await getSupabase().auth.getSession();
      if (error) throw error;
      const profile = data.session ? await apiRequest<Profile>("/profile/me") : undefined;
      if (profile) hadProfile.current = true;
      if (version === refreshVersion.current) setState({ profile, redirect: !profile && !hadProfile.current });
    } catch (error) {
      if (version === refreshVersion.current) setState(error instanceof ApiError && error.status === 401
        ? { redirect: !hadProfile.current } : { message: getErrorMessage(error), forbidden: error instanceof ApiError && error.status === 403 });
    }
  }, []);
  const invalidateRefresh = useCallback(() => { refreshVersion.current++; }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 0);
      }
    });
    const unsubscribe = subscribeToProfileUpdates((profile) => setState({ profile }));
    return () => { invalidateRefresh(); clearTimeout(timer); data.subscription.unsubscribe(); unsubscribe(); };
  }, [invalidateRefresh, refresh]);

  const requestedPath = pathname + (params.size ? "?" + params.toString() : "");
  const signInHref = "/onboarding?mode=signin&redirect=" + encodeURIComponent(requestedPath);
  const shouldRedirect = Boolean(state?.redirect);
  useEffect(() => {
    if (shouldRedirect) router.replace(signInHref);
  }, [router, shouldRedirect, signInHref]);

  if (!state) return <main id="main-content" className="page-shell" role="status">Loading workspace…</main>;
  if (!state.profile) return <main id="main-content" className="page-shell">
    <section className="panel">
      <h1>{state.forbidden ? "Account access unavailable" : state.message ? "Workspace temporarily unavailable" : state.redirect ? "Taking you to sign in…" : "Sign in to continue"}</h1>
      {state.message && <p role="alert">{state.message}</p>}
      {state.message
        ? <button className="button button-primary" type="button" onClick={() => void refresh()}>Retry</button>
        : <Link className="button button-primary" href={signInHref}>Sign in</Link>}
    </section>
  </main>;
  const profile = state.profile;
  const legacyQuest = pathname === "/quests" && questRedirect(params, profile.role);
  if (legacyQuest) return <LegacyQuestRedirect target={legacyQuest} />;
  if (profile.role === "student" && profile.needs_track_setup) {
    return <LegacyQuestRedirect target={"/onboarding?redirect=" + encodeURIComponent(requestedPath)} />;
  }
  return <ProfileContext.Provider value={profile}>
    <AppShell profile={profile}>
      {canOpenPath(profile.role, pathname) ? children : (
        <section className="panel">
          <h1>This page is outside your workspace</h1>
          <p>Your {roleLabels[profile.role]} account has access to the destinations in your menu.</p>
          <Link className="button button-primary" href={destinationFor(profile)}>Back to your workspace</Link>
        </section>
      )}
    </AppShell>
  </ProfileContext.Provider>;
}

/**
 * Scrolls to the top when a new page opens. Next.js keeps the old scroll position
 * whenever part of the new page is already on screen, so phones used to land halfway
 * down the next page. Back and forward keep the browser's restored position.
 */
function useScrollResetOnRouteChange(pathname: string) {
  const firstRun = useRef(true);
  const historyStep = useRef(false);
  useEffect(() => {
    const onPopState = () => { historyStep.current = true; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (historyStep.current) { historyStep.current = false; return; }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
}

function isActiveDestination(pathname: string, href: string, index: number) {
  return (index === 0 ? pathname === href : belongsTo(pathname, href))
    || (href === "/instructor/activities" && ["/instructor/materials", "/instructor/review", "/instructor/preview", "/workshops"].some((section) => belongsTo(pathname, section)))
    || (href === "/instructor/performance" && belongsTo(pathname, "/instructor/ml"))
    || (href === "/admin" && ["/admin/configuration", "/admin/monitoring"].some((section) => belongsTo(pathname, section)))
    || (href === "/admin/courses" && belongsTo(pathname, "/admin/assignments"))
    || (href === "/admin/activities" && belongsTo(pathname, "/admin/materials"))
    || (href === "/admin/teaching" && pathname === "/workshops")
    || (href === "/quests" && ["/arena", "/quiz", "/submissions", "/reviews"].some((section) => belongsTo(pathname, section)));
}

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const hasInstructorCourseShell = profile.role === "instructor" && usesInstructorCourseShell(pathname);
  const title = hasInstructorCourseShell && pathname === "/instructor" ? "Dashboard" : pageLabel(pathname);
  const titleKey = pathname + "?" + params.toString();
  const focusExit = profile.role === "student" && /^\/(arena|quiz|exams)\/[^/]+$/.exec(pathname);
  const currentCourse = params.get("course");
  useScrollResetOnRouteChange(pathname);
  useEffect(() => {
    document.title = title + " · ByteQuest";
  }, [title]);

  if (hasInstructorCourseShell) return children;

  /* Layout: one slim top bar (brand, chat, account) and the primary destinations.
     Wide screens show the destinations as a sidebar; phones show the same links as a
     bottom tab bar, so every main page is one tap away and within thumb reach.
     Focus pages (a challenge, quiz or exam) hide the tab bar and offer one way back. */
  return <div className={focusExit ? "bq-app-shell bq-focus-shell" : "bq-app-shell bq-has-tabbar"}>
    <header className="bq-app-topbar">
      {focusExit ? <>
        <Link className="button button-outline bq-back-link" href={focusExit[1] === "exams" ? "/exams" : "/quests"}
          aria-label={focusExit[1] === "exams" ? "Back to Exams" : "Back to Quest Map"}>
          <span aria-hidden="true">←</span> <span className="bq-back-prefix">Back to </span>{focusExit[1] === "exams" ? "Exams" : "Quest Map"}
        </Link>
        <span className="bq-app-location">{title}</span>
      </> : <>
        <Link href={destinationFor(profile)} className="bq-app-brand">ByteQuest</Link>
        <span className="bq-app-location">{title}</span>
      </>}
      <div className="bq-app-utilities">
        {profile.role === "student" && <span className="tag bq-app-context">{profile.enrolled_language.toUpperCase()}</span>}
        <span className="tag bq-app-context">{roleLabels[profile.role]}</span>
        <ChatShell />
        <AccountMenu key={titleKey} profile={profile} />
      </div>
    </header>
    <div className="bq-app-columns">
      {!focusExit && <nav id="app-navigation" className="bq-app-nav" aria-label={roleLabels[profile.role] + " navigation"}>
        {primaryNavigation[profile.role].map(([href, label, shortLabel], index) => {
          const active = isActiveDestination(pathname, href, index);
          const suffix = profile.role === "instructor" && currentCourse ? "?course=" + encodeURIComponent(currentCourse) : "";
          return <Link key={href} href={href + suffix} aria-current={active ? "page" : undefined}>
            <AppNavIcon href={href} />
            <span className="bq-nav-label">{label}</span>
            <span className="bq-nav-short">{shortLabel}</span>
          </Link>;
        })}
      </nav>}
      <main id="main-content" className="bq-app-content" tabIndex={-1}>{children}</main>
    </div>
    <span className="bq-route-status" aria-live="polite" aria-atomic="true">{title}</span>
  </div>;
}
