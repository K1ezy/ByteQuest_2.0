"use client";

import { recapSentence } from "@/lib/takeaway";
import Link from "next/link";
import { useState } from "react";
import { Button, Notice, useApi } from "@/components/workspace/ui";

// Mirrors backend app/services/gamification/progress_recap.py (ProgressRecap).
export const RECAP_PERIODS = [3, 7, 30] as const;
type RecapDays = (typeof RECAP_PERIODS)[number];
export interface RecapMetric {
  key: "solved" | "self_solved" | "recoveries" | "recalls" | "active_days";
  label: string;
  current: number;
  previous: number;
  change: number;
  usual: number | null;
}
export interface ProgressRecapData {
  days: number;
  period_start: string;
  period_end: string;
  previous_start: string;
  previous_end: string;
  enough_activity: boolean;
  comparison: "ok" | "too_little_activity" | "new_learner";
  metrics: RecapMetric[];
}

const dayFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
// The API sends Manila calendar days; reading them as UTC midnight keeps the printed day unchanged.
const formatDay = (value: string) => dayFormat.format(new Date(`${value}T00:00:00Z`));
const range = (start: string, end: string) => (start === end ? formatDay(start) : `${formatDay(start)}–${formatDay(end)}`);

function changeText(metric: RecapMetric, days: number): string {
  const span = `previous ${days} days`;
  if (metric.change > 0) return `+${metric.change} vs ${span}`;
  if (metric.change < 0) return `${-metric.change} fewer than ${span}`;
  return `Same as ${span}`;
}

function usualText(metric: RecapMetric, days: number): string | null {
  if (metric.usual === null) return null;
  const unit = metric.key === "active_days" ? (metric.usual === 1 ? " day" : " days") : "";
  return `Usual: about ${metric.usual}${unit} per ${days} days`;
}

function readStoredDays(key: string): RecapDays {
  try {
    const stored = Number(window.localStorage.getItem(key));
    return (RECAP_PERIODS as readonly number[]).includes(stored) ? (stored as RecapDays) : 7;
  } catch {
    return 7;
  }
}

export function ProgressRecap({ userId }: { userId: string }) {
  const storageKey = `bytequest:recap-days:${userId}`;
  const [days, setDays] = useState<RecapDays>(() => readStoredDays(storageKey));
  const { data, error, loading, reload } = useApi<ProgressRecapData>(`/quests/progress-recap?days=${days}`);

  function choose(next: RecapDays) {
    setDays(next);
    try { window.localStorage.setItem(storageKey, String(next)); } catch { /* Remember for this visit only. */ }
  }

  // useApi keeps the last figures while the next period loads, so the card never flashes empty.
  const shown = data;
  const dropped = Boolean(shown?.enough_activity && shown.metrics.every((metric) => metric.change <= 0)
    && shown.metrics.some((metric) => metric.change < 0));

  return (
    <section className="ws-panel dashboard-recap" aria-labelledby="recap-title" aria-busy={loading}>
      <div className="recap-head">
        <div>
          <p className="eyebrow-label">Your recent progress</p>
          <h2 id="recap-title">Last {shown?.days ?? days} days</h2>
        </div>
        <div className="recap-periods" role="group" aria-label="Compare period">
          {RECAP_PERIODS.map((period) => (
            <button key={period} type="button" aria-pressed={days === period} onClick={() => choose(period)}>
              {period} days
            </button>
          ))}
        </div>
      </div>

      {loading && !shown ? <div className="ws-skeleton recap-skeleton" role="status" aria-label="Loading your recent progress" /> : null}
      {error ? <><Notice tone="error">{error}</Notice><Button variant="outline" onClick={reload}>Try again</Button></> : null}

      {shown && !error ? (
        <>
          <p className="dashboard-muted recap-range">
            {range(shown.period_start, shown.period_end)} compared with {range(shown.previous_start, shown.previous_end)}
          </p>
          {shown.comparison === "too_little_activity" ? (
            <p className="recap-note">Not enough activity yet to compare. Keep practising and your changes will show here.</p>
          ) : shown.comparison === "new_learner" ? (
            <p className="recap-note">You started within this comparison window, so there is no full earlier period to compare yet.</p>
          ) : null}
          <ul className="recap-list">
            {shown.metrics.map((metric) => (
              <li key={metric.key}>
                <span className="recap-sentence">{recapSentence(metric.key, metric.current, shown.days)}</span>
                {/* The sentence already says the number, so screen readers skip the repeat. */}
                <span className="recap-label" aria-hidden="true">{metric.label}</span>
                <strong className="recap-value" aria-hidden="true">{metric.current}</strong>
                {shown.enough_activity ? (
                  <span className={`recap-change${metric.change > 0 ? " is-up" : ""}`}>
                    {metric.change > 0 ? <span aria-hidden="true">▲ </span> : null}
                    {changeText(metric, shown.days)}
                  </span>
                ) : null}
                {usualText(metric, shown.days) ? <span className="recap-usual">{usualText(metric, shown.days)}</span> : null}
              </li>
            ))}
          </ul>
          {dropped ? (
            <p className="recap-nudge">
              Ready to get back into it? <Link className="dashboard-text-link" href="/quests">Open the Quest Map <span aria-hidden="true">→</span></Link>
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
