import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  searchParams: new URLSearchParams(),
  getMyProfile: vi.fn(),
  getMyAnalytics: vi.fn(),
  updateMyProfile: vi.fn(),
  updateMyTrack: vi.fn(),
  uploadMyAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  requestResetLink: vi.fn(),
  signOut: vi.fn(),
  apiRequest: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "test" } } })) } }),
}));
vi.mock("@/components/toast", () => ({ useToast: () => ({ show: mocks.toast }) }));
vi.mock("@/lib/image", () => ({ cropCompressImage: vi.fn() }));
vi.mock("@/hooks/use-password-reset", () => ({
  usePasswordReset: () => ({
    isLoading: false,
    error: null,
    statusMessage: null,
    requestResetLink: mocks.requestResetLink,
  }),
}));
vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({ isSigningOut: false, error: "", signOut: mocks.signOut }),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});
vi.mock("@/lib/workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/workspace")>();
  return {
    ...original,
    getMyProfile: mocks.getMyProfile,
    getMyAnalytics: mocks.getMyAnalytics,
    updateMyProfile: mocks.updateMyProfile,
    updateMyTrack: mocks.updateMyTrack,
    uploadMyAvatar: mocks.uploadMyAvatar,
    deleteMyAvatar: mocks.deleteMyAvatar,
  };
});

import ProfilePage from "./page";

const profile = {
  id: "student-id",
  pseudonym_id: "student_verify",
  role: "student" as const,
  enrolled_language: "python" as const,
  year_level: 2,
  semester: 1,
  xp_points: 125,
  current_level: 2,
  display_name: "Student Verify",
  bio: null,
  avatar_url: null,
  email: "student@example.test",
  created_at: "2026-10-20T08:00:00Z",
};

const analytics = {
  role: "student" as const,
  student: {
    total_attempts: 0,
    successful_attempts: 0,
    pass_rate: 0,
    average_score: 0,
    best_score: 0,
    total_time_seconds: 0,
    xp_points: 125,
    current_level: 2,
    xp_per_level: 250,
    xp_into_level: 125,
    xp_to_next_level: 125,
    level_progress_percent: 50,
    active_days_30: 0,
    current_streak: 0,
    longest_streak: 0,
    activity_days: [],
    next_action: {
      recommended_action: "start_track",
      rationale: "Start with the first published activity.",
      activity_id: "activity-id",
      title: "Variables basics",
      kind: "quiz",
    },
    badge_count: 0,
    by_type: [{ activity_type: "quiz", attempts: 0, average_score: 0, pass_rate: 0 }],
    by_topic: [],
    score_trend: [],
    exam_history: [{
      exam_id: "exam-id",
      title: "Midterm",
      status: "submitted",
      score: null,
      max_score: null,
      submitted_at: "2026-10-30T08:00:00Z",
      results_released: false,
    }],
    badges: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.searchParams = new URLSearchParams();
  mocks.getMyProfile.mockResolvedValue(profile);
  mocks.getMyAnalytics.mockResolvedValue(analytics);
  mocks.apiRequest.mockResolvedValue({ available: false, version: null, choice: null });
  mocks.requestResetLink.mockResolvedValue(true);
  mocks.updateMyProfile.mockImplementation(async (body: { display_name?: string; bio?: string }) => ({ ...profile, ...body }));
});

afterEach(cleanup);

it("keeps identity editing available when analytics fail and publishes the saved profile", async () => {
  mocks.getMyAnalytics.mockRejectedValueOnce(new Error("Analytics offline"));
  const updatedEvents: Event[] = [];
  const listener = (event: Event) => updatedEvents.push(event);
  window.addEventListener("bytequest:profile-updated", listener);

  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Student Verify" })).toBeTruthy();
  expect(await screen.findByText("Progress is temporarily unavailable")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Student Verify/ }));
  const input = screen.getByRole("textbox", { name: "Display name" });
  fireEvent.change(input, { target: { value: "Student Updated" } });
  fireEvent.keyDown(input, { key: "Enter" });

  await waitFor(() => expect(mocks.updateMyProfile).toHaveBeenCalledOnce());
  expect(mocks.updateMyProfile).toHaveBeenCalledWith({ display_name: "Student Updated" });
  expect(updatedEvents).toHaveLength(1);
  expect(mocks.toast).toHaveBeenCalledWith("Name updated", "success");
  window.removeEventListener("bytequest:profile-updated", listener);
});

