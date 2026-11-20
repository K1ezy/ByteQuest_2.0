"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import type { ProgrammingLanguage } from "@/lib/types";

interface ComparedAttempt {
  attempt_number: number;
  submitted_code: string | null;
  passed_test_cases: number;
  total_test_cases: number;
  score_percentage: number;
  is_successful: boolean;
}

interface Comparison {
  language: ProgrammingLanguage;
  current: ComparedAttempt;
  previous: ComparedAttempt | null;
}

type PanelState =
  | { status: "loading" }
  | { status: "ready"; comparison: Comparison }
  | { status: "error"; message: string; retryable: boolean };

const scoreFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const desktopQuery = "(min-width: 768px)";

function subscribeToDesktop(onChange: () => void) {
  const query = window.matchMedia?.(desktopQuery);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia?.(desktopQuery).matches ?? false;
}

function AttemptSummary({ label, attempt }: { label: string; attempt: ComparedAttempt }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-bold">{label} attempt {attempt.attempt_number}</h3>
      <p className="mt-1 text-sm">{attempt.passed_test_cases} / {attempt.total_test_cases} tests passed</p>
      <p className="text-sm">{scoreFormat.format(attempt.score_percentage)}% · {attempt.is_successful ? "Passed" : "Did not pass"}</p>
    </div>
  );
}

function PlainCode({ label, attempt }: { label: string; attempt: ComparedAttempt }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <h4 id={id} className="mb-1 text-sm font-semibold">{label} submitted code · Attempt {attempt.attempt_number}</h4>
      {attempt.submitted_code == null ? <p className="text-sm">Submitted code is unavailable.</p> : (
        <pre tabIndex={0} aria-labelledby={id} className="max-h-72 max-w-full overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs focus-visible:outline-2">
          {attempt.submitted_code}
        </pre>
      )}
    </div>
  );
}

function CodeDiff({ current, previous, language }: { current: ComparedAttempt; previous: ComparedAttempt; language: ProgrammingLanguage }) {
  type Editor = typeof import("@monaco-editor/react").DiffEditor;
  const [editor, setEditor] = useState<{ Component: Editor } | "unavailable" | null>(null);
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop, () => false);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      active = false;
      setEditor("unavailable");
    }, 8000);
    async function loadEditor() {
      try {
        const { DiffEditor, loader } = await import("@monaco-editor/react");
        loader.config({ paths: { vs: "/monaco/vs" } });
        await loader.init();
        if (active) setEditor({ Component: DiffEditor });
      } catch {
        if (active) setEditor("unavailable");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void loadEditor();
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  if (editor === null) return <p role="status" className="text-sm">Loading code changes…</p>;
  if (editor === "unavailable") return <p role="status" className="text-sm">The code diff is unavailable. The plain-text code is available above.</p>;
  const { Component: DiffEditor } = editor;
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200" aria-label="Submitted code changes" role="region">
      <DiffEditor
        original={previous.submitted_code ?? ""}
        modified={current.submitted_code ?? ""}
        language={language}
        height="min(22rem, 60vh)"
        options={{
          readOnly: true,
          originalEditable: false,
          renderSideBySide: desktop,
          useInlineViewWhenSpaceIsLimited: false,
          originalAriaLabel: `Previous submitted code, attempt ${previous.attempt_number}`,
          modifiedAriaLabel: `Current submitted code, attempt ${current.attempt_number}`,
          renderOverviewRuler: false,
          minimap: { enabled: false },
          diffWordWrap: "on",
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

function ComparisonResult({ comparison }: { comparison: Comparison }) {
  const { current, previous, language } = comparison;
  const missingCode = current.submitted_code == null || previous?.submitted_code == null;
  const identical = !missingCode && current.submitted_code === previous?.submitted_code;
  const difference = previous ? Math.round((current.score_percentage - previous.score_percentage) * 100) / 100 : 0;

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {previous && <AttemptSummary label="Previous" attempt={previous} />}
        <AttemptSummary label="Current" attempt={current} />
      </div>
      {!previous ? <p role="status" className="text-sm">This is your first graded practice attempt for this challenge version.</p> : (
        <>
          <p role="status" className="text-sm">{difference === 0 ? "Same score as your previous attempt." :
            `Score ${difference > 0 ? "rose" : "fell"} by ${scoreFormat.format(Math.abs(difference))} percentage ${Math.abs(difference) === 1 ? "point" : "points"}.`}</p>
          {missingCode ? <p className="text-sm">A saved code version is missing, so code changes are unavailable.</p> : identical ? (
            <p className="text-sm">The submitted code is identical in both attempts.</p>
          ) : null}
        </>
      )}
      <details className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">View plain-text code</summary>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          {previous && <PlainCode label="Previous" attempt={previous} />}
          <PlainCode label="Current" attempt={current} />
        </div>
      </details>
      {previous && !missingCode && !identical && <CodeDiff current={current} previous={previous} language={language} />}
    </div>
  );
}

export function SubmissionComparisonPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<PanelState | null>(null);
  const request = useRef<AbortController | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();

  useEffect(() => () => request.current?.abort(), []);

  async function load() {
    request.current?.abort();
    const pending = new AbortController();
    request.current = pending;
    setState({ status: "loading" });
    try {
      const comparison = await apiRequest<Comparison>(`/submission-jobs/${jobId}/comparison`, { signal: pending.signal });
      if (!pending.signal.aborted) setState({ status: "ready", comparison });
    } catch (error) {
      if (!pending.signal.aborted) setState({ status: "error", message: getErrorMessage(error), retryable: !(error instanceof ApiError && error.status === 404) });
    }
  }

  return (
    <div className="mt-4 min-w-0">
      <button ref={toggle} type="button" className="button button-outline small" aria-expanded={state !== null} aria-controls={panelId}
        onClick={() => {
          if (state === null) void load();
          else {
            request.current?.abort();
            setState(null);
          }
        }}>{state === null ? "Compare with previous attempt" : "Hide attempt comparison"}</button>
      {state && (
        <section id={panelId} aria-labelledby={headingId} className="mt-3 min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <h2 id={headingId} className="text-base font-bold">Attempt comparison</h2>
          {state.status === "loading" && <p role="status" className="text-sm">Loading your attempts…</p>}
          {state.status === "error" && (
            <div className="space-y-2">
              <p role="alert" className="text-sm">{state.message}</p>
              {state.retryable && <button type="button" className="button button-outline small" onClick={() => {
                toggle.current?.focus();
                void load();
              }}>Retry comparison</button>}
            </div>
          )}
          {state.status === "ready" && <ComparisonResult comparison={state.comparison} />}
        </section>
      )}
    </div>
  );
}
