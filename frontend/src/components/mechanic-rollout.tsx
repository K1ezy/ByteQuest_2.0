"use client";

import { useState } from "react";
import { Button, StatusChip } from "@/components/workspace/ui";
import type { MechanicUnlock } from "@/lib/types";

const MECHANICS = {
  codex: {
    title: "Debugger's Codex",
    intro: "Turn bugs into progress.",
    description: "Track the errors you learn to fix as you solve coding challenges.",
  },
  memory: {
    title: "Mastery Memory",
    intro: "Keep what you learned fresh with short Recall quests.",
    description: "Revisit concepts with short Recall quests spaced over time.",
  },
};

type Mechanic = keyof typeof MECHANICS;

export function MechanicTeaser({ mechanic, unlock, day }: { mechanic: Mechanic; unlock: MechanicUnlock; day: number }) {
  // Show the distance between the two calendar days supplied by the API.
  const remaining = unlock.unlock_day - day;
  return (
    <div className="mechanic-teaser">
      <StatusChip state="upcoming" tone="muted" label={`Unlocks on day ${unlock.unlock_day}`} />
      {unlock.unlocks_on && remaining > 0 ? <span>Unlocks in {remaining} {remaining === 1 ? "day" : "days"}</span> : null}
      <p>{MECHANICS[mechanic].description}</p>
    </div>
  );
}

export function MechanicIntro({ mechanic, userId }: { mechanic: Mechanic; userId: string }) {
  const storageKey = `bytequest:mechanic-intro:v1:${userId}:${mechanic}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) === "dismissed";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;

  const { title, intro } = MECHANICS[mechanic];
  return (
    <aside className="mechanic-intro" aria-label={`New: ${title}`}>
      <p><strong>New: {title}.</strong> {intro}</p>
      <Button variant="quiet" className="small" aria-label={`Dismiss ${title} introduction`} onClick={() => {
        setDismissed(true);
        try { window.localStorage.setItem(storageKey, "dismissed"); } catch { /* Dismiss for this visit. */ }
      }}>Dismiss</Button>
    </aside>
  );
}
