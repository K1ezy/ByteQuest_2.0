import type { InstructorIconName } from "@/components/instructor/course-ui";
import type { Profile } from "@/lib/types";

export const studentExamsHref = "/quests?category=exams";

export const roleLabels = { student: "Student", instructor: "Instructor", admin: "Administrator" };

/**
 * The instructor menu, grouped as the desktop sidebar shows it. Phones show the first
 * tabs below plus a More sheet with every group, so each page has one name everywhere.
 */
export const instructorNavigation = [
  { title: "Teach", links: [
    ["Dashboard", "/instructor", "home"], ["Activities", "/instructor/activities", "code"],
    ["Workshops", "/workshops", "users"],
    ["Materials", "/instructor/materials", "file"],
    ["Announcements", "/instructor/announcements", "bell"],
  ] },
  { title: "Students", links: [
    ["Performance and Predictions", "/instructor/predictions", "chart"],
    ["Student Progress", "/instructor/performance", "users"],
    ["Gradebook", "/instructor/performance#instructor-gradebook", "table"],
  ] },
  { title: "Insights", links: [
    ["Gamification", "/instructor/gamification", "trophy"], ["Model evaluation", "/instructor/ml", "chart"],
  ] },
] as const satisfies readonly { title: string; links: readonly (readonly [string, string, InstructorIconName])[] }[];

// An in-page anchor never marks the page; the dashboard matches only itself, other sections their sub-pages too.
export const isCurrentInstructorPage = (pathname: string, href: string) =>
  !href.includes("#") && (pathname === href || (href !== "/instructor" && belongsTo(pathname, href)));

const instructorLinks: readonly (readonly [string, string, InstructorIconName])[] = instructorNavigation.flatMap(({ links }): readonly (readonly [string, string, InstructorIconName])[] => links);
const instructorLabel = (href: string) => instructorLinks.find(([, path]) => path === href)?.[0] ?? href;

/**
 * Each entry is [path, full label, short label]. The full label names the page in the
 * desktop sidebar; the short label fits the phone tab bar, where five tabs share the width.
 */
export const primaryNavigation: Record<Profile["role"], readonly (readonly [string, string, string])[]> = {
  student: [
    ["/dashboard", "Dashboard", "Home"], ["/quests", "Quest Map", "Quests"],
    ["/workshops", "Workshops", "Workshops"],
  ],
  // Four tabs leave room for More, which opens the full instructor menu.
  instructor: ["/instructor", "/instructor/activities", "/instructor/predictions", "/instructor/performance"]
    .map((href) => [href, instructorLabel(href), instructorLabel(href)] as const),
  admin: [
    ["/admin", "System Overview", "Overview"],
    ["/admin/accounts", "User & Role Management", "Users"], ["/admin/activities", "Content & Track Repository", "Content"],
  ],
};

const studentOnly = /^\/(dashboard|quests|leaderboard|exams|arena|quiz|submissions|reviews)(?:\/|$)/;
export const belongsTo = (path: string, root: string) => path === root || path.startsWith(root + "/");

export function withCourse(href: string, courseId: string | null) {
  if (!courseId) return href;
  const [path, hash] = href.split("#");
  return path + (path.includes("?") ? "&" : "?") + "course=" + encodeURIComponent(courseId) + (hash ? "#" + hash : "");
}

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
  if (profile.role === "student") roots.push("/arena", "/quiz", "/submissions", "/reviews", "/leaderboard", "/exams");
  return roots.some((path) => belongsTo(url.pathname, path)) ? url.pathname + url.search + url.hash : null;
}

export function questRedirect(params: URLSearchParams, role?: Profile["role"]): string | null {
  const view = params.get("view");
  if (role === "student" && view === "map") return "/profile?tab=mastery";
  if (role === "student" && view === "leaderboard") return "/profile?tab=rankings";
  const fixed: Record<string, string> = {
    leaderboard: "/leaderboard", journey: "/dashboard", "activity-hub": "/workshops",
    accessibility: "/account/accessibility",
  };
  const target = view === "faculty" && role
    ? ({ student: "/quests", instructor: "/instructor", admin: "/admin" })[role]
    : view && Object.hasOwn(fixed, view) ? fixed[view] : params.has("group") ? "/workshops" : null;
  if (!target) return null;
  const query = new URLSearchParams(params);
  query.delete("view");
  return query.size ? target + "?" + query : target;
}

export function pageLabel(path: string): string {
  if (belongsTo(path, "/workshops")) return "Workshops";
  if (belongsTo(path, "/reviews")) return "Recall Quest";
  for (const entries of Object.values(primaryNavigation)) {
    for (const [href, label] of entries) if (href === path) return label;
  }
  const label = path.split("/").filter(Boolean).at(-1) || "";
  if (belongsTo(path, "/instructor/review") && label !== "review") return "Review Draft";
  if (belongsTo(path, "/instructor/activities") && label === "analysis") return "Activity Analysis";
  if (belongsTo(path, "/instructor/activities") && label !== "activities") return "Activity Editor";
  if (belongsTo(path, "/arena")) return "Coding Arena";
  if (belongsTo(path, "/quiz")) return "Concept check quiz";
  if (belongsTo(path, "/exams")) return "Exam";
  const labels: Record<string, string> = { ml: "Model evaluation", review: "Review drafts", research: "Research Participation", chat: "Chat Assistant", preview: "Student Preview", studio: "Authoring Studio", onboarding: "Sign in", assignments: "Course access" };
  if (belongsTo(path, "/submissions")) return "Submission Status";
  return labels[label] ?? (label.charAt(0).toUpperCase() + label.slice(1));
}
