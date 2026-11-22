import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  apiRequest: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams("tab=evaluation"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/faculty/ml",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ courseId: "coursealpha" }),
  WorkspaceSuspense: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/workspace/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/workspace/ui")>();
  return { ...original, useApi: mocks.useApi };
});
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

vi.mock("@/components/insights/plot", () => ({default: () => null}));
import Page from "./page";

function score(partition: string, accuracy: number) {
  return {
    partition,
    n_samples: 80,
    n_students: 4,
    positive_rate: 0.6,
    decision_threshold: 0.5,
    accuracy,
    precision: 0.7,
    recall: 0.65,
    f1_score: 0.67,
    roc_auc: 0.72,
    average_precision: 0.71,
    brier_score: 0.19,
    confusion_matrix: [
      [20, 12],
      [8, 40],
    ],
    roc_curve: { false_positive_rate: [0, 0.25, 1], true_positive_rate: [0, 0.6, 1] },
    pr_curve: { precision: [1, 0.7, 0.6], recall: [0, 0.6, 1] },
  };
}

const report = {
  model_version: "v2.0.0",
  dataset_source: "approved_deidentified_csv",
  research_approved: true,
  generated_at: "2026-11-10T10:00:00Z",
  n_samples: 400,
  n_students: 20,
  outcome_counts: { successful: 240, unsuccessful: 160 },
  protocol: {
    split: "student-disjoint 60/20/20 train/validation/test, partitioned by student_id",
    preprocessing: "median imputation and scaling fitted on the training partition only",
    hyperparameter_tuning: "GridSearchCV over GroupKFold folds inside the training partition only",
    primary_selection_metric: "average_precision",
    selection_tie_rule: "a gap of at most 0.005 resolves to logistic regression as the simpler model",
    decision_threshold: 0.5,
    test_partition_scored: "once, after both pipelines were frozen and the winner was fixed",
    artifacts_fitted_on: "training partition only",
  },
  partitions: {
    train: { n_samples: 240, n_students: 12, positive_rate: 0.6 },
    validation: { n_samples: 80, n_students: 4, positive_rate: 0.6 },
    test: { n_samples: 80, n_students: 4, positive_rate: 0.6 },
  },
  selection: {
    winner: "logreg",
    tie_rule_applied: false,
    validation_average_precision: { logreg: 0.71, random_forest: 0.66 },
  },
  models: {
    logreg: { validation: score("validation", 0.7), test: score("test", 0.68) },
    random_forest: { validation: score("validation", 0.65), test: score("test", 0.63) },
  },
  baselines: { most_frequent: { test: score("test", 0.6) } },
};

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    course: { id: "coursealpha", code: "CS1", title: "Python", status: "active" },
    observed: {
      unit: "prediction snapshots",
      versions: ["v2.0.0", "v1.0.0"],
      selected_version: "v2.0.0",
      active_version: "v2.0.0",
      total_predictions: 10,
      awaiting_outcome: 4,
      labeled_predictions: 6,
      models: {
        logreg: { labeled: 6, correct: 5, accuracy_percent: 83.3 },
        random_forest: { labeled: 6, correct: 4, accuracy_percent: 66.7 },
      },
    },
    offline: { status: "available", report },
    thresholds: { decision: 0.5, support_below: 0.4, likely_at_or_above: 0.6 },
    ...overrides,
  };
}

/** First metric cell of the logistic regression row in the comparison table. */
function logregAccuracy(partition: string) {
  const table = screen.getByRole("table", { name: `Model metrics on the ${partition} partition` });
  const row = within(table).getByRole("row", { name: /Logistic regression/ });
  return within(row).getAllByRole("cell")[0].textContent;
}

function useApiReturning(evaluationData: unknown) {
  mocks.useApi.mockImplementation((path: string | null) => ({
    loading: false,
    error: "",
    reload: vi.fn(),
    data: path?.includes("/evaluation") ? evaluationData : null,
  }));
}

