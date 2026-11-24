import { withCourse } from "@/lib/navigation";

export function activityListHref(courseId: string | null, highlight?: string, published = false) {
  const params = new URLSearchParams();
  if (highlight) params.set("highlight", highlight);
  if (published) params.set("published", "1");
  return withCourse(`/instructor/activities${params.size ? `?${params}` : ""}`, courseId);
}

export function activityEditorHref(activityId: string, courseId: string | null) {
  return withCourse(`/instructor/activities/${encodeURIComponent(activityId)}`, courseId);
}

export const publicationChecks: Record<string, { label: string; action: string; section: string }> = {
  invalid_quiz: { label: "Quiz questions and answers", action: "Complete 3–10 questions", section: "activity-content" },
  missing_tests: { label: "Grading cases", action: "Add grading cases", section: "activity-content" },
  missing_sample: { label: "Visible sample", action: "Make a grading case visible", section: "activity-grading-cases" },
  not_verified: { label: "Reference solution verified", action: "Verify the reference solution", section: "activity-verification" },
  invalid_schedule: { label: "Valid schedule", action: "Fix the schedule", section: "activity-schedule" },
};

export function instructorActivityState(activity: {
  state: string; publication_issues?: string[]; draft_state?: string;
}) {
  return activity.state === "draft" && activity.publication_issues?.length === 0 && activity.draft_state !== "rejected"
    ? "ready" : activity.state;
}
