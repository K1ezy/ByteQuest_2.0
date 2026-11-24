"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export interface ConsentStatus {
  available: boolean;
  version: string | null;
  text: string | null;
  choice: "accepted" | "declined" | "withdrawn" | null;
  /** Set when the student answered an older form, which no longer counts. */
  previous_version?: string | null;
}

export const getConsent = () => apiRequest<ConsentStatus>("/pilot/research/consent");
export const saveConsent = (choice: "accepted" | "declined" | "withdrawn", version: string) =>
  apiRequest("/pilot/research/consent", { method: "POST", body: JSON.stringify({ choice, document_version: version }) });

/** What research use means, in the words the card and the full page share. */
export function ConsentFacts() {
  return (
    <dl className="ws-summary-list">
      <div><dt>What is used</dt><dd>Your practice results: whether each attempt passed, its score, the type of error, how long it took, and how many hints you opened. Exports use a research code, not your name or School ID.</dd></div>
      <div><dt>What is never used</dt><dd>Your code, your chats with the tutor, or anything the AI writes.</dd></div>
      <div><dt>What stays the same</dt><dd>Your grades, XP, badges and access are the same whether you agree, decline or withdraw.</dd></div>
      <div><dt>If you withdraw later</dt><dd>Your data is left out of future research exports and forecasts. Data already exported before you withdrew stays in that export.</dd></div>
    </dl>
  );
}

/** Asked once on the Dashboard while consent is open and unanswered. Both answers carry equal weight and no reward. */
export function ResearchConsentCard() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [answered, setAnswered] = useState<"accepted" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getConsent();
      // A first-ever answer given at sign-up is recorded here, the first time the student is signed in
      // (email confirmation can mean there was no session at sign-up). It never overrides a recorded answer.
      // shortcut: if the consent version changes between sign-up and first sign-in, the answer applies to the new
      // version; send the version with sign-up if that window ever matters.
      if (result.available && result.version && result.choice === null && !result.previous_version) {
        const signup = await getSupabase().auth.getSession()
          .then(({ data }) => data.session?.user.user_metadata?.research_consent, () => undefined);
        if (signup === "accepted" || signup === "declined") {
          await saveConsent(signup, result.version);
          return;
        }
      }
      if (active) setStatus(result);
    })().catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function answer(choice: "accepted" | "declined") {
    if (!status?.version) return;
    setBusy(true);
    setError("");
    try {
      await saveConsent(choice, status.version);
      setAnswered(choice);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (answered) {
    return (
      <section className="pilot-card dashboard-consent" aria-live="polite">
        <p>{answered === "accepted" ? "Thank you for helping the study." : "No problem. Nothing changes for you."}{" "}
          You can change this anytime in <Link href="/account/research">Research participation</Link>.</p>
      </section>
    );
  }
  if (!status?.available || status.choice !== null) return null;
  return (
    <section className="pilot-card dashboard-consent" aria-labelledby="consent-card-title">
      <p className="eyebrow-label">Research study</p>
      <h2 id="consent-card-title">Help a classroom study of ByteQuest?</h2>
      {status.previous_version ? <p><strong>The consent form was updated,</strong> so your earlier answer no longer applies. Please answer again.</p> : null}
      <p>With your consent, your practice results can be used, under a research code, to study how students learn to code.
        Saying no changes nothing about your grades, XP or access.</p>
      <div className="pilot-actions">
        <button type="button" className="button button-outline" disabled={busy} onClick={() => void answer("accepted")}>I agree</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={() => void answer("declined")}>No, thanks</button>
        <Link className="button button-quiet" href="/account/research">Read more</Link>
      </div>
      {error ? <p className="ws-field-error" role="alert">{error}</p> : null}
    </section>
  );
}
