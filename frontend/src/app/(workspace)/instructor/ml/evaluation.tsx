"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EmptyState,
  LoadingPanel,
  Notice,
  SelectField,
  StatCard,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import { formatDateTime } from "@/lib/workspace";
import { Evaluation, OfflineReport, PartitionScore, modelName } from "./types";

type Partition = "test" | "validation";

const METRIC_COLUMNS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1_score", label: "F1" },
  { key: "roc_auc", label: "ROC-AUC" },
  { key: "average_precision", label: "Average Precision" },
  { key: "brier_score", label: "Brier score" },
] as const;

const METRIC_DEFINITIONS: { term: string; meaning: string }[] = [
  { term: "Accuracy", meaning: "Share of predictions that matched the observed outcome. Higher is better." },
  { term: "Precision", meaning: "Of the activities predicted as a pass, the share that actually passed. Higher is better." },
  { term: "Recall", meaning: "Of the activities that actually passed, the share the model predicted. Higher is better." },
  { term: "F1", meaning: "One number balancing precision and recall. Higher is better." },
  { term: "ROC-AUC", meaning: "Chance the model scores a real pass above a real failure. 0.5 is guessing. Higher is better." },
  { term: "Average Precision", meaning: "Area under the precision-recall curve; stays informative when passes and failures are imbalanced. Higher is better." },
  { term: "Brier score", meaning: "Average squared error of the probability itself. Lower is better." },
];

const CURVE_COLORS: Record<string, string> = { logreg: "#2563eb", random_forest: "#16a34a" };
const CURVE_DASH: Record<string, string> = { logreg: "", random_forest: "7 4" };

function metric(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(3);
}

