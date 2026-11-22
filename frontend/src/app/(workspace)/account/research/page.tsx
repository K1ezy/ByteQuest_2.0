"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { Button, ConfirmDialog, Notice, PageHeading, StatusChip } from "@/components/workspace/ui";
import { ConsentFacts, getConsent, saveConsent, type ConsentStatus } from "@/components/research-consent";

const CHOICE_LABEL: Record<string, string> = {
  accepted: "You agreed", declined: "You declined", withdrawn: "You withdrew",
};

export default function ResearchConsentSettingsPage() {
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  useEffect(() => {
    let active = true;
    getConsent().then((result) => { if (active) setConsent(result); })
      .catch((cause) => { if (active) setError(getErrorMessage(cause)); });
    return () => { active = false; };
  }, []);

  async function choose(choice: "accepted" | "declined" | "withdrawn") {
    if (!consent?.version) return;
    setBusy(true);
    setError("");
    try {
      await saveConsent(choice, consent.version);
      setConsent(await getConsent());
      setConfirmWithdraw(false);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const choice = consent?.choice ?? null;
  return (
    <section className="page-shell research-consent-page">
      <PageHeading eyebrow="ACCOUNT" title="Research participation"
        description="Decide whether your practice results may be used in the ByteQuest classroom study. You can change your answer at any time."
        status={consent ? <StatusChip state={choice || "pending"} label={choice ? CHOICE_LABEL[choice] : "Not answered yet"}
          tone={choice === "accepted" ? "good" : "muted"} /> : undefined} />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {consent && !consent.available ? (
        <Notice tone="info">
          The study isn&apos;t open yet. Nothing about your learning is collected for research.
          {choice === "accepted" ? " Your earlier agreement still applies until you withdraw it." : ""}
        </Notice>
      ) : null}

      <section className="ws-panel" aria-labelledby="consent-facts-title">
        <h2 id="consent-facts-title">What research use means</h2>
        <ConsentFacts />
      </section>

      {consent?.available && consent.text ? (
        <section className="ws-panel" aria-labelledby="consent-text-title">
          <h2 id="consent-text-title">Consent form, version {consent.version}</h2>
          <p className="research-consent-text">{consent.text}</p>
          {choice === "accepted" ? null : (
            <div className="ws-inline-actions">
              <Button variant="outline" disabled={busy} onClick={() => void choose("accepted")}>I agree to research use</Button>
              <Button variant="outline" disabled={busy} onClick={() => void choose("declined")}>
                {choice === "declined" ? "Keep declining" : "Decline research use"}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {choice === "accepted" ? (
        <section className="ws-panel" aria-labelledby="withdraw-title">
          <h2 id="withdraw-title">Withdraw from the study</h2>
          <p>You agreed to version {consent?.version}. Withdrawing leaves your data out of future research exports and forecasts.</p>
          <Button variant="danger" disabled={busy} onClick={() => setConfirmWithdraw(true)}>Withdraw from research</Button>
        </section>
      ) : null}

      <Link className="ws-text-link" href="/dashboard">← Back to dashboard</Link>

      <ConfirmDialog open={confirmWithdraw} title="Withdraw from the study?" confirmLabel="Withdraw" tone="danger" busy={busy}
        onCancel={() => setConfirmWithdraw(false)} onConfirm={() => void choose("withdrawn")}>
        <p>Your data will be left out of future research exports and forecasts. Data already exported before today stays in
          that export. Your grades, XP and access don&apos;t change.</p>
      </ConfirmDialog>
    </section>
  );
}
