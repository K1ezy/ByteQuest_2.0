"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { getErrorMessage } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { getAdminCourses, getFacultyCourses, type CourseSummary, type WorkspaceRole } from "@/lib/workspace";
import { useShellProfile } from "@/components/app-shell";
import { internalPath, withCourse } from "@/lib/navigation";

interface WorkspaceContextValue {
  role: WorkspaceRole;
  profile: Profile;
  courses: CourseSummary[];
  courseId: string | null;
  activeCourse: CourseSummary | null;
  setCourse: (courseId: string) => void;
  refreshCourses: () => Promise<void>;
  setUnsaved: (unsaved: boolean, message?: string) => void;
  hasUnsaved: boolean;
  courseHref: (href: string) => string;
  modelEvaluationAvailable: boolean;
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
  const url = internalPath(value);
  if (!url) return fallback;
  const root = fallback.startsWith("/admin") ? "/admin" : "/instructor";
  const path = url.pathname.replace(/^\/faculty(?=\/|$)/, "/instructor");
  return path === root || path.startsWith(root + "/") ? path + url.search + url.hash : fallback;
}

export function WorkspaceProvider({ role, children, shell: Shell }: {
  role: WorkspaceRole; children: ReactNode; shell?: ComponentType<{ children: ReactNode }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const workshopReport = pathname === "/instructor/predictions";
  const searchParams = useSearchParams();
  const profile = useShellProfile();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [modelEvaluationAvailable, setModelEvaluationAvailable] = useState(true);
  const [defaultCourseId, setDefaultCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [unsaved, setUnsavedState] = useState(false);
  const [unsavedMessage, setUnsavedMessage] = useState("You have unsaved edits.");
  const requestedCourse = searchParams.get("course");

  const loadCourses = useCallback(async () => {
    let defaultId: string | null = null;
    if (role === "faculty") {
      const result = await getFacultyCourses();
      setCourses(result.courses);
      setModelEvaluationAvailable(result.model_evaluation_available !== false);
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
      await loadCourses();
    } catch (error) {
      const message = getErrorMessage(error);
      setFatalError(message);
    } finally {
      setLoading(false);
    }
  }, [loadCourses]);

  useEffect(() => {
    if (workshopReport) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, workshopReport]);

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
    if (workshopReport) return null;
    if (role === "admin") return requestedCourse || null;
    if (requestedCourse) return requestedCourse;
    return defaultCourseId || courses[0]?.id || null;
  }, [courses, defaultCourseId, requestedCourse, role, workshopReport]);

  const activeCourse = courses.find((course) => course.id === courseId) || null;
  const courseForbidden = Boolean(requestedCourse && courses.length > 0 && !courses.some((course) => course.id === requestedCourse));

  const courseHref = useCallback(
    (href: string) => withCourse(href, role === "faculty" ? courseId : null),
    [courseId, role],
  );

  const value: WorkspaceContextValue = {
    role, profile, courses, courseId, activeCourse, setCourse, refreshCourses: loadCourses,
    setUnsaved, hasUnsaved: unsaved, courseHref, modelEvaluationAvailable,
  };

  const independentRoute = workshopReport || pathname === "/instructor/exams" || pathname === "/instructor/preview";
  let body = children;
  if (!independentRoute) {
    if (loading) body = <div className="ws-loading-panel" role="status">Loading workspace…</div>;
    else if (fatalError) body = <section className="ws-state-card">
      <h1>Workspace temporarily unavailable</h1><p role="alert">{fatalError}</p>
      <button type="button" className="button button-primary" onClick={() => void load()}>Retry</button>
    </section>;
    else if (role === "faculty" && courses.length === 0) body = <section className="ws-state-card">
      <h1>My Courses</h1><p>No courses are assigned to this Instructor account. Ask your ByteQuest administrator for a course assignment.</p>
      <div className="ws-inline-actions">
        <button type="button" className="button button-primary" onClick={() => void load()}>Refresh assignments</button>
        <Link className="button button-outline" href="/instructor/preview">Open Student Preview</Link>
      </div>
    </section>;
    else if (courseForbidden) body = <section className="ws-state-card">
      <h1>Course unavailable</h1><p>Choose a course assigned to your account.</p>
      <Link className="button button-primary" href={role === "admin" ? "/admin" : "/instructor"}>Back to overview</Link>
    </section>;
  }

  if (Shell) return <WorkspaceContext.Provider value={value}><Shell>{body}</Shell></WorkspaceContext.Provider>;

  return <WorkspaceContext.Provider value={value}>
    <div className="workspace-shell">
      {role === "faculty" && courses.length > 0 && !independentRoute && <div className="bq-course-switch">
        <label htmlFor="workspace-course">Course</label>
        <select id="workspace-course" value={activeCourse?.id ?? ""} onChange={(event) => setCourse(event.target.value)}>
          {!activeCourse && <option value="" disabled>Choose a course</option>}
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>}
      {body}
    </div>
  </WorkspaceContext.Provider>;
}
