import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  searchParams: new URLSearchParams(),
  getMyProfile: vi.fn(),
  getMyAnalytics: vi.fn(),
  updateMyProfile: vi.fn(),
  updateMyAcademicDetails: vi.fn(),
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
    updateMyAcademicDetails: mocks.updateMyAcademicDetails,
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
  workshop_languages: ["python" as const],
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
    quests_completed: 5,
    quests_total: 9,
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
    recent_attempts: [],
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
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path.startsWith("/quests/progress-recap")) return {
      days: 7, period_start: "2026-11-18", period_end: "2026-11-24",
      previous_start: "2026-11-11", previous_end: "2026-11-17",
      comparison: "new_learner", enough_activity: false, metrics: [],
    };
    return { available: false, version: null, choice: null };
  });
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
  expect(mocks.updateMyAcademicDetails).not.toHaveBeenCalled();
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

it("saves year and semester from the same form and keeps it open when only they fail", async () => {
  mocks.updateMyAcademicDetails.mockRejectedValueOnce(new Error("Profile service offline"));
  render(<ProfilePage />);
  expect(await screen.findByText(/Python · Year 2 · Semester 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
  expect(screen.queryByLabelText("Language")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Student Updated" } });
  fireEvent.change(screen.getByLabelText("Year level"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText(/Your details were saved, but your year and semester were not: Profile service offline/)).toBeTruthy();
  expect(mocks.updateMyProfile).toHaveBeenCalledWith({ display_name: "Student Updated" });
  mocks.updateMyAcademicDetails.mockImplementation(async (body: { year_level: number; semester: number }) =>
    ({ ...profile, display_name: "Student Updated", year_level: body.year_level }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.updateMyAcademicDetails).toHaveBeenLastCalledWith({ year_level: 3, semester: 1 }));
  expect(mocks.updateMyProfile).toHaveBeenCalledOnce();
  expect(await screen.findByText(/Python · Year 3 · Semester 1/)).toBeTruthy();
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

it("uses the activity URL for progress details and hides retired exams", async () => {
  mocks.searchParams = new URLSearchParams("tab=activity");
  render(<ProfilePage />);

  expect((await screen.findByRole("link", { name: "Progress" })).getAttribute("aria-current")).toBe("page");
  expect((await screen.findByRole("progressbar", { name: "5 of 9 activities passed" })).getAttribute("value")).toBe("56");
  expect(screen.getByText(/You passed 5 of 9 activities.* 4 more are open\./)).toBeTruthy();
  expect(screen.queryByText("Attempts passed")).toBeNull();
  expect(screen.getByRole("progressbar", { name: "XP toward level 3" }).getAttribute("value")).toBe("125");
  expect(screen.getByRole("heading", { name: "Recent attempts" })).toBeTruthy();
  expect(await screen.findByRole("heading", { name: "How you solve challenges" })).toBeTruthy();
  expect(screen.getByText("1 of 2")).toBeTruthy();
  expect(screen.getByText("1 of 3")).toBeTruthy();
  expect(screen.getByText(/Try one before opening a hint/)).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Exam history" })).toBeNull();
  expect(screen.getByRole("img", { name: "Quizzes: 0%" })).toBeTruthy();
});

it("opens Mastery inside Profile with links to filtered quests", async () => {
  mocks.searchParams = new URLSearchParams("tab=mastery");
  mocks.apiRequest.mockImplementation(async (path: string) => {
    if (path === "/quests/mastery-map") return { languages: ["python"], concepts: [{
      language: "python", concept: "Loops & arrays", total: 3, completed: 2, mastery_percent: 67, state: "in_progress",
      average_stars: 2.5, weak_spot: "logic_error",
    }] };
    if (path === "/reviews") return { locked: false, concepts: [], due_count: 0 };
    return { locked: true, day: 0, unlock: { unlocked: false, unlock_day: 21, unlocks_on: null }, categories: [] };
  });
  render(<ProfilePage />);

  const node = await screen.findByRole("link", { name: /Loops & arrays in Python, 2 of 3 complete, 67% of its activities passed/ });
  expect(node.getAttribute("href")).toBe("/quests?concept=Loops%20%26%20arrays&language=python");
  expect(screen.getByRole("link", { name: "Mastery" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "Debugger's Codex" })).toBeTruthy();
  expect(mocks.getMyAnalytics).not.toHaveBeenCalled();
});

it("opens the academic details from a bookmarked edit link", async () => {
  mocks.searchParams = new URLSearchParams("edit=track");
  render(<ProfilePage />);
  const yearLevel = await screen.findByRole("combobox", { name: "Year level" });
  await waitFor(() => expect(document.activeElement).toBe(yearLevel));
  expect(mocks.router.replace).toHaveBeenCalledWith("/profile", { scroll: false });
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
  render(<ProfilePage />);

  expect(await screen.findByRole("heading", { name: "Your ByteQuest account" })).toBeTruthy();
  expect(screen.getByText(/visible only to you while signed in/i)).toBeTruthy();
  expect(screen.queryByText("Progress is temporarily unavailable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Email reset link" }));
  expect(mocks.requestResetLink).toHaveBeenCalledWith("student@example.test");
  expect(await screen.findByRole("heading", { name: "Research participation" })).toBeTruthy();
  expect(mocks.getMyAnalytics).not.toHaveBeenCalled();
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
  expect(await screen.findByRole("heading", { name: "Teaching activity" })).toBeTruthy();
  expect(screen.queryByText(/streak/i)).toBeNull();
  unmount();

  mocks.getMyProfile.mockResolvedValueOnce({ ...profile, id: "admin-id", role: "admin", display_name: "Admin Verify" });
  mocks.getMyAnalytics.mockResolvedValueOnce({ role: "admin", admin: adminAnalytics });
  render(<ProfilePage />);
  expect((await screen.findByRole("link", { name: "Stewardship" })).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByText("Accounts by role")).toBeTruthy();
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
    total_attempts: 6,
    recent_attempts: Array.from({ length: 6 }, (_, index) => ({
      attempt_id: `attempt-${index}`, activity_id: `quiz-${index}`, title: `Practice quiz ${index}`,
      activity_type: "quiz", score_percentage: 85, is_successful: true, created_at: "2026-11-24T04:00:00Z",
      can_open_quest: index !== 5, is_exam: index === 5,
    })),
    by_topic:[...["Strings & files","General"].map(topic => ({language:"java",topic,attempts:1,average_score:40})),{language:"python",topic:"Loops",attempts:2,average_score:90}],
    score_trend:[],
    first_tries:[{activity_id:"a",title:"Intro",language:"python",created_at:"2026-11-05T00:00:00Z",score_percentage:40,passed:false},
      {activity_id:"b",title:"Practice",language:"java",created_at:"2026-11-06T00:00:00Z",score_percentage:100,passed:true}],
    badges:[{code:"first",name:"First steps",description:"Finish one quest.",xp_bonus:5,icon_url:"/badge.svg"}],
  }});
  render(<ProfilePage/>);
  expect((await screen.findByRole("link",{name:"Practise Strings & files"})).getAttribute("href")).toBe("/quests?concept=Strings%20%26%20files&language=java");
  expect(screen.getByText("Strings & files · Java")).toBeTruthy();
  expect(screen.getByRole("list", { name: "What the shades mean" }).textContent).toContain("4 or more");
  fireEvent.click(within(screen.getByRole("group", { name: "Topic language" })).getByRole("button", { name: "Python" }));
  expect(screen.queryByText("Strings & files · Java")).toBeNull();
  expect(screen.getByText("Loops · Python")).toBeTruthy();
  fireEvent.click(within(screen.getByRole("group", { name: "Topic language" })).getByRole("button", { name: "All languages" }));
  expect(screen.queryByRole("link",{name:"Practise General"})).toBeNull();
  expect(screen.getByText("Finish one quest.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Practice quiz 0" }).getAttribute("href")).toBe("/quiz/quiz-0");
  expect(screen.queryByText("Practice quiz 5")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show 6 recent attempts" }));
  expect(screen.getByText("Practice quiz 5")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Practice quiz 5" })).toBeNull();
  // The chart's title is its takeaway; each first try reads passed or not passed yet without the picture.
  expect(screen.getByRole("heading",{name:"1 of your last 2 first tries passed. Not enough data yet — based on 2."})).toBeTruthy();
  expect(screen.getByText("● passed · ○ not passed yet")).toBeTruthy();
  expect(screen.getAllByRole("cell").map(cell => cell.textContent)).toEqual(expect.arrayContaining(["not passed yet", "passed"]));
  fireEvent.click(screen.getByText("View as table"));
  expect(screen.getByRole("table",{name:"First-try score per activity"})).toBeTruthy();
});
