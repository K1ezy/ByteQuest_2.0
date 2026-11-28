"use client";

import { useId, useState, type ReactNode } from "react";
import { metrics, type MetricKey } from "@/lib/insight-metrics";

/** An (i) button that explains a metric on hover, tap or keyboard, and closes on Escape or blur. */
export function MetricInfo({ metric }: { metric: MetricKey }) {
  // Hover shows it; a click or tap pins it, so the click that follows a hover never closes it again.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const id = useId();
  const { label, definition } = metrics[metric];
  return <span className="metric-info">
    <button type="button" className="metric-info-button" aria-label={`What does ${label} mean?`}
      aria-expanded={open} aria-controls={id} onClick={() => setPinned(!pinned)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onKeyDown={(event) => { if (event.key === "Escape") { setPinned(false); setHovered(false); } }}>i</button>
    {/* In the card's flow, not a floating box, so it can never run off a narrow screen. */}
    <span id={id} role="note" className="metric-info-text" hidden={!open}>{definition}</span>
  </span>;
}

/**
 * Sentence first (the chosen "Variant A"): a plain sentence giving the value, its total and what is
 * left, then the number, its label and the (i) definition underneath.
 */
export function MetricCard({ sentence, value, metric, change, children }: {
  sentence: ReactNode; value: ReactNode; metric: MetricKey; change?: string; children?: ReactNode;
}) {
  return <section className="ws-stat-card metric-card" aria-label={metrics[metric].label}>
    <p className="metric-card-sentence">{sentence}</p>
    <p className="metric-card-figure"><strong>{value}</strong> {metrics[metric].label}<MetricInfo metric={metric} /></p>
    {change ? <p className="metric-card-change">{change}</p> : null}
    {children}
  </section>;
}
