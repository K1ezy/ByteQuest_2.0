"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LegalDocument, type LegalKind } from "./legal-document";

function PolicyPanel({ kind, label, helpId, reachedEnd, onReachEnd }: {
  kind: LegalKind;
  label: string;
  helpId: string;
  reachedEnd: boolean;
  onReachEnd: (reached: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element || reachedEnd) return;
    function checkEnd() {
      if (element && element.scrollHeight - element.scrollTop - element.clientHeight <= 1) onReachEnd(true);
    }
    checkEnd();
    element.addEventListener("scroll", checkEnd);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(checkEnd);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", checkEnd);
      observer?.disconnect();
    };
  }, [onReachEnd, reachedEnd]);

  return (
    <div className="auth-policy-panel">
      <div ref={panel} role="region" tabIndex={0} aria-label={label} aria-describedby={helpId}
        className="auth-policy-scroll">
        <LegalDocument kind={kind} embedded />
      </div>
      <p id={helpId} className="text-xs text-slate-600" aria-live="polite">
        {reachedEnd ? "Acknowledgment available." : "Scroll to the end to unlock the checkbox."}
      </p>
    </div>
  );
}

export function SignupAgreement({ busy, error, onAgree, onDisagree, recoveryActions }: {
  busy: boolean;
  error: string | null;
  onAgree: () => void;
  onDisagree: () => void;
  recoveryActions?: ReactNode;
}) {
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const termsHelpId = useId();
  const privacyHelpId = useId();

  return (
    <form className="auth-agreement" onSubmit={(event) => {
      event.preventDefault();
      if (termsChecked && privacyChecked && !busy) onAgree();
    }}>
      <p className="text-sm text-slate-700">Read each document to the end and check both boxes to create your account.</p>
      <div className="auth-agreement-documents">
        <PolicyPanel kind="terms" label="Terms of Service" helpId={termsHelpId} reachedEnd={termsRead} onReachEnd={setTermsRead} />
        <PolicyPanel kind="privacy" label="Privacy Policy" helpId={privacyHelpId} reachedEnd={privacyRead} onReachEnd={setPrivacyRead} />
      </div>
      <fieldset className="auth-agreement-checks" aria-label="Policy acknowledgments">
        <label>
          <input type="checkbox" checked={termsChecked} disabled={!termsRead || busy} aria-describedby={termsHelpId}
            onChange={(event) => setTermsChecked(event.target.checked)} />
          I acknowledge the Terms of Service
        </label>
        <label>
          <input type="checkbox" checked={privacyChecked} disabled={!privacyRead || busy} aria-describedby={privacyHelpId}
            onChange={(event) => setPrivacyChecked(event.target.checked)} />
          I acknowledge the Privacy Policy
        </label>
      </fieldset>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p role="alert">{error}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {recoveryActions}
            <button type="button" className="auth-text-action auth-purple-action" onClick={onDisagree}>Edit sign-up details</button>
          </div>
        </div>
      )}
      <div className="auth-agreement-actions">
        <button type="submit" disabled={busy || !termsChecked || !privacyChecked}
          className="auth-action auth-primary-button">
          {busy ? "Creating account…" : "I agree"}
        </button>
        <button type="button" onClick={onDisagree} disabled={busy} className="auth-action auth-secondary-button">
          I disagree
        </button>
      </div>
    </form>
  );
}
