"use client";

import type { CSSProperties } from "react";
import { MAX_STARS, SolveStars } from "@/components/solve-stars";
import { Button, Notice, StatusChip, useApi } from "@/components/workspace/ui";
import type { MasteryConcept, MasteryMapResponse, MemoryState, PracticeError } from "@/lib/types";

const STATE_LABELS = { not_started: "Not started", in_progress: "In progress", mastered: "Mastered" };
const MEMORY_LABELS: Record<MemoryState, string> = { fresh: "Fresh", due: "Due", fading: "Fading", long_term: "Long-term" };
const ERROR_LABELS: Record<PracticeError, string> = {
  syntax_error: "Syntax errors", logic_error: "Logic errors", runtime_error: "Runtime errors", timeout: "Time limits",
};

export function MasteryPath({ concepts, onSelect }: { concepts: MasteryConcept[]; onSelect: (topic: string) => void }) {
  if (!concepts.length) {
    return <div className="empty-state"><h2>No concepts yet</h2><p>Published activities will appear here for your track.</p></div>;
  }

  return (
    <ol className="mastery-path" role="list" aria-label="Concept mastery">
      {concepts.map((item, index) => {
        const state = STATE_LABELS[item.state];
        const weak = item.weak_spot && ERROR_LABELS[item.weak_spot];
        const memory = item.memory && MEMORY_LABELS[item.memory.state];
        const name = [
          item.concept, `${item.completed} of ${item.total} complete`, `${item.mastery_percent}% mastery`, state.toLowerCase(),
          item.average_stars !== null && `average ${item.average_stars} of ${MAX_STARS} stars`,
          weak && `weak spot ${weak.toLowerCase()}`,
          memory && `memory ${memory.toLowerCase()}`,
        ].filter(Boolean).join(", ");
        const row = Math.floor(index / 3);
        const column = index % 3;
        return (
          <li key={item.concept} style={{
            "--step": Math.min(index, 9), "--wide-row": row + 1,
            "--wide-col": row % 2 ? 3 - column : column + 1,
          } as CSSProperties}>
            <button className="mastery-node" type="button" aria-label={name} onClick={() => onSelect(item.concept)}>
              <span className="dashboard-ring mastery-node-ring" style={{ "--pct": item.mastery_percent } as CSSProperties} aria-hidden="true">
                <span>{item.mastery_percent}%</span>
              </span>
              <span className="mastery-node-detail" aria-hidden="true">
                <strong>{item.concept}</strong>
                <StatusChip state={item.state} label={state} tone={item.state === "mastered" ? "good" : "muted"} />
                {item.average_stars !== null ? (
                  <span className="mastery-node-stars"><SolveStars stars={item.average_stars} /> {item.average_stars} average</span>
                ) : null}
                {weak ? <StatusChip state="watch" label={`Watch: ${weak}`} tone="wait" /> : null}
                {memory ? <StatusChip state="memory" label={`Memory: ${memory}`} tone={item.memory?.state === "due" || item.memory?.state === "fading" ? "wait" : "info"} /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function MasteryMap({ onSelect }: { onSelect: (topic: string) => void }) {
  const { data, loading, error, reload } = useApi<MasteryMapResponse>("/quests/mastery-map");
  if (loading) return <div className="ws-skeleton gamification-skeleton" role="status" aria-label="Loading Mastery map" />;
  if (error) return <><Notice tone="error">{error}</Notice><Button onClick={reload}>Try again</Button></>;
  return data ? <MasteryPath concepts={data.concepts} onSelect={onSelect} /> : null;
}
