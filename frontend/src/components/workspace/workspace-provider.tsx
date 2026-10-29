"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useSignOut } from "@/hooks/use-sign-out";
import type { Profile } from "@/lib/types";
import { getAdminCourses, getFacultyCourses, type CourseSummary, type WorkspaceRole } from "@/lib/workspace";
import { Button } from "@/components/workspace/ui";
import { QuestNavIcon, type QuestNavIconName } from "@/components/workspace/quest-nav-icon";

interface NavItem {
  label: string;
  href: string;
  icon: QuestNavIconName;
}

export const FACULTY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/faculty", icon: "home" },
  { label: "Review queue", href: "/faculty/review", icon: "reviewQueue" },
  { label: "Materials", href: "/faculty/materials", icon: "materials" },
  { label: "Activities", href: "/faculty/activities", icon: "grid" },
  { label: "Performance", href: "/faculty/performance", icon: "performance" },
  { label: "Accessibility", href: "/faculty/accessibility", icon: "accessibility" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "home" },
  { label: "Accounts", href: "/admin/accounts", icon: "person" },
  { label: "Assignments", href: "/admin/assignments", icon: "assignments" },
  { label: "Courses", href: "/admin/courses", icon: "courses" },
  { label: "Materials", href: "/admin/materials", icon: "materials" },
  { label: "Activities", href: "/admin/activities", icon: "grid" },
  { label: "Configuration", href: "/admin/configuration", icon: "configuration" },
  { label: "Monitoring", href: "/admin/monitoring", icon: "monitoring" },
  { label: "Accessibility", href: "/admin/accessibility", icon: "accessibility" },
];

interface WorkspaceContextValue {
  role: WorkspaceRole;
  profile: Profile;
  courses: CourseSummary[];
  courseId: string | null;
  activeCourse: CourseSummary | null;
  setCourse: (courseId: string) => void;
  refreshCourses: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUnsaved: (unsaved: boolean, message?: string) => void;
  hasUnsaved: boolean;
  courseHref: (href: string) => string;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside a workspace shell.");
  return context;
}

