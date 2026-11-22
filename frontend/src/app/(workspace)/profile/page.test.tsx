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
import { ApiError } from "@/lib/api";

vi.mock("@/components/insights/plot", () => ({ default: () => null }));
const profile = {
  id: "student-id",
  pseudonym_id: "student_verify",
  username: "studentverify",
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
    help_pattern: { challenges_solved: 2, self_solved: 1, three_star: 1, hinted_challenges: 3, tried_before_hint: 1 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.searchParams = new URLSearchParams();
  mocks.getMyProfile.mockResolvedValue(profile);
  mocks.getMyAnalytics.mockResolvedValue(analytics);
  // Each endpoint returns its real shape, so panels never receive another endpoint's payload.
  mocks.apiRequest.mockImplementation(async (path: string) => path.startsWith("/quests/codex")
    ? { locked: true, day: 0, unlock: { unlocked: false, unlock_day: 21, unlocks_on: null }, categories: [] }
    : { available: false, version: null, choice: null });
  mocks.requestResetLink.mockResolvedValue(true);
  mocks.updateMyProfile.mockImplementation(async (body: { display_name?: string; bio?: string }) => ({ ...profile, ...body }));
});

afterEach(cleanup);

it("edits identity from one form, sends only changed fields and publishes the saved profile", async () => {
  mocks.getMyAnalytics.mockRejectedValueOnce(new Error("Analytics offline"));
  const updatedEvents: Event[] = [];
  const listener = (event: Event) => updatedEvents.push(event);
  window.addEventListener("bytequest:profile-updated", listener);

  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Student Verify" })).toBeTruthy();
  expect(await screen.findByText("Progress is temporarily unavailable")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Make ByteQuest feel more personal" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
  const save = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Student Updated" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Bio/ }), { target: { value: "Learning loops" } });
  expect(screen.getByText("14/500")).toBeTruthy();
  fireEvent.click(save);

  await waitFor(() => expect(mocks.updateMyProfile).toHaveBeenCalledOnce());
  expect(mocks.updateMyProfile).toHaveBeenCalledWith({ display_name: "Student Updated", bio: "Learning loops" });
  expect(mocks.updateMyTrack).not.toHaveBeenCalled();
  expect(await screen.findByRole("heading", { name: "Student Updated" })).toBeTruthy();
  expect(screen.getByText("Learning loops")).toBeTruthy();
  expect(updatedEvents).toHaveLength(1);
  expect(mocks.toast).toHaveBeenCalledWith("Profile updated", "success");
  window.removeEventListener("bytequest:profile-updated", listener);
});

it("edits the public handle, normalises it, and reports a taken handle inline", async () => {
  mocks.updateMyProfile
    .mockRejectedValueOnce(new ApiError("That username is already taken.", 409))
    .mockImplementation(async (body: { username?: string }) => ({ ...profile, ...body }));
  render(<ProfilePage />);
  expect(await screen.findByText("@studentverify")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
  const handle = screen.getByRole("textbox", { name: "Public handle" });
  fireEvent.change(handle, { target: { value: "NewHandle" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("That handle is already taken. Try another.")).toBeTruthy();
  expect(handle.getAttribute("aria-invalid")).toBe("true");
  fireEvent.change(handle, { target: { value: "OtherHandle" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.updateMyProfile).toHaveBeenLastCalledWith({ username: "otherhandle" }));
  expect(await screen.findByText("@otherhandle")).toBeTruthy();
});

it("hides a generated starter handle, never re-saves it, and blocks an invalid handle", async () => {
  const starter = "memberlnjpnbbhieleeopokcgeknjpghciiojm";
  mocks.getMyProfile.mockResolvedValue({ ...profile, username: starter, handle_chosen: false });
  render(<ProfilePage />);
  expect(await screen.findByRole("heading", { name: "Student Verify" })).toBeTruthy();
  expect(screen.queryByText(new RegExp(starter))).toBeNull();

  expect(screen.queryByRole("button", { name: /Choose a public @handle|Add a short bio/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" })));
  const handle = screen.getByRole("textbox", { name: "Public handle" }) as HTMLInputElement;
  expect(handle.value).toBe("");
  // The suggestion is an explicit action, never a placeholder that looks like a saved value.
  expect(handle.placeholder).toBe("Choose a handle");
  fireEvent.click(screen.getByRole("button", { name: "Use @studentverify" }));
  expect(handle.value).toBe("studentverify");
  expect(screen.queryByRole("button", { name: "Use @studentverify" })).toBeNull();
  fireEvent.change(handle, { target: { value: "k1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByText(/Use 3–44 letters only/)).toBeTruthy();
  expect(mocks.updateMyProfile).not.toHaveBeenCalled();

  fireEvent.change(handle, { target: { value: "" } });
  fireEvent.change(screen.getByRole("textbox", { name: /Bio/ }), { target: { value: "Hi" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.updateMyProfile).toHaveBeenCalledWith({ bio: "Hi" }));
});

it("saves the learning track from the same form and keeps it open when only the track fails", async () => {
  mocks.updateMyTrack.mockRejectedValueOnce(new Error("Track service offline"));
  render(<ProfilePage />);
  expect(await screen.findByText(/Python track · Year 2 · Semester 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Student Updated" } });
  fireEvent.change(screen.getByLabelText("Language"), { target: { value: "java" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText(/Your details were saved, but the learning track was not: Track service offline/)).toBeTruthy();
  expect(mocks.updateMyProfile).toHaveBeenCalledWith({ display_name: "Student Updated" });
  mocks.updateMyTrack.mockImplementation(async (body: { enrolled_language: string; year_level: number; semester: number }) =>
    ({ ...profile, display_name: "Student Updated", enrolled_language: body.enrolled_language }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.updateMyTrack).toHaveBeenLastCalledWith({ enrolled_language: "java", year_level: 2, semester: 1 }));
  expect(mocks.updateMyProfile).toHaveBeenCalledOnce();
  expect(await screen.findByText(/Java track · Year 2 · Semester 1/)).toBeTruthy();
});

it("opens straight into handle editing from the leaderboard deep link and then clears it", async () => {
  mocks.searchParams = new URLSearchParams("edit=handle");
  mocks.getMyProfile.mockResolvedValue({ ...profile, username: "memberlnjpnbbhieleeopokcgeknjpghciiojm", handle_chosen: false });
  render(<ProfilePage />);

  const handle = await screen.findByRole("textbox", { name: "Public handle" });
  await waitFor(() => expect(document.activeElement).toBe(handle));
  expect(mocks.router.replace).toHaveBeenCalledWith("/profile", { scroll: false });
});

it("cancels with Escape without saving and returns focus to Edit profile", async () => {
  render(<ProfilePage />);
  const edit = await screen.findByRole("button", { name: /Edit profile/ });
  fireEvent.click(edit);
  const name = screen.getByRole("textbox", { name: "Name" });
  fireEvent.change(name, { target: { value: "Discarded" } });
  fireEvent.keyDown(name, { key: "Escape" });
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Student Verify" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement?.textContent).toMatch(/Edit profile/));
  expect(mocks.updateMyProfile).not.toHaveBeenCalled();
});

it("uses the activity URL for progress details and preserves embargoed exam data", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  render(<ProfilePage />);

  expect((await screen.findByRole("link", { name: "Progress" })).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByRole("heading", { name: "How you solve challenges" })).toBeTruthy();
  expect(screen.getByText("1 of 2")).toBeTruthy();
  expect(screen.getByText("1 of 3")).toBeTruthy();
  expect(screen.getByText(/Try one before opening a hint/)).toBeTruthy();
  expect(screen.getAllByText(/Awaiting release/).length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: "Quizzes: 0%" })).toBeTruthy();
});
it("opens Progress for the old overview link and exposes role-aware navigation", async () => {
  mocks.searchParams = new URLSearchParams("tab=overview");
  render(<ProfilePage />);

  expect((await screen.findByRole("link", { name: "Progress" })).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Progress" }).getAttribute("href")).toBe("/profile?tab=activity");
  expect(screen.getByRole("link", { name: "Account" }).getAttribute("href")).toBe("/profile?tab=account");
  expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
});

it("provides private account controls and student research consent without analytics dependency", async () => {
  mocks.searchParams = new URLSearchParams("tab=account");
  mocks.getMyAnalytics.mockRejectedValueOnce(new Error("Analytics offline"));
  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Your ByteQuest account" })).toBeTruthy();
  expect(screen.getByText(/visible only to you while signed in/i)).toBeTruthy();
  expect(screen.queryByText("Progress is temporarily unavailable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Email reset link" }));
  expect(mocks.requestResetLink).toHaveBeenCalledWith("student@example.test");
  expect(await screen.findByRole("heading", { name: "Research participation" })).toBeTruthy();
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
  expect(screen.getByText("Accounts by role")).toBeTruthy();
});

it("shows faculty attention counts and the single highest-priority action", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "faculty-id", role: "instructor", display_name: "Faculty Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "instructor", instructor: instructorAnalytics });
  render(<ProfilePage />);

  expect(await screen.findByText("Courses")).toBeTruthy();
  expect(screen.queryByText("Work waiting in your courses")).toBeNull();
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
  expect(screen.queryByText("Someone else created a course")).toBeNull();
  expect(screen.queryByText("Operational work waiting")).toBeNull();
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
  expect(screen.getByText("Your reviews, uploads and publishing will appear here.")).toBeTruthy();
});

it("links recorded topics, shows badge descriptions and provides a score trend table", async () => {
  mocks.getMyAnalytics.mockResolvedValueOnce({ ...analytics, student:{...analytics.student,
    by_topic:["Strings & files","General"].map(topic => ({topic,attempts:1,average_score:40})),
    score_trend:[{title:"Intro",created_at:"2026-11-05T00:00:00Z",score_percentage:40},{title:"Practice",created_at:"2026-11-06T00:00:00Z",score_percentage:85}],
    badges:[{code:"first",name:"First steps",description:"Finish one quest.",xp_bonus:5,icon_url:"/badge.svg"}],
  }});
  render(<ProfilePage/>);
  expect((await screen.findByRole("link",{name:"Practise Strings & files"})).getAttribute("href")).toBe("/quests?concept=Strings%20%26%20files");
  expect(screen.queryByRole("link",{name:"Practise General"})).toBeNull();
  expect(screen.getByText("Finish one quest.")).toBeTruthy();
  expect(screen.getByRole("img",{name:/From 40% to 85% across 2 attempts/})).toBeTruthy();
  fireEvent.click(screen.getByText("View as table"));
  expect(screen.getByRole("table",{name:"Recent score trend"})).toBeTruthy();
});
