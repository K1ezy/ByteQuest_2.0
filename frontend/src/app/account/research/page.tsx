"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";

interface ConsentStatus {
  available: boolean;
  version: string | null;
  text: string | null;
  choice: "accepted" | "declined" | "withdrawn" | null;
}

export default function ResearchConsentSettingsPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentInfo, setConsentInfo] = useState<ConsentStatus | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<ConsentStatus>("/pilot/research/consent")
      .then((res) => {
        if (!active) return;
        setConsentInfo(res);
      })
      .catch((cause) => { if (active) setError(getErrorMessage(cause)); });
    return () => {
      active = false;
    };
  }, []);

  const handleWithdraw = async () => {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/pilot/research-consent/withdraw", { method: "POST" });
      setConsentInfo(await apiRequest<ConsentStatus>("/pilot/research/consent"));
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const choose = async (choice: "accepted" | "declined") => {
    if (!consentInfo?.available || !consentInfo.version) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/pilot/research/consent", { method: "POST",
        body: JSON.stringify({ choice, document_version: consentInfo.version }) });
      setConsentInfo(await apiRequest<ConsentStatus>("/pilot/research/consent"));
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-xs font-bold text-amber-900">
            {consentInfo?.available ? "Research Consent Available" : "Research Telemetry Disabled"}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
            Research Participation & Data Privacy
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage how your anonymized learning telemetry is used in the ByteQuest classroom study.
          </p>
        </div>

        {/* Hard Safety Lock Notice */}
        {!consentInfo?.available && (
          <div
            role="status"
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700"
          >
            <p className="font-bold text-slate-900">
              Research data collection is currently disabled (v0.0-pending-approval)
            </p>
            <p className="mt-1">
              Approved institutional consent text, version identifier, and data retention policies are not yet active. ByteQuest is operating in classroom-only mode — zero research telemetry is being recorded or exported.
            </p>
          </div>
        )}
        {consentInfo?.available && consentInfo.text && <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold">Research consent, version {consentInfo.version}</h2>
          <p className="whitespace-pre-wrap mt-2">{consentInfo.text}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button type="button" className="button button-primary" disabled={busy}
              onClick={() => void choose("accepted")}>I agree to research use</button>
            <button type="button" className="button button-outline" disabled={busy}
              onClick={() => void choose("declined")}>Decline research use</button>
          </div>
        </section>}

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-600">Current Status:</span>
            <span className="font-mono font-bold uppercase text-slate-900">
              {consentInfo?.choice ?? "not collected"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-600">Consent Version:</span>
            <span className="font-mono text-slate-700">{consentInfo?.version ?? "Pending approval"}</span>
          </div>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}

        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500 max-w-sm">
            Withdrawing never affects your access to quests, exams, or instructor course grades.
          </p>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={consentInfo?.choice === "withdrawn" || busy || !consentInfo}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            {consentInfo?.choice === "withdrawn"
              ? "Participation Withdrawn"
              : "Withdraw from Research"}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <Link href="/dashboard" className="text-xs font-semibold text-[#156046] hover:underline">
            ← Return to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
