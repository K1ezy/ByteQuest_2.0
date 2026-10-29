"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

type ShadowAnalytics = {
  total_predictions_logged: number;
  labeled_predictions: number;
  model_versions: { model_version: string | null; prediction_count: number }[];
  average_predicted_success_probability_percent: {
    logistic_regression: number | null;
    random_forest: number | null;
  };
  accuracy_percent: {
    logistic_regression: number | null;
    random_forest: number | null;
  };
  active_sequencer_mode: "rule_based";
  shadow_status:
    | "disabled"
    | "approval_required"
    | "ready"
    | "artifacts_unavailable"
    | "artifacts_invalid"
    | "unavailable";
  status: "shadow_active" | "no_predictions_yet";
};

const shadowStatusLabels: Record<ShadowAnalytics["shadow_status"], string> = {
  disabled: "Shadow scoring disabled",
  approval_required: "Approval attestation required",
  ready: "Reviewed model ready",
  artifacts_unavailable: "No reviewed model active",
  artifacts_invalid: "Model validation failed",
  unavailable: "Shadow scoring unavailable",
};

function formatPercent(value: number | null): string {
  return value === null ? "Not available" : `${value.toFixed(2)}%`;
}

export function InstructorShadowAnalytics() {
  const [summary, setSummary] = useState<ShadowAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback((signal?: AbortSignal) => {
    return apiRequest<ShadowAnalytics>("/predict/instructor/analytics", { signal });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await fetchSummary());
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSummary(controller.signal)
      .then((value) => setSummary(value))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [fetchSummary]);

  const statusTone = summary?.shadow_status === "ready" ? "good" : "pending";

  return (
    <section className="panel shadow-analytics-panel" aria-labelledby="shadow-analytics-title">
      <div className="workspace-library-heading">
        <div>
          <p className="eyebrow-label">PHASE 6 · AGGREGATE VIEW</p>
          <h2 className="panel-title" id="shadow-analytics-title">Sequencer evaluation</h2>
        </div>
        <button className="button quiet small" type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <p className="panel-subtitle">
        Rule-based sequencing remains in control. Shadow model results are observational and never change a student’s next challenge.
      </p>

      {loading && <p className="muted-copy" role="status">Loading aggregate evaluation…</p>}
      {error && (
        <div className="workspace-notice error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => void refresh()}>Try again</button>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="shadow-analytics-status">
            <span className={`status-pill ${statusTone}`}>{shadowStatusLabels[summary.shadow_status]}</span>
            <span className="muted-copy">Active student sequencer: {summary.active_sequencer_mode.replace("_", " ")}</span>
          </div>

          {summary.status === "no_predictions_yet" && (
            <p className="muted-copy" role="status">
              No shadow predictions are recorded. This is expected while shadow scoring is disabled or no reviewed model is active.
            </p>
          )}

          <dl className="shadow-analytics-grid">
            <div className="shadow-analytics-metric">
              <dt>Predictions recorded</dt>
              <dd>{summary.total_predictions_logged}</dd>
            </div>
            <div className="shadow-analytics-metric">
              <dt>Predictions with outcomes</dt>
              <dd>{summary.labeled_predictions}</dd>
            </div>
            <div className="shadow-analytics-metric">
              <dt>Logistic regression accuracy</dt>
              <dd>{formatPercent(summary.accuracy_percent.logistic_regression)}</dd>
            </div>
            <div className="shadow-analytics-metric">
              <dt>Random forest accuracy</dt>
              <dd>{formatPercent(summary.accuracy_percent.random_forest)}</dd>
            </div>
          </dl>

          <div className="shadow-model-versions">
            <strong>Model versions</strong>
            {summary.model_versions.length ? (
              <ul>
                {summary.model_versions.map((version) => (
                  <li key={version.model_version ?? "unversioned"}>
                    {version.model_version || "Unversioned"} · {version.prediction_count} predictions
                  </li>
                ))}
              </ul>
            ) : <span className="muted-copy">None recorded</span>}
          </div>
          <p className="muted-copy shadow-analytics-footnote">
            Metrics use only predictions with a later observed outcome. They are aggregate summaries and do not show individual learner records.
          </p>
        </>
      )}
    </section>
  );
}
