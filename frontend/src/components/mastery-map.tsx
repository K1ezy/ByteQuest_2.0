"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { MAX_STARS, SolveStars } from "@/components/solve-stars";
import { Button, Notice, StatusChip, useApi } from "@/components/workspace/ui";
import { workshopLanguages } from "@/components/workshops/workshop-ui";
import type { MasteryConcept, MasteryMapResponse, MemoryState, PracticeError, ProgrammingLanguage } from "@/lib/types";

const STATE_LABELS = { not_started: "Not started", in_progress: "In progress", mastered: "Mastered" };
const MEMORY_LABELS: Record<MemoryState, string> = { fresh: "Fresh", due: "Due", fading: "Fading", long_term: "Long-term" };
const ERROR_LABELS: Record<PracticeError, string> = {
  syntax_error: "Syntax errors", logic_error: "Logic errors", runtime_error: "Runtime errors", timeout: "Time limits",
};

function MasteryPath({ concepts }: { concepts: MasteryConcept[] }) {
  if (!concepts.length) {
    return <div className="empty-state"><h3>No concepts yet</h3><p>Activities your workshops share will appear here.</p></div>;
  }

  return (
    <ol className="mastery-path" role="list" aria-label="Concept mastery">
      {concepts.map((item, index) => {
        const state = STATE_LABELS[item.state];
        const weak = item.weak_spot && ERROR_LABELS[item.weak_spot];
        const memory = item.memory && MEMORY_LABELS[item.memory.state];
        const language = workshopLanguages[item.language];
        const name = [
          `${item.concept} in ${language}`, `${item.completed} of ${item.total} complete`, `${item.mastery_percent}% mastery`, state.toLowerCase(),
          item.average_stars !== null && `average ${item.average_stars} of ${MAX_STARS} stars`,
          weak && `weak spot ${weak.toLowerCase()}`,
          memory && `memory ${memory.toLowerCase()}`,
        ].filter(Boolean).join(", ");
        const row = Math.floor(index / 3);
        const column = index % 3;
        return (
          <li key={`${item.language}:${item.concept}`} style={{
            "--step": Math.min(index, 9), "--wide-row": row + 1,
            "--wide-col": row % 2 ? 3 - column : column + 1,
          } as CSSProperties}>
            <Link className="mastery-node" href={`/quests?concept=${encodeURIComponent(item.concept)}&language=${item.language}`} aria-label={name}>
              <span className="dashboard-ring mastery-node-ring" style={{ "--pct": item.mastery_percent } as CSSProperties} aria-hidden="true">
                <span>{item.mastery_percent}%</span>
              </span>
              <span className="mastery-node-detail" aria-hidden="true">
                <strong>{item.concept}</strong>
                <span className="tag quest-language">{language}</span>
                <StatusChip state={item.state} label={state} tone={item.state === "mastered" ? "good" : "muted"} />
                {item.average_stars !== null ? (
                  <span className="mastery-node-stars"><SolveStars stars={item.average_stars} /> {item.average_stars} average</span>
                ) : null}
                {weak ? <StatusChip state="watch" label={`Watch: ${weak}`} tone="wait" /> : null}
                {memory ? <StatusChip state="memory" label={`Memory: ${memory}`} tone={item.memory?.state === "due" || item.memory?.state === "fading" ? "wait" : "info"} /> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function MasteryMap() {
  const { data, loading, error, reload } = useApi<MasteryMapResponse>("/quests/mastery-map");
  if (loading) return <div className="ws-skeleton gamification-skeleton" role="status" aria-label="Loading Mastery map" />;
  if (error) return <><Notice tone="error">{error}</Notice><Button onClick={reload}>Try again</Button></>;
  return data ? <MasteryLanguages data={data} /> : null;
}

function MasteryLanguages({ data }: { data: MasteryMapResponse }) {
  const [language, setLanguage] = useState<ProgrammingLanguage | null>(null);
  const concepts = language ? data.concepts.filter((item) => item.language === language) : data.concepts;
  return <>
    {data.languages.length > 1 ? (
      <div className="quest-filters" role="group" aria-label="Language">
        {[null, ...data.languages].map((value) => (
          <button type="button" key={value ?? "all"} className="filter-button" aria-pressed={language === value}
            onClick={() => setLanguage(value)}>
            {value ? workshopLanguages[value] : "All languages"}
          </button>
        ))}
      </div>
    ) : null}
    <MasteryPath concepts={concepts} />
  </>;
}
