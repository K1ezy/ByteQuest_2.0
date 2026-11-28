export const PERIODS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export function isPeriod(value: string | null): value is Period {
  return PERIODS.some((period) => period.value === value);
}

export type CourseRef = { id: string; code: string; title: string; status: string } | null;

export type Forecast = {
  id: string;
  target_activity_id: string;
  target_activity: string;
  target_topic: string;
  probability: number;
  label: string;
  predicted_pass: boolean;
  model_version: string;
  selected_model: "logreg" | "random_forest";
  /** Both models' chance of passing; `probability` is the selected one. */
  probabilities?: { logreg: number; random_forest: number };
  as_of: string;
  actual_outcome: boolean | null;
  advisory: string;
  is_current?: boolean;
  from_active_model?: boolean;
};

export type LegacyForecast = {
  id: string;
  status: "legacy";
  target_activity: string;
  probability: null;
  model_version: string;
  as_of: string;
  actual_outcome: boolean | null;
  label: string;
  is_current: boolean;
  from_active_model: boolean;
};

export type SavedForecast = Forecast | LegacyForecast;

export function isLegacy(forecast: SavedForecast): forecast is LegacyForecast {
  return "status" in forecast && forecast.status === "legacy";
}

export type StudentRow = {
  student_id: string;
  display_name: string | null;
  username: string;
  average_score: number | null;
  latest_score: number | null;
  quiz_count: number;
  challenge_count: number;
  exam_count: number;
  result_count: number;
  forecast_status: string;
  forecast: Forecast | null;
  target_activity: string | null;
  target_activity_id: string | null;
  target_topic: string | null;
};

export type TrendPoint = {
  date: string;
  quiz: number | null;
  challenge: number | null;
  exam: number | null;
  quiz_count: number;
  challenge_count: number;
  exam_count: number;
};

export type HistoryEvent = {
  kind: string;
  title: string;
  score_percentage: number;
  at: string;
};

export type Thresholds = {
  support_below: number;
  likely_at_or_above: number;
  decision: number;
};

export type Dashboard = {
  course: CourseRef;
  period: Period;
  aggregation_timezone: string;
  readiness: { status: string; forecasts_available: boolean; active_model_version: string | null };
  summary: {
    active_learners: number;
    graded_events: number;
    average_score: number | null;
    forecast_count: number;
    forecast_denominator: number;
    need_support: number | null;
  };
  trend: TrendPoint[];
  /** Class trend bucket: Monday-starting weeks (default) or days, first tries only. */
  trend_scale?: "weekly" | "daily";
  thresholds: Thresholds;
  students: StudentRow[];
};

export type Detail = {
  course: CourseRef;
  student: StudentRow;
  history: HistoryEvent[];
  trend: TrendPoint[];
  predictions: SavedForecast[];
  evidence: {
    topic: string | null;
    prior_tasks_attempted: number;
    prior_tasks_required: number;
    result_count: number;
    period: Period;
  };
};

export type Curve = {
  false_positive_rate?: number[];
  true_positive_rate?: number[];
  precision?: number[];
  recall?: number[];
};

export type PartitionScore = {
  partition: string;
  n_samples: number;
  n_students: number;
  positive_rate: number;
  decision_threshold: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc: number | null;
  average_precision: number | null;
  brier_score: number;
  confusion_matrix: number[][];
  roc_curve: Curve | null;
  pr_curve: Curve | null;
};

export type PartitionReport = Partial<Record<"validation" | "test", PartitionScore>>;

export type OfflineReport = {
  model_version: string;
  dataset_source: string;
  research_approved: boolean;
  generated_at: string;
  n_samples: number;
  n_students: number;
  outcome_counts: { successful?: number; unsuccessful?: number };
  protocol: Record<string, string | number>;
  partitions: Record<string, { n_samples: number; n_students: number; positive_rate: number }>;
  selection: {
    winner: string;
    tie_rule_applied: boolean;
    validation_average_precision: Record<string, number | null>;
  };
  models: Record<string, PartitionReport>;
  baselines: Record<string, PartitionReport>;
  /** Learner-level bootstrap 95% intervals on the test partition, per model or baseline. */
  confidence_intervals?: Record<string, {
    level: number; n_resamples: number; skipped_single_class: number;
    metrics: Record<string, { low: number | null; high: number | null }>;
  }>;
  /** The predeclared minimum-data rule (ML plan D7). */
  adequacy?: {
    min_test_learners?: number; min_rows_per_class?: number; test_learners?: number;
    test_rows_per_class?: { successful?: number; unsuccessful?: number }; met?: boolean;
  };
  /** Test rows that meet the live minimum-history rule. Never used to choose the model. */
  supplementary?: {
    live_eligible?: { min_prior_tasks: number | null; models: Record<string, PartitionScore>; baselines: Record<string, PartitionScore> };
  };
};

export type Evaluation = {
  readiness?: Dashboard["readiness"];
  course: CourseRef;
  observed: {
    unit: string;
    versions: string[];
    selected_version: string | null;
    active_version: string | null;
    total_predictions: number;
    awaiting_outcome: number;
    labeled_predictions: number;
    models: Record<string, { labeled: number; correct: number; accuracy_percent: number | null }>;
  };
  offline: { status: "available" | "unavailable"; report: OfflineReport | null };
  thresholds: Thresholds;
};

export const MODEL_NAMES: Record<string, string> = {
  logreg: "Logistic regression",
  random_forest: "Random forest",
  most_frequent: "Majority class baseline",
  majority_class: "Majority class baseline",
  prior: "Prevalence baseline",
  prevalence: "Prevalence baseline",
  stratified: "Prevalence baseline",
};

export function modelName(key: string): string {
  return MODEL_NAMES[key] || key;
}

export const FORECAST_REASONS: Record<string, string> = {
  no_graded_history: "No graded results yet",
  no_next_activity: "No eligible next activity",
  missing_consent: "Research consent unavailable",
  insufficient_history: "More course history needed",
  model_unavailable: "Approved model unavailable",
  no_saved_prediction: "Awaiting a saved prediction",
  first_submission_made: "Forecasts cover first submissions only",
};

export const READINESS_MESSAGES: Record<string, string> = {
  disabled: "Forecast scoring is turned off. Historical results remain available.",
  approval_required:
    "Forecast scoring awaits research approval. Historical results remain available.",
  artifacts_unavailable:
    "No approved, active model is available yet. Historical results remain available.",
  artifacts_invalid:
    "The active model could not be validated. Historical results remain available.",
  unavailable:
    "Forecast scoring is temporarily unavailable. Historical results remain available.",
};

/** Deterministic teaching guidance, tied to the advisory band only. */
export const TEACHING_ACTIONS: Record<string, string> = {
  "May need support":
    "Review the relevant concept with this learner and offer guided practice before the next activity.",
  "Continue practicing":
    "Encourage further practice and inspect the recent attempts for repeated mistakes.",
  "Likely to pass": "Review readiness for the existing next activity.",
};
