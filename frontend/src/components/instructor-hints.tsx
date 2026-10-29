"use client";

import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

interface Hint { id: string; slot: number; body: string }

export function InstructorHints({ activityId, editable }: { activityId: string; editable: boolean }) {
  const [hints, setHints] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void apiRequest<Hint[]>(`/pilot/instructor/activities/${activityId}/hints`)
    .then((items) => { if (active) { const values = Object.fromEntries(items.map((h) => [h.slot, h.body])); setHints(values); setSaved(values); } })
    .catch((cause) => { if (active) setError(getErrorMessage(cause)); });
    return () => { active = false; }; }, [activityId]);
  async function save(slot: number) {
    setBusySlot(slot); setError("");
    try { await apiRequest(`/pilot/instructor/activities/${activityId}/hints`, {
      method: "PUT", body: JSON.stringify({ slot, body: hints[slot] || "" }) });
      setSaved((old) => ({ ...old, [slot]: hints[slot] }));
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusySlot(null); }
  }
  return <section className="test-case-section"><h3 className="library-subheading">Guiding hints</h3>
    <p className="muted-copy">Up to five instructor hints. Students may reveal them in any order; AI guidance uses the same five-use budget.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    {[1,2,3,4,5].map((slot) => <div className="field" key={slot}>
      <label htmlFor={`hint-${activityId}-${slot}`}>Hint {slot}</label>
      <textarea id={`hint-${activityId}-${slot}`} rows={2} maxLength={2000} disabled={!editable || busySlot !== null}
        value={hints[slot] || ""} onChange={(event) => setHints((old) => ({ ...old, [slot]: event.target.value }))} />
      {editable && hints[slot]?.trim() && hints[slot] !== saved[slot] && <button type="button" className="button button-outline small"
        disabled={busySlot !== null} onClick={() => void save(slot)}>{busySlot === slot ? "Saving…" : "Save hint"}</button>}
    </div>)}
  </section>;
}
