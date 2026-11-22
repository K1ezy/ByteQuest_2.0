"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MechanicIntro, MechanicTeaser } from "@/components/mechanic-rollout";
import { Button, Notice, useApi } from "@/components/workspace/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { RecallReview, ReviewOverview } from "@/lib/types";

export function MemoryCheck({ userId }: { userId: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<ReviewOverview>("/reviews");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // The API orders eligible concepts by due date and determines their state.
  const next = data?.concepts.find(({ state, open_review_id }) => open_review_id || state === "due" || state === "fading");
  const showCheck = loading || Boolean(error || data?.locked || next);

  async function start(concept: string) {
    setStarting(true);
    setStartError("");
    try {
      const review = await apiRequest<RecallReview>("/reviews/start", {
        method: "POST", body: JSON.stringify({ concept }),
      });
      router.push(`/reviews/${review.id}`);
    } catch (cause) {
      setStartError(getErrorMessage(cause));
      setStarting(false);
    }
  }

  return <>
    {!loading && !error && data?.unlock?.unlocked
      ? <MechanicIntro key={userId} mechanic="memory" userId={userId} /> : null}
    {showCheck ? <section className="pilot-card memory-check" aria-labelledby="memory-check-title">
      <h2 id="memory-check-title">{data?.locked ? "Mastery Memory" : "Memory check"}</h2>
      {loading ? <div className="ws-skeleton gamification-skeleton" role="status" aria-label="Loading memory checks" /> : null}
      {error ? <><Notice tone="error">{error}</Notice><Button onClick={reload}>Try again</Button></> : null}
      {!loading && !error && data?.locked
        ? <MechanicTeaser mechanic="memory" unlock={data.unlock} day={data.day} /> : null}
      {!loading && !error && data && !data.locked && next ? (
        <>
          {data.due_count > 0
            ? <p>{data.due_count === 1 ? "1 concept is" : `${data.due_count} concepts are`} due for a quick recall.</p> : null}
          <p className="ws-muted">Up next: <strong>{next.concept}</strong></p>
          {startError ? <Notice tone="error">{startError}</Notice> : null}
          <Button onClick={() => void start(next.concept)} disabled={starting} aria-busy={starting}>
            {starting ? "Opening review…" : next.open_review_id ? "Resume review" : "Start review"}
          </Button>
        </>
      ) : null}
    </section> : null}
  </>;
}
