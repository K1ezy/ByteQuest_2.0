"use client";

import { useId, useState } from "react";

export function ActivityDateFilter({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const hintId = useId();
  const [error, setError] = useState("");

  return (
    <details className="activity-date-filter">
      <summary>{from || to ? "Date added · Filtered" : "Date added"}</summary>
      <form className="activity-date-fields" onInput={() => setError("")} onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const nextFrom = String(fields.get("from") ?? "");
        const nextTo = String(fields.get("to") ?? "");
        if (nextFrom && nextTo && nextFrom > nextTo) {
          setError("The end date must be on or after the start date.");
          return;
        }
        setError("");
        onChange(nextFrom, nextTo);
      }}>
        <label>From
          <input key={from} type="date" name="from" defaultValue={from} aria-invalid={Boolean(error) || undefined}
            aria-describedby={hintId} />
        </label>
        <label>Through
          <input key={to} type="date" name="to" defaultValue={to} aria-invalid={Boolean(error) || undefined}
            aria-describedby={hintId} />
        </label>
        <button type="submit" className="button button-outline small">Apply dates</button>
        <p id={hintId} role={error ? "alert" : undefined}>{error || "Dates use Manila time."}</p>
      </form>
    </details>
  );
}
