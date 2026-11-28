export const metrics = {
  "enrolled": {
    "label": "Enrolled",
    "definition": "Learners with an active enrollment in this course"
  },
  "submissions_7d": {
    "label": "Submissions, 7 days",
    "definition": "Practice attempts on published activities in the last 7 days, counting every retry"
  },
  "student_activities_passed": {
    "label": "Activities passed",
    "definition": "Activities you have passed at least once, out of all the activities your Workshops shared with you"
  },
  "first_try_passes": {
    "label": "Passed on the first try",
    "definition": "Activities whose first attempt reached that activity's pass mark"
  },
  "activities_passed": {
    "label": "Activities passed",
    "definition": "Average share of published activities each learner has passed"
  },
  "latest_activity_average": {
    "label": "Latest activity average",
    "definition": "Average of each learner's latest score on the most recently published activity"
  },
  "not_started": {
    "label": "Not started",
    "definition": "Enrolled learners with no attempt on a published activity"
  },
  "active_7d": {
    "label": "Active (7 days)",
    "definition": "Learners with a practice attempt in the last 7 days"
  },
  "inactive_7d": {
    "label": "Inactive 7+ days",
    "definition": "Learners who started but have no practice attempt in the last 7 days"
  },
  "pass_rate": {
    "label": "Pass rate",
    "definition": "Learners who passed the activity, of learners who attempted it"
  },
  "first_try_pass_rate": {
    "label": "First-try pass rate",
    "definition": "Learners whose first attempt passed, of learners who attempted"
  },
  "median_attempts_to_pass": {
    "label": "Median attempts to pass",
    "definition": "Median attempt number of each passer's first pass"
  },
  "stuck": {
    "label": "Stuck",
    "definition": "Learners who reached the attempt threshold without a pass."
  },
  "attempts_passed": {
    "label": "Attempts passed",
    "definition": "Share of a student's own attempts that passed"
  },
  "average_attempt_score": {
    "label": "Average attempt score",
    "definition": "Average score across a student's own attempts"
  },
  "self_solved": {
    "label": "Self-solved",
    "definition": "Challenges passed without opening a hint"
  },
  "tried_before_asking": {
    "label": "Tried before asking",
    "definition": "Hinted challenges with a run or attempt before the first hint"
  },
  "recall_pass_rate": {
    "label": "Recall pass rate",
    "definition": "Recalls where at least two-thirds of questions were recalled"
  },
  "consent_coverage": {
    "label": "Research consent",
    "definition": "Enrolled learners with current research consent, and how many haven't answered the current form yet"
  }
} as const;

export type MetricKey = keyof typeof metrics;
