import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  getMyProfile: vi.fn(),
  getMyAnalytics: vi.fn(),
  updateMyProfile: vi.fn(),
  updateMyTrack: vi.fn(),
  uploadMyAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "test" } } })) } }),
}));
vi.mock("@/components/toast", () => ({ useToast: () => ({ show: mocks.toast }) }));
vi.mock("@/lib/image", () => ({ cropCompressImage: vi.fn() }));
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
  mocks.getMyProfile.mockResolvedValue(profile);
  mocks.getMyAnalytics.mockResolvedValue(analytics);
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

it("treats the photo as optional and labels track, progress, and embargoed exam data", async () => {
  render(<ProfilePage />);

  expect(await screen.findByText("Photo optional")).toBeTruthy();
  const setup = screen.getByRole("progressbar", { name: "Profile setup completion" });
  expect(setup.getAttribute("aria-valuenow")).toBe("50");
  fireEvent.click(screen.getByRole("button", { name: "Edit track" }));
  expect(screen.getByLabelText("Learning language")).toBeTruthy();
  expect(screen.getByLabelText("Year level")).toBeTruthy();
  expect(screen.getByLabelText("Semester")).toBeTruthy();
  expect(screen.getAllByText(/Awaiting release/).length).toBeGreaterThan(0);
  const zeroBar = screen.getByRole("progressbar", { name: "Quizzes" });
  expect(zeroBar.getAttribute("aria-valuenow")).toBe("0");
  expect((zeroBar.firstElementChild as HTMLElement).style.width).toBe("0%");
});