export function WorkspaceSuspense({ children, label = "workspace" }: { children: ReactNode; label?: string }) {
  return (
    <Suspense
      fallback={
        <div className="workspace-shell" role="status" aria-label={`Loading ${label}`}>
          <div className="ws-loading-panel">
            <span className="ws-spinner" aria-hidden="true" />
            Loading {label}…
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Preserve a validated in-app return path for filtered lists. */
export function safeReturnTo(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/faculty") && !value.startsWith("/admin")) return fallback;
  return value;
}

function roleLabel(role: WorkspaceRole): string {
  return role === "faculty" ? "Faculty" : "Administrator";
}

function breadcrumbFor(pathname: string, role: WorkspaceRole): string[] {
  const labels: Record<string, string> = {
    "": "Dashboard",
    review: "Review queue",
    materials: "Materials",
    activities: "Activities",
    performance: "Performance",
    accessibility: "Accessibility",
    accounts: "Accounts",
    assignments: "Assignments",
    courses: "Courses",
    configuration: "Configuration",
    monitoring: "Monitoring",
  };
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumbs = [role === "faculty" ? "Faculty" : "Administration"];
  segments.forEach((segment, index) => {
    if (index === 1 && !labels[segment]) {
      crumbs.push(role === "faculty" && segments[0] === "review" ? "Draft workspace" : "Editor");
      return;
    }
    crumbs.push(labels[segment] || segment);
  });
  if (segments.length === 0) crumbs.push("Dashboard");
  return crumbs;
}

export function WorkspaceProvider({ role, children }: { role: WorkspaceRole; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSigningOut, error: signOutError, signOut } = useSignOut();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [defaultCourseId, setDefaultCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unsaved, setUnsavedState] = useState(false);
  const [unsavedMessage, setUnsavedMessage] = useState("You have unsaved edits.");
  const accountRef = useRef<HTMLDivElement>(null);
  const requestedCourse = searchParams.get("course");

  const loadCourses = useCallback(async () => {
    let defaultId: string | null = null;
    if (role === "faculty") {
      const result = await getFacultyCourses();
      setCourses(result.courses);
      defaultId = result.default_course_id;
    } else {
      const result = await getAdminCourses();
      setCourses(result.courses);
      defaultId = result.courses[0]?.id ?? null;
    }
    setDefaultCourseId(defaultId);
  }, [role]);

  const load = useCallback(async () => {
    setLoading(true);
    setFatalError("");
    try {
      const current = await apiRequest<Profile>("/profile/me");
      const expected = role === "faculty" ? "instructor" : "admin";
      if (current.role !== expected) {
        setProfile(current);
        setCourses([]);
        setLoading(false);
        return;
      }
      setProfile(current);
      await loadCourses();
    } catch (error) {
      const message = getErrorMessage(error);
      setFatalError(message);
    } finally {
      setLoading(false);
    }
  }, [loadCourses, role]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 850px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // Initial load synchronizes the shell with the authenticated profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!accountOpen) return;
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [accountOpen]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!unsaved) return;
      event.preventDefault();
      event.returnValue = unsavedMessage;
      return unsavedMessage;
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, unsavedMessage]);

  const setUnsaved = useCallback((value: boolean, message?: string) => {
    setUnsavedState(value);
    if (message) setUnsavedMessage(message);
  }, []);

  const setCourse = useCallback(
    (courseId: string) => {
      if (unsaved && !window.confirm(`${unsavedMessage} Switch course anyway?`)) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("course", courseId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, unsaved, unsavedMessage],
  );

  const courseId = useMemo(() => {
    if (role === "admin") return requestedCourse || null;
    if (requestedCourse) return requestedCourse;
    return defaultCourseId || courses[0]?.id || null;
  }, [courses, defaultCourseId, requestedCourse, role]);

  const activeCourse = courses.find((course) => course.id === courseId) || null;
  const courseForbidden = Boolean(requestedCourse && courses.length > 0 && !courses.some((course) => course.id === requestedCourse));

  const courseHref = useCallback(
    (href: string) => {
      if (role !== "faculty" || !courseId) return href;
      const [path, hash] = href.split("#");
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}course=${courseId}${hash ? `#${hash}` : ""}`;
    },
    [courseId, role],
  );

  const value: WorkspaceContextValue | null = profile
    ? {
        role,
        profile,
        courses,
        courseId,
        activeCourse,
        setCourse,
        refreshCourses: loadCourses,
        refreshProfile: async () => {
          const current = await apiRequest<Profile>("/profile/me");
          setProfile(current);
        },
        setUnsaved,
        hasUnsaved: unsaved,
        courseHref,
      }
    : null;

  const expectedRole = role === "faculty" ? "instructor" : "admin";

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="ws-loading-panel" role="status">
        <span className="ws-spinner" aria-hidden="true" />
        Loading your {role === "faculty" ? "faculty" : "administration"} workspace…
      </div>
    );
  } else if (!profile) {
    body = (
      <section className="ws-state-card" aria-labelledby="workspace-signin-title">
        <p className="eyebrow-label">{roleLabel(role).toUpperCase()} WORKSPACE</p>
        <h1 id="workspace-signin-title">Sign in to continue</h1>
        <p>{fatalError || "Your session has ended. Sign in again to open this workspace."}</p>
        <div className="ws-inline-actions">
          <Link className="button button-primary" href="/onboarding">
            Sign in
          </Link>
          <Link className="button button-outline" href="/quests">
            Go to Quest Map
          </Link>
        </div>
      </section>
    );
  } else if (profile.role !== expectedRole) {
    body = (
      <section className="ws-state-card" aria-labelledby="workspace-role-title">
        <p className="eyebrow-label">SIGNED IN AS {profile.role.toUpperCase()}</p>
        <h1 id="workspace-role-title">
          {role === "faculty" ? "Faculty access is not enabled for this account" : "Administrator access is required"}
        </h1>
        <p>
          {role === "faculty"
            ? "The faculty workspace is available to assigned instructor accounts. Your account can keep using the student Quest Map, or an administrator can assign you a course."
            : "Administration is limited to administrator accounts. Academic review stays with assigned faculty."}
        </p>
        <div className="ws-inline-actions">
          <Link className="button button-primary" href="/quests">
            Go to Quest Map
          </Link>
          {profile.role === "admin" && role === "faculty" ? (
            <Link className="button button-outline" href="/admin">
              Open administration
            </Link>
          ) : null}
          {profile.role === "instructor" && role === "admin" ? (
            <Link className="button button-outline" href="/faculty">
              Open faculty workspace
            </Link>
          ) : null}
        </div>
      </section>
    );
  } else if (fatalError) {
    body = (
      <section className="ws-state-card" role="alert" aria-labelledby="workspace-error-title">
        <p className="eyebrow-label">SERVICE UNAVAILABLE</p>
        <h1 id="workspace-error-title">The workspace could not load</h1>
        <p>{fatalError} Your saved data is unchanged.</p>
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </section>
    );
  } else if (role === "faculty" && courses.length === 0) {
    body = (
      <section className="ws-state-card" aria-labelledby="workspace-course-title">
        <p className="eyebrow-label">NO COURSE ASSIGNMENT</p>
        <h1 id="workspace-course-title">No course is assigned to you yet</h1>
        <p>
          Faculty data is scoped to assigned courses. Ask an administrator to assign you to a course; your account keeps
          student access in the meantime.
        </p>
        <div className="ws-inline-actions">
          <Link className="button button-outline" href="/quests">
            Go to Quest Map
          </Link>
        </div>
      </section>
    );
  } else if (courseForbidden) {
    body = (
      <section className="ws-state-card" role="alert" aria-labelledby="workspace-lost-title">
        <p className="eyebrow-label">COURSE ACCESS</p>
        <h1 id="workspace-lost-title">You no longer have access to that course</h1>
        <p>
          Your course assignment may have changed. Choose one of your assigned courses to continue; no other course data
          is shown.
        </p>
        <label className="field ws-course-recover">
          <span>Assigned course</span>
          <select value={courseId || ""} onChange={(event) => setCourse(event.target.value)}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
      </section>
    );
  } else {
    const nav = role === "faculty" ? FACULTY_NAV : ADMIN_NAV;
    const crumbs = breadcrumbFor(pathname, role);
    const reviewCount = role === "faculty" ? courses.reduce((total, course) => total + (course.draft_count || 0), 0) : 0;
    body = (
      <div className="quest-map-page workspace-shell">
        <header className="qm-topbar ws-topbar">
          <button
            className="qm-icon-button"
            type="button"
            aria-label="Toggle workspace menu"
            aria-expanded={isMobile ? mobileMenuOpen : !sidebarHidden}
            aria-controls="workspace-navigation"
            onClick={() => {
              if (window.matchMedia("(max-width: 850px)").matches) setMobileMenuOpen((open) => !open);
              else setSidebarHidden((hidden) => !hidden);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href={role === "faculty" ? courseHref("/faculty") : "/admin"} className="qm-brand" aria-label="ByteQuest workspace home">
            <Image src="/branding/ByteQuest_websitelogo.svg" alt="" width={34} height={34} />
            <span>Quest Map</span>
          </Link>
          <span className="ws-role-pill">{roleLabel(role)}</span>
          <div className="qm-top-actions ws-top-actions">
            {role === "faculty" && activeCourse ? (
              <label className="ws-course-select">
                <span className="sr-only">Selected course</span>
                <select value={activeCourse.id} onChange={(event) => setCourse(event.target.value)}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="ws-account" ref={accountRef}>
              <button
                type="button"
                className="qm-avatar ws-avatar-button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={`Account menu for ${profile.display_name || profile.pseudonym_id}`}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {(profile.display_name || profile.pseudonym_id || "B").slice(0, 1).toUpperCase()}
              </button>
              {accountOpen ? (
                <div className="ws-account-menu" role="menu">
                  <div className="ws-account-identity">
                    <strong>{profile.display_name || profile.pseudonym_id}</strong>
                    <span>
                      {roleLabel(role)}
                      {activeCourse ? ` · ${activeCourse.title}` : ""}
                    </span>
                  </div>
                  <Link role="menuitem" href={role === "faculty" ? "/faculty/accessibility" : "/admin/accessibility"}>
                    Accessibility settings
                  </Link>
                  <Link role="menuitem" href="/quests">
                    Student Quest Map
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={isSigningOut}
                    onClick={() => void signOut()}
                  >
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError ? (
                    <p className="ws-account-error" role="alert">
                      {signOutError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className={`qm-layout${sidebarHidden ? " is-sidebar-collapsed" : ""}`}>
          <aside id="workspace-navigation" className={`qm-sidebar ws-sidebar${mobileMenuOpen ? " is-open" : ""}`} aria-label={`${roleLabel(role)} navigation`}>
            <nav>
              {nav.map((item) => {
                const active = item.href === `/${role}` ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={courseHref(item.href)}
                    className={active ? "is-active" : ""}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <QuestNavIcon name={item.icon} />
                    {item.label}
                    {item.href === "/faculty/review" && reviewCount > 0 ? (
                      <span className="ws-nav-count" aria-label={`${reviewCount} drafts awaiting review`}>
                        {reviewCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <div className="qm-content ws-content">
            <nav className="ws-breadcrumb" aria-label="Breadcrumb">
              {crumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`}>
                  {index > 0 ? <span aria-hidden="true"> / </span> : null}
                  {crumb}
                </span>
              ))}
            </nav>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return value ? (
    <WorkspaceContext.Provider value={value}>{body}</WorkspaceContext.Provider>
  ) : (
    <div className="workspace-shell workspace-standalone">{body}</div>
  );
}
