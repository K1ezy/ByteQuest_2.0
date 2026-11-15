"use client";

import { MechanicIntro, MechanicTeaser } from "@/components/mechanic-rollout";
import { Button, Notice, StatCard, StatusChip, useApi } from "@/components/workspace/ui";
import type { CodexCategory, CodexResponse } from "@/lib/types";

const TIER_LABELS = ["Undiscovered", "Tier I", "Tier II", "Tier III"];

export function CodexEntry({ entry }: { entry: CodexCategory }) {
  const { label, tier, recoveries, next_tier_at: nextTier, topics } = entry;
  return (
    <article className="codex-entry" aria-labelledby={`codex-${entry.category}`}>
      <div className="codex-entry-head">
        <h3 id={`codex-${entry.category}`}>{label}</h3>
        <StatusChip state={tier ? "active" : "draft"} label={TIER_LABELS[tier]} tone={tier ? "info" : "muted"} />
      </div>
      {nextTier !== null ? (
        <>
          <progress aria-label={`${label} progress toward ${TIER_LABELS[tier + 1]}`} value={recoveries} max={nextTier} />
          <p className="ws-muted">{recoveries} of {nextTier} {nextTier === 1 ? "recovery" : "recoveries"} toward {TIER_LABELS[tier + 1]}</p>
        </>
      ) : <p className="ws-muted">{recoveries} recoveries · Highest tier reached</p>}
      <p>{topics.length ? topics.join(", ") : "Not discovered yet. Fix a failing run to record your first entry."}</p>
    </article>
  );
}

export function DebuggerCodex({ userId }: { userId: string }) {
  const { data, error, loading, reload } = useApi<CodexResponse>("/quests/codex");
  return (
    <section className="ws-panel" aria-labelledby="codex-title">
      <h2 id="codex-title">Debugger&apos;s Codex</h2>
      {loading ? <div className="ws-skeleton gamification-skeleton" role="status" aria-label="Loading Debugger's Codex" /> : null}
      {error ? <><Notice tone="error">{error}</Notice><Button onClick={reload}>Try again</Button></> : null}
      {!loading && !error && data?.locked
        ? <MechanicTeaser mechanic="codex" unlock={data.unlock} day={data.day} /> : null}
      {!loading && !error && data && !data.locked ? (
        <>
          <MechanicIntro key={userId} mechanic="codex" userId={userId} />
          <div className="codex-totals">
            <StatCard label="Total recoveries" value={data.total_recoveries} />
            <StatCard label="Comebacks" value={data.comebacks} />
          </div>
          <div className="codex-grid">
            {data.categories.map((entry) => <CodexEntry key={entry.category} entry={entry} />)}
          </div>
        </>
      ) : null}
    </section>
  );
}