function CurveChart({
  label,
  xLabel,
  yLabel,
  diagonal,
  series,
}: {
  label: string;
  xLabel: string;
  yLabel: string;
  diagonal?: boolean;
  series: { key: string; x: number[]; y: number[] }[];
}) {
  const width = 320;
  const height = 240;
  const left = 44;
  const right = 12;
  const top = 12;
  const bottom = 38;
  const px = (value: number) => left + value * (width - left - right);
  const py = (value: number) => top + (1 - value) * (height - top - bottom);
  const drawable = series.filter((item) => item.x.length && item.x.length === item.y.length);
  if (!drawable.length) return <p className="ws-muted">Curve data is unavailable for this partition.</p>;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ width: "100%", height: "auto" }}>
      {[0, 0.5, 1].map((tick) => (
        <g key={tick}>
          <line x1={left} x2={width - right} y1={py(tick)} y2={py(tick)} stroke="#e2e8f0" />
          <text x={left - 6} y={py(tick) + 4} fontSize="10" fill="#64748b" textAnchor="end">
            {tick}
          </text>
          <text x={px(tick)} y={height - 20} fontSize="10" fill="#64748b" textAnchor="middle">
            {tick}
          </text>
        </g>
      ))}
      {diagonal ? (
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="#cbd5e1" strokeDasharray="3 3" />
      ) : null}
      {drawable.map((item) => (
        <polyline
          key={item.key}
          points={item.x.map((value, index) => `${px(value)},${py(item.y[index])}`).join(" ")}
          fill="none"
          stroke={CURVE_COLORS[item.key] || "#7c3aed"}
          strokeDasharray={CURVE_DASH[item.key] || ""}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ))}
      <text x={(left + width - right) / 2} y={height - 4} fontSize="10" fill="#475569" textAnchor="middle">
        {xLabel}
      </text>
      <text
        x={12}
        y={(top + height - bottom) / 2}
        fontSize="10"
        fill="#475569"
        textAnchor="middle"
        transform={`rotate(-90 12 ${(top + height - bottom) / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
}

function ConfusionMatrix({ name, score }: { name: string; score: PartitionScore }) {
  const [row0, row1] = score.confusion_matrix || [[0, 0], [0, 0]];
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="sr-only">
          Confusion matrix for {name} at a decision threshold of {score.decision_threshold}
        </caption>
        <thead>
          <tr>
            <th scope="col">{name}</th>
            <th scope="col">Predicted not pass</th>
            <th scope="col">Predicted pass</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Actually not passed</th>
            <td data-label="Predicted not pass">{row0?.[0] ?? 0}</td>
            <td data-label="Predicted pass">{row0?.[1] ?? 0}</td>
          </tr>
          <tr>
            <th scope="row">Actually passed</th>
            <td data-label="Predicted not pass">{row1?.[0] ?? 0}</td>
            <td data-label="Predicted pass">{row1?.[1] ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { key: string; score: PartitionScore | undefined }[];
}) {
  const present = rows.filter((row) => row.score);
  if (!present.length) return <p className="ws-muted">No results for this partition.</p>;
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            {METRIC_COLUMNS.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {present.map((row) => (
            <tr key={row.key}>
              <th scope="row">{modelName(row.key)}</th>
              {METRIC_COLUMNS.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {metric(row.score?.[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Methodology({ report }: { report: OfflineReport | null }) {
  const protocol = report?.protocol || {};
  const entries: { label: string; value: string }[] = [
    { label: "Split", value: String(protocol.split || "Student-disjoint 60/20/20 train, validation and test partitions, split by learner.") },
    { label: "Preprocessing", value: String(protocol.preprocessing || "Median imputation and scaling fitted on the training partition only.") },
    { label: "Hyperparameter tuning", value: String(protocol.hyperparameter_tuning || "Grouped search inside the training partition only.") },
    { label: "Selection", value: `The winner was chosen on validation ${String(protocol.primary_selection_metric || "average_precision").replace("_", " ")}. ${String(protocol.selection_tie_rule || "")}` },
    { label: "Test evaluation", value: String(protocol.test_partition_scored || "Scored once, after both pipelines were frozen and the winner was fixed.") },
    { label: "Saved artifacts", value: String(protocol.artifacts_fitted_on || "Training partition only, so reported test metrics describe the saved pipelines.") },
    { label: "Decision threshold", value: `${protocol.decision_threshold ?? 0.5} — the same boundary the live predictor classifies at.` },
  ];
  return (
    <>
      <h3>Methodology</h3>
      <dl className="ws-summary-list">
        {entries.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
      <h3>Limitations</h3>
      <ul className="ws-compact-list">
        <li>
          <strong>This describes the training dataset, not this course</strong>
          <span>
            The offline comparison may span several courses. It is not a measurement of the selected
            course&rsquo;s observed performance.
          </span>
        </li>
        <li>
          <strong>Advisory only</strong>
          <span>Forecasts never change grades, rewards, access, assignments or student sequencing.</span>
        </li>
        <li>
          <strong>Partition sizes are small at classroom scale</strong>
          <span>Metrics from few learners carry wide uncertainty and should be read as indicative.</span>
        </li>
      </ul>
    </>
  );
}

function OfflineComparison({ report }: { report: OfflineReport | null }) {
  const [partition, setPartition] = useState<Partition>("test");
  if (!report) {
    return (
      <>
        <EmptyState title="No approved model report available">
          No validated, approved model is active, so there is no offline comparison to show. The
          protocol that will be used is described below.
        </EmptyState>
        <Methodology report={null} />
      </>
    );
  }

  const modelKeys = Object.keys(report.models || {});
  const rows = modelKeys.map((key) => ({ key, score: report.models[key]?.[partition] }));
  const baselineRows = Object.keys(report.baselines || {}).map((key) => ({
    key,
    score: report.baselines[key]?.[partition],
  }));
  const rocSeries = rows
    .filter((row) => row.score?.roc_curve)
    .map((row) => ({
      key: row.key,
      x: row.score!.roc_curve!.false_positive_rate || [],
      y: row.score!.roc_curve!.true_positive_rate || [],
    }));
  const prSeries = rows
    .filter((row) => row.score?.pr_curve)
    .map((row) => ({
      key: row.key,
      x: row.score!.pr_curve!.recall || [],
      y: row.score!.pr_curve!.precision || [],
    }));
  const validation = report.selection?.validation_average_precision || {};

  return (
    <>
      <dl className="ws-summary-list">
        <div>
          <dt>Model version</dt>
          <dd>{report.model_version}</dd>
        </div>
        <div>
          <dt>Report date</dt>
          <dd>{formatDateTime(report.generated_at)}</dd>
        </div>
        <div>
          <dt>Dataset provenance</dt>
          <dd>
            {report.dataset_source}
            {report.research_approved ? " · research approved" : " · not research approved"}
          </dd>
        </div>
        <div>
          <dt>Dataset size</dt>
          <dd>
            {report.n_samples} rows from {report.n_students} learners
          </dd>
        </div>
        <div>
          <dt>Outcome balance</dt>
          <dd>
            {report.outcome_counts?.successful ?? 0} passed ·{" "}
            {report.outcome_counts?.unsuccessful ?? 0} did not pass
          </dd>
        </div>
        <div>
          <dt>Partitions</dt>
          <dd>
            {["train", "validation", "test"]
              .filter((name) => report.partitions?.[name])
              .map(
                (name) =>
                  `${name}: ${report.partitions[name].n_samples} rows / ${report.partitions[name].n_students} learners`,
              )
              .join(" · ") || "—"}
          </dd>
        </div>
        <div>
          <dt>Selected winner</dt>
          <dd>
            {modelName(report.selection?.winner || "")}
            {report.selection?.tie_rule_applied ? " (resolved by the predeclared tie rule)" : ""} —
            selected on validation Average Precision (
            {Object.keys(validation)
              .map((key) => `${modelName(key)} ${metric(validation[key])}`)
              .join(", ")}
            ).
          </dd>
        </div>
      </dl>

      <Toolbar label="Evaluation partition">
        <SelectField
          label="Partition"
          value={partition}
          onChange={(value) => setPartition(value === "validation" ? "validation" : "test")}
          options={[
            { value: "test", label: "Test (held out)" },
            { value: "validation", label: "Validation (used for selection)" },
          ]}
        />
      </Toolbar>
      <p className="ws-muted">
        Charts and tables show the {partition} partition. The winner was selected using validation
        data, so validation figures are not an independent estimate of future performance.
      </p>

      <h3>Model comparison</h3>
      <ComparisonTable caption={`Model metrics on the ${partition} partition`} rows={rows} />

      <h3>Baselines</h3>
      <ComparisonTable caption={`Baseline metrics on the ${partition} partition`} rows={baselineRows} />

      <h3>Confusion matrices</h3>
      <div className="ml-chart-grid">
        {rows
          .filter((row) => row.score)
          .map((row) => (
            <ConfusionMatrix key={row.key} name={modelName(row.key)} score={row.score!} />
          ))}
      </div>

      <h3>ROC and precision-recall curves</h3>
      <p className="ws-row-meta">
        <span style={{ color: CURVE_COLORS.logreg }}>● Logistic regression (solid)</span> ·{" "}
        <span style={{ color: CURVE_COLORS.random_forest }}>● Random forest (dashed)</span>
      </p>
      <div className="ml-chart-grid">
        <div>
          <CurveChart
            label={`ROC curve on the ${partition} partition`}
            xLabel="False positive rate"
            yLabel="True positive rate"
            diagonal
            series={rocSeries}
          />
        </div>
        <div>
          <CurveChart
            label={`Precision-recall curve on the ${partition} partition`}
            xLabel="Recall"
            yLabel="Precision"
            series={prSeries}
          />
        </div>
      </div>

      <h3>What each metric means</h3>
      <dl className="ws-summary-list">
        {METRIC_DEFINITIONS.map((definition) => (
          <div key={definition.term}>
            <dt>{definition.term}</dt>
            <dd>{definition.meaning}</dd>
          </div>
        ))}
      </dl>

      <Methodology report={report} />
    </>
  );
}

export default function ModelEvaluation({
  courseId,
  refreshToken,
  onLoaded,
}: {
  courseId: string | null;
  refreshToken: number;
  onLoaded: (at: Date) => void;
}) {
  const [version, setVersion] = useState("");
  const path = useMemo(
    () =>
      courseId
        ? `/faculty/ml/evaluation?course_id=${encodeURIComponent(courseId)}${version ? `&model_version=${encodeURIComponent(version)}` : ""}`
        : null,
    [courseId, version],
  );
  const { data, error, loading, reload } = useApi<Evaluation>(path);
  const firstRefresh = useRef(refreshToken);

  useEffect(() => {
    if (refreshToken !== firstRefresh.current) reload();
  }, [refreshToken, reload]);

  useEffect(() => {
    if (data) onLoaded(new Date());
  }, [data, onLoaded]);

  const observed = data?.observed;
  const logreg = observed?.models.logreg;
  const forest = observed?.models.random_forest;

  return (
    <>
      {error ? <Notice tone="error">Model evaluation could not load. {error}</Notice> : null}
      {loading && !data ? <LoadingPanel label="Loading model evaluation…" /> : null}
      {data && observed ? (
        <>
          <section aria-labelledby="ml-observed-title">
            <h2 id="ml-observed-title">Observed outcomes in this course</h2>
            <p className="ws-muted">
              Saved predictions for this course that later had an observed outcome. The counting unit
              is {observed.unit}, not unique learners or independent experiments. Versions are never
              pooled.
            </p>
            {observed.versions.length === 0 ? (
              <EmptyState title="No saved predictions in this course">
                Predictions appear here once an approved model is active and consented learners
                complete eligible activities.
              </EmptyState>
            ) : (
              <>
                <Toolbar label="Evaluation filters">
                  <SelectField
                    label="Model version"
                    value={observed.selected_version || ""}
                    onChange={setVersion}
                    options={observed.versions.map((item) => ({
                      value: item,
                      label: item === observed.active_version ? `${item} (active)` : item,
                    }))}
                  />
                </Toolbar>
                <div className="ws-stat-grid" aria-label="Observed prediction summary">
                  <StatCard
                    label="Saved predictions"
                    value={observed.total_predictions}
                    hint={`Snapshots recorded for ${observed.selected_version}`}
                    icon="▦"
                  />
                  <StatCard
                    label="Awaiting outcomes"
                    value={observed.awaiting_outcome}
                    hint="Target activity not yet attempted"
                    icon="◷"
                  />
                  <StatCard
                    label="Labeled predictions"
                    value={observed.labeled_predictions}
                    hint="Counted in the accuracy below"
                    icon="◉"
                  />
                  <StatCard
                    label="Logistic regression accuracy"
                    value={
                      logreg?.accuracy_percent === null || logreg === undefined
                        ? "—"
                        : `${logreg.accuracy_percent}%`
                    }
                    hint={`Random forest: ${forest?.accuracy_percent === null || forest === undefined ? "—" : `${forest.accuracy_percent}%`}`}
                    icon="↗"
                  />
                </div>
                {observed.labeled_predictions === 0 ? (
                  <Notice tone="info">
                    No prediction in this course has an observed outcome yet, so no accuracy can be
                    reported.
                  </Notice>
                ) : null}
              </>
            )}
          </section>

          <section className="ws-panel" aria-labelledby="ml-offline-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">OFFLINE MODEL COMPARISON</p>
                <h2 id="ml-offline-title">Approved training report</h2>
              </div>
            </div>
            <OfflineComparison report={data.offline.report} />
          </section>
        </>
      ) : null}
    </>
  );
}