it("uses optional profile tips without a completion score", async () => {
  render(<ProfilePage />);

  expect(await screen.findByText("Photo optional")).toBeTruthy();
  expect(screen.queryByRole("progressbar", { name: "Profile setup completion" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Make ByteQuest feel more personal" })).toBeTruthy();
  expect(screen.getByText(/never affect access, grades, or permissions/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByRole("heading", { name: "Make ByteQuest feel more personal" })).toBeNull();
  expect(window.localStorage.getItem("bytequest:profile-setup-dismissed:student-id")).toBe("true");
});

it("uses the activity URL for progress details and preserves embargoed exam data", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  render(<ProfilePage />);

  expect((await screen.findByRole("link", { name: "Progress" })).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Edit track" }));
  expect(screen.getByLabelText("Learning language")).toBeTruthy();
  expect(screen.getByLabelText("Year level")).toBeTruthy();
  expect(screen.getByLabelText("Semester")).toBeTruthy();
  expect(screen.getAllByText(/Awaiting release/).length).toBeGreaterThan(0);
  const zeroBar = screen.getByRole("progressbar", { name: "Quizzes" });
  expect(zeroBar.getAttribute("aria-valuenow")).toBe("0");
  expect((zeroBar.firstElementChild as HTMLElement).style.width).toBe("0%");
});

it("falls back to Overview for an unknown tab and exposes role-aware navigation", async () => {
  mocks.searchParams = new URLSearchParams("tab=unknown");
  render(<ProfilePage />);

  expect((await screen.findByRole("link", { name: "Overview" })).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Progress" }).getAttribute("href")).toBe("/profile?tab=activity");
  expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/profile?tab=account");
  expect(screen.getByRole("heading", { name: "Your progress at a glance" })).toBeTruthy();
});

it("provides private account controls and student research consent without analytics dependency", async () => {
  mocks.searchParams = new URLSearchParams("tab=account");
  mocks.getMyAnalytics.mockRejectedValueOnce(new Error("Analytics offline"));
  window.localStorage.setItem("bytequest:profile-setup-dismissed:student-id", "true");
  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Your ByteQuest account" })).toBeTruthy();
  expect(screen.getByText(/visible only to you while signed in/i)).toBeTruthy();
  expect(screen.queryByText("Progress is temporarily unavailable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Email reset link" }));
  expect(mocks.requestResetLink).toHaveBeenCalledWith("student@example.test");
  expect(await screen.findByRole("heading", { name: "Research participation" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show tips again" }));
  expect(window.localStorage.getItem("bytequest:profile-setup-dismissed:student-id")).toBeNull();
});

const instructorAnalytics = {
  courses: 1,
  learners_taught: 11,
  activities_created: 2,
  activities_published: 1,
  drafts_reviewed: 3,
  materials_uploaded: 4,
  attention: { drafts_awaiting_review: 2, materials_needing_attention: 1, upcoming_activities: 0 },
  next_action: {
    kind: "material",
    title: "Week 6 scanned handout",
    detail: "This PDF has no usable searchable text.",
    status: "Needs review",
    href: "/faculty/materials?course=c1&material=m1",
  },
  recent_activity: [
    { action: "activity.published", entity_type: "activity", summary: "Published Loops quiz", created_at: "2026-10-30T09:00:00Z" },
  ],
};

const adminAnalytics = {
  total_accounts: 8,
  accounts_by_role: { student: 5, instructor: 2, admin: 1 },
  total_courses: 2,
  total_activities: 4,
  total_materials: 3,
  recent_audit: [
    { action: "course.created", entity_type: "course", summary: "Someone else created a course", created_at: "2026-10-30T08:00:00Z" },
  ],
  attention: { accounts_needing_action: 3, failed_jobs: 1, availability_changes: 0 },
  next_action: {
    kind: "job",
    title: "A PDF processing job failed",
    detail: "Text extraction crashed.",
    status: "Failed",
    href: "/admin/monitoring?status=failed",
  },
  recent_activity: [
    { action: "account.created", entity_type: "account", summary: "I created an account", created_at: "2026-10-30T10:00:00Z" },
  ],
};

it("labels faculty and admin activity views without gamifying them", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "faculty-id", role: "instructor", display_name: "Faculty Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "instructor", instructor: instructorAnalytics });
  const { unmount } = render(<ProfilePage />);
  expect((await screen.findByRole("link", { name: "Teaching" })).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "Teaching activity" })).toBeTruthy();
  expect(screen.queryByText(/streak/i)).toBeNull();
  unmount();

  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "admin-id", role: "admin", display_name: "Admin Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "admin", admin: adminAnalytics });
  render(<ProfilePage />);
  expect((await screen.findByRole("link", { name: "Stewardship" })).getAttribute("aria-current")).toBe("page");
  expect(screen.getByText(/platform-wide audit view/i)).toBeTruthy();
});

it("shows faculty attention counts and the single highest-priority action", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "faculty-id", role: "instructor", display_name: "Faculty Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "instructor", instructor: instructorAnalytics });
  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Work waiting in your courses" })).toBeTruthy();
  const draftsCard = screen.getByText("Drafts awaiting review").closest("a");
  expect(draftsCard?.getAttribute("href")).toBe("/faculty/review?status=open");
  // The personal timeline is labelled as a record, never a productivity target.
  expect(screen.getByText("Published Loops quiz")).toBeTruthy();
  expect(screen.getByText(/record, not a target/i)).toBeTruthy();
});

it("separates the admin personal timeline from the platform-wide audit", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "admin-id", role: "admin", display_name: "Admin Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "admin", admin: adminAnalytics });
  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Your recent administration" })).toBeTruthy();
  expect(screen.getByText("I created an account")).toBeTruthy();
  expect(screen.getByText("Someone else created a course")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Operational work waiting" })).toBeTruthy();
});

it("renders role sections when the payload omits the newer fields", async () => {
  // A deployed frontend can briefly meet an older backend; it must not crash.
  mocks.searchParams = new URLSearchParams("tab=activity");
  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "faculty-id", role: "instructor", display_name: "Faculty Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({
    role: "instructor",
    instructor: { courses: 1, learners_taught: 11, activities_created: 2, activities_published: 1, drafts_reviewed: 3, materials_uploaded: 4 },
  });
  render(<ProfilePage />);
  expect(await screen.findByRole("heading", { name: "Teaching activity" })).toBeTruthy();
  expect(screen.getByText("Nothing is waiting on you right now.")).toBeTruthy();
});
