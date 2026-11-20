import type { Profile } from "@/lib/types";

export const roleLabels = { student: "Student", instructor: "Instructor", admin: "Administrator" };

/**
 * Each entry is [path, full label, short label]. The full label names the page in the
 * desktop sidebar; the short label fits the phone tab bar, where five tabs share the width.
 */
export const primaryNavigation = {
  student: [
    ["/dashboard", "Dashboard", "Home"], ["/quests", "Quest Map", "Quests"], ["/exams", "Exams", "Exams"],
    ["/workshops", "Workshops", "Workshops"], ["/leaderboard", "Leaderboard", "Ranks"],
  ],
  instructor: [
    ["/instructor", "My Courses", "Courses"], ["/instructor/activities", "Quest & Workshop Builder", "Builder"],
    ["/instructor/performance", "Student Progress & Submissions", "Progress"], ["/instructor/gamification", "Gamification Insights", "Insights"],
    ["/instructor/exams", "Exams", "Exams"],
  ],
  admin: [
    ["/admin", "System Overview", "Overview"], ["/admin/courses", "Course & Instructor Management", "Courses"],
    ["/admin/accounts", "User & Role Management", "Users"], ["/admin/activities", "Content & Track Repository", "Content"],
    ["/admin/teaching", "Instructor Workspace", "Teaching"],
  ],
} as const;

const studentOnly = /^\/(dashboard|quests|leaderboard|exams|arena|quiz|submissions|reviews)(?:\/|$)/;
export const belongsTo = (path: string, root: string) => path === root || path.startsWith(root + "/");

export function usesInstructorCourseShell(path: string) {
  // Student Preview renders the learner's own chrome, so it keeps the plain shell.
  return belongsTo(path, "/instructor") && !belongsTo(path, "/instructor/preview");
}

export function canOpenPath(role: Profile["role"], path: string): boolean {
  if (belongsTo(path, "/admin")) return role === "admin";
  if (belongsTo(path, "/instructor")) return role === "instructor";
  if (studentOnly.test(path)) return role === "student";
  return true;
}

export function internalPath(value: string | null): URL | null {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const url = new URL(value, "https://bytequest.invalid");
    if (url.origin === "https://bytequest.invalid" && !/%(?:2f|5c)/i.test(url.pathname)) return url;
  } catch { /* Invalid URL. */ }
  return null;
}

export function authReturnTo(profile: Profile, value: string | null): string | null {
  const url = internalPath(value);
  if (!url) return null;
  if (url.pathname === "/faculty/accessibility" || url.pathname === "/admin/accessibility") {
    url.pathname = "/account/accessibility";
  } else if (belongsTo(url.pathname, "/faculty")) {
    url.pathname = "/instructor" + url.pathname.slice("/faculty".length);
  }
  if (!canOpenPath(profile.role, url.pathname)) return null;
  const roots = [...primaryNavigation[profile.role].map(([path]) => path), "/profile", "/account", "/chat", "/workshops"];
  if (profile.role === "student") roots.push("/arena", "/quiz", "/submissions", "/reviews");
  return roots.some((path) => belongsTo(url.pathname, path)) ? url.pathname + url.search + url.hash : null;
}

export function questRedirect(params: URLSearchParams, role?: Profile["role"]): string | null {
  const view = params.get("view");
  const fixed: Record<string, string> = {
    leaderboard: "/leaderboard", journey: "/dashboard", "activity-hub": "/workshops",
    accessibility: "/account/accessibility",
  };
  const target = view === "faculty" && role
    ? ({ student: "/quests", instructor: "/instructor", admin: "/admin/teaching" })[role]
    : view && Object.hasOwn(fixed, view) ? fixed[view] : params.has("group") ? "/workshops" : null;
  if (!target) return null;
  const query = new URLSearchParams(params);
  query.delete("view");
  return query.size ? target + "?" + query : target;
}

export function pageLabel(path: string): string {
  if (belongsTo(path, "/reviews")) return "Recall Quest";
  for (const entries of Object.values(primaryNavigation)) {
    for (const [href, label] of entries) if (href === path) return label;
  }
  const label = path.split("/").filter(Boolean).at(-1) || "";
  if (belongsTo(path, "/instructor/review") && label !== "review") return "Review Draft";
  if (belongsTo(path, "/instructor/activities") && label === "analysis") return "Activity Analysis";
  if (belongsTo(path, "/instructor/activities") && label !== "activities") return "Activity Editor";
  if (belongsTo(path, "/arena")) return "Coding Arena";
  if (belongsTo(path, "/quiz")) return "Concept Check";
  if (belongsTo(path, "/exams")) return "Exam";
  const labels: Record<string, string> = { ml: "Machine Learning", review: "Review Queue", research: "Research Participation", chat: "Chat Assistant", preview: "Student Preview", studio: "Authoring Studio", onboarding: "Learning Track", assignments: "Course Assignments" };
  if (belongsTo(path, "/submissions")) return "Submission Status";
  return labels[label] ?? (label.charAt(0).toUpperCase() + label.slice(1));
}
