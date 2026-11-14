"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest, ApiError, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { subscribeToProfileUpdates } from "@/lib/profile-events";
import { belongsTo, canOpenPath, pageLabel, primaryNavigation, questRedirect, roleLabels } from "@/lib/navigation";
import type { Profile } from "@/lib/types";
import { useSignOut } from "@/hooks/use-sign-out";
import { destinationFor } from "@/components/home-redirect";
import { ChatShell } from "@/components/chat/chat-shell";
import { LegacyQuestRedirect } from "@/components/legacy-quest-redirect";

const ProfileContext = createContext<Profile | null>(null);

export function useShellProfile() {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("The workspace requires a signed-in profile.");
  return profile;
}

export function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<{ profile?: Profile; message?: string; forbidden?: boolean } | null>(null);
  const refreshVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const { data, error } = await getSupabase().auth.getSession();
      if (error) throw error;
      const profile = data.session ? await apiRequest<Profile>("/profile/me") : undefined;
      if (version === refreshVersion.current) setState({ profile });
    } catch (error) {
      if (version === refreshVersion.current) setState(error instanceof ApiError && error.status === 401
        ? {} : { message: getErrorMessage(error), forbidden: error instanceof ApiError && error.status === 403 });
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
  if (!state) return <main id="main-content" className="page-shell" role="status">Loading workspace…</main>;
  if (!state.profile) return <main id="main-content" className="page-shell">
    <section className="panel">
      <h1>{state.forbidden ? "Account access unavailable" : state.message ? "Workspace temporarily unavailable" : "Sign in to continue"}</h1>
      {state.message && <p role="alert">{state.message}</p>}
      {state.message
        ? <button className="button button-primary" type="button" onClick={() => void refresh()}>Retry</button>
        : <Link className="button button-primary" href={"/onboarding?mode=signin&redirect=" + encodeURIComponent(requestedPath)}>Sign in</Link>}
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

export function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const title = pageLabel(pathname);
  const titleKey = pathname + "?" + params.toString();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navTrigger = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const { signOut, isSigningOut, error } = useSignOut();
  const navOpen = openMenu === titleKey;
  const focusExit = profile.role === "student" && /^\/(arena|quiz|exams)\/[^/]+$/.exec(pathname);
  const currentCourse = params.get("course");
  useEffect(() => {
    document.title = title + " · ByteQuest";
  }, [title]);

  return <div className={focusExit ? "bq-app-shell bq-focus-shell" : "bq-app-shell"}
    onKeyDown={(event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (account.current?.open) {
        account.current.open = false;
        account.current.querySelector("summary")?.focus();
      } else if (navOpen) {
        setOpenMenu(null);
        navTrigger.current?.focus();
      }
    }}>
    <header className="bq-app-topbar">
      {focusExit ? <>
        <Link className="button button-outline" href={focusExit[1] === "exams" ? "/exams" : "/quests"}
          aria-label={focusExit[1] === "exams" ? "Back to Exams" : "Back to Quest Map"}>
          <span className="bq-back-prefix">Back to </span>{focusExit[1] === "exams" ? "Exams" : "Quest Map"}
        </Link>
        <span className="bq-app-location">{title}</span>
      </> : <>
        <button className="button button-outline bq-nav-toggle" type="button" ref={navTrigger} aria-expanded={navOpen} aria-controls="app-navigation"
          onClick={() => setOpenMenu(navOpen ? null : titleKey)}>Menu</button>
        <Link href={destinationFor(profile)} className="bq-app-brand">ByteQuest</Link>
        <span className="bq-app-location">{title}</span>
      </>}
      <div className="bq-app-utilities">
        {profile.role === "student" && <span className="tag">{profile.enrolled_language.toUpperCase()}</span>}
        <span className="tag">{roleLabels[profile.role]}</span>
        <ChatShell />
        <details className="bq-account" ref={account} key={titleKey}>
          <summary>Account</summary>
          <div className="bq-account-actions">
            <Link href="/profile" onClick={() => { if (account.current) account.current.open = false; }}>Profile</Link>
            <Link href="/account/accessibility" onClick={() => { if (account.current) account.current.open = false; }}>Accessibility</Link>
            <button type="button" disabled={isSigningOut} onClick={() => void signOut()}>{isSigningOut ? "Signing out…" : "Sign out"}</button>
            {error && <p role="alert">{error}</p>}
          </div>
        </details>
      </div>
    </header>
    <div className="bq-app-columns">
      {!focusExit && <nav id="app-navigation" className={"bq-app-nav" + (navOpen ? " is-open" : "")} aria-label={roleLabels[profile.role] + " navigation"}>
        {primaryNavigation[profile.role].map(([href, label], index) => {
          const active = (index === 0 ? pathname === href : belongsTo(pathname, href))
            || (href === "/instructor/activities" && ["/instructor/materials", "/instructor/review", "/instructor/preview", "/workshops"].some((section) => belongsTo(pathname, section)))
            || (href === "/instructor/performance" && belongsTo(pathname, "/instructor/ml"))
            || (href === "/admin" && ["/admin/configuration", "/admin/monitoring"].some((section) => belongsTo(pathname, section)))
            || (href === "/admin/courses" && belongsTo(pathname, "/admin/assignments"))
            || (href === "/admin/activities" && belongsTo(pathname, "/admin/materials"))
            || (href === "/admin/teaching" && pathname === "/workshops");
          const suffix = profile.role === "instructor" && currentCourse ? "?course=" + encodeURIComponent(currentCourse) : "";
          return <Link key={href} href={href + suffix} aria-current={active ? "page" : undefined} onClick={() => setOpenMenu(null)}>{label}</Link>;
        })}
      </nav>}
      <main id="main-content" className="bq-app-content" tabIndex={-1}>{children}</main>
    </div>
    <span className="bq-route-status" aria-live="polite" aria-atomic="true">{title}</span>
  </div>;
}