beforeEach(() => {
  mocks.params = new URLSearchParams("tab=evaluation");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("reports observed outcomes per model without pooling versions", () => {
  useApiReturning(evaluation());
  render(<Page />);
  expect(screen.getByText(/counting unit is prediction snapshots/)).toBeTruthy();
  expect(screen.getByText(/Versions are never\s+pooled/)).toBeTruthy();
  expect(screen.getByText("83.3%")).toBeTruthy();
  expect(screen.getByText("Random forest: 66.7%")).toBeTruthy();
  expect(screen.getByText("4")).toBeTruthy();
  expect((screen.getByLabelText("Model version") as HTMLSelectElement).value).toBe("v2.0.0");
  expect(screen.getByRole("option", { name: "v2.0.0 (active)" })).toBeTruthy();
});

it("requests a different model version when one is selected", () => {
  useApiReturning(evaluation());
  render(<Page />);
  fireEvent.change(screen.getByLabelText("Model version"), { target: { value: "v1.0.0" } });
  expect(mocks.useApi).toHaveBeenCalledWith(
    "/faculty/ml/evaluation?course_id=coursealpha&model_version=v1.0.0",
  );
});

it("claims no accuracy when nothing has an observed outcome yet", () => {
  useApiReturning(
    evaluation({
      observed: {
        ...evaluation().observed,
        total_predictions: 3,
        awaiting_outcome: 3,
        labeled_predictions: 0,
        models: {
          logreg: { labeled: 0, correct: 0, accuracy_percent: null },
          random_forest: { labeled: 0, correct: 0, accuracy_percent: null },
        },
      },
    }),
  );
  render(<Page />);
  expect(screen.getByText(/no accuracy can be reported/)).toBeTruthy();
  expect(screen.getByText("Random forest: —")).toBeTruthy();
});

it("shows the offline comparison on the test partition by default", () => {
  useApiReturning(evaluation());
  render(<Page />);
  expect(screen.getByText(/Charts and tables show the test partition/)).toBeTruthy();
  expect(screen.getByText(/winner was selected using validation data/)).toBeTruthy();
  expect(screen.getByText(/approved_deidentified_csv · research approved/)).toBeTruthy();
  expect(screen.getByText(/240 passed · 160 did not pass/)).toBeTruthy();
  expect(
    screen.getByText(/train: 240 rows \/ 12 learners · validation: 80 rows \/ 4 learners · test: 80 rows \/ 4 learners/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Logistic regression[\s\S]*selected on validation Average Precision/),
  ).toBeTruthy();
  expect(logregAccuracy("test")).toBe("0.680");
  expect(screen.getByText("Majority class baseline")).toBeTruthy();
});

it("switches the offline comparison to the validation partition", () => {
  useApiReturning(evaluation());
  render(<Page />);
  expect(logregAccuracy("test")).toBe("0.680");
  fireEvent.change(screen.getByLabelText("Partition"), { target: { value: "validation" } });
  expect(screen.getByText(/Charts and tables show the validation partition/)).toBeTruthy();
  expect(logregAccuracy("validation")).toBe("0.700");
});

it("renders confusion matrices and both curves", () => {
  useApiReturning(evaluation());
  render(<Page />);
  expect(screen.getAllByText("Actually passed").length).toBe(2);
  expect(screen.getAllByText("40").length).toBeGreaterThan(0);
  expect(screen.getByRole("img", {name:/^ROC curve on the test partition/})).toBeTruthy();
  expect(screen.getByRole("img", {name:/^Precision-recall curve on the test partition/})).toBeTruthy();
});

it("explains the metrics and says a lower Brier score is better", () => {
  useApiReturning(evaluation());
  render(<Page />);
  expect(screen.getByText(/Average squared error of the probability itself. Lower is better./)).toBeTruthy();
  expect(screen.getByText(/Area under the precision-recall curve/)).toBeTruthy();
  expect(screen.getByText(/may span several courses/)).toBeTruthy();
  expect(screen.getByText(/never change grades, rewards, access, assignments or student sequencing/)).toBeTruthy();
});

it("states an honest empty report state and still shows the methodology", () => {
  useApiReturning(
    evaluation({
      observed: {
        ...evaluation().observed,
        versions: [],
        selected_version: null,
        active_version: null,
        total_predictions: 0,
        awaiting_outcome: 0,
        labeled_predictions: 0,
      },
      offline: { status: "unavailable", report: null },
    }),
  );
  render(<Page />);
  expect(screen.getByText("No approved model report available")).toBeTruthy();
  expect(screen.getByText("No saved predictions in this course")).toBeTruthy();
  expect(screen.getByText(/Student-disjoint 60\/20\/20/)).toBeTruthy();
  expect(screen.queryByLabelText("Partition")).toBeNull();
});

it("states the purpose, advisory use and pending status before any approved report exists", () => {
  useApiReturning(evaluation({ offline: { status: "unavailable", report: null } }));
  render(<Page />);
  expect(screen.getByRole("heading", { name: "What this page shows" })).toBeTruthy();
  expect(screen.getByText(/no approved model yet/)).toBeTruthy();
  expect(screen.getByText(/students never see them/)).toBeTruthy();
});

const phaseB = {
  ...report,
  confidence_intervals: {
    logreg: { level: 0.95, n_resamples: 1000, skipped_single_class: 3, metrics: { accuracy: { low: 0.61, high: 0.74 } } },
  },
  adequacy: { min_test_learners: 6, min_rows_per_class: 15, test_learners: 4, test_rows_per_class: { successful: 48, unsuccessful: 32 }, met: false },
  supplementary: { live_eligible: { min_prior_tasks: 3, models: { logreg: score("test_live_eligible", 0.66) }, baselines: {} } },
};

it("shows test intervals, an indicative-only verdict with real counts and the supplementary report", () => {
  useApiReturning(evaluation({ offline: { status: "available", report: phaseB } }));
  render(<Page />);
  expect(logregAccuracy("test")).toContain("95%: 0.610–0.740");
  expect(screen.getByText(/1000 learner-level bootstrap resamples/).textContent).toContain("3 were skipped because they held only one outcome");
  expect(screen.getByText(/The test partition has 4 learners, with 48 passed and 32 not passed rows; at least 6 learners and 15 rows of each outcome are needed/)).toBeTruthy();
  expect(screen.getByText("Supplementary: never used to choose the model.")).toBeTruthy();
  const live = screen.getByRole("table", { name: "Test metrics for learners eligible for a live forecast" });
  expect(within(live).getByRole("row", { name: /Logistic regression/ })).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Partition"), { target: { value: "validation" } });
  expect(logregAccuracy("validation")).not.toContain("95%");
  expect(screen.queryByRole("table", { name: "Test metrics for learners eligible for a live forecast" })).toBeNull();
});

it("says plainly when the adequacy check is met", () => {
  useApiReturning(evaluation({ offline: { status: "available", report: { ...phaseB, adequacy: { ...phaseB.adequacy, test_learners: 10, met: true } } } }));
  render(<Page />);
  expect(screen.getByText(/Adequacy check met: the test partition has 10 learners/)).toBeTruthy();
  expect(screen.queryByText(/Indicative only/)).toBeNull();
});
