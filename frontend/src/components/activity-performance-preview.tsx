"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { useApi } from "@/components/workspace/ui";
import { formatManilaDateTime } from "@/lib/activity-date";

type ActivityKind = "challenge" | "quiz" | "exam";

interface ActivityHistory {
  scope: "workshop" | "course";
  total: number;
  pass_marked: number;
  passed: number;
  average_percent: number | null;
  pass_mark_percent: number | null;
}

/** Card facts shown under the title; every field is optional. */
export interface ActivityPreviewDetails {
  number?: number;
  topic?: string;
  difficulty?: number;
  xp?: number;
  closesAt?: string | null;
  isClosed?: boolean;
}

const preparation = {
  challenge: ["Read the full instructions in the arena.", "Run the sample cases before you submit.", "Open a hint or ask the tutor if you get stuck."],
  quiz: ["Review the topic first.", "Try explaining its main idea in your own words.", "Read each explanation after you answer."],
  exam: ["Review the topics your instructor assigned.", "Plan your time: the timer starts when you begin.", "The chat assistant pauses during timed exams."],
};

const kindLabels = { challenge: "Coding challenge", quiz: "Concept check quiz", exam: "Exam" };
const kindNouns = { challenge: "code challenges", quiz: "concept check quizzes", exam: "exams" };

/** Describes the learner's past first-try results in plain words; it is not a forecast. */
function readout(kind: ActivityKind, passed: number, total: number) {
  if (total < 3) return `Based on ${total} earlier ${total === 1 ? "result" : "results"} only, so the pattern is still forming.`;
  const rate = passed / total;
  if (rate >= 0.75) return "You usually pass these on your first try.";
  if (rate >= 0.4) return kind === "quiz"
    ? "Mixed so far. Reviewing the topic first tends to help."
    : "Mixed so far. Running the sample cases first tends to help.";
  return kind === "quiz"
    ? "These have often needed another try. Review the topic before you start."
    : "These have often needed another try. Open a hint early if you get stuck.";
}

function ScoreRing({ percent, label }: { percent: number; label: string }) {
  return <div className="activity-preview-ring" style={{ "--ring": `${percent}%` } as CSSProperties}
    role="img" aria-label={label}>
    <span aria-hidden="true">{Math.round(percent)}%</span>
  </div>;
}

function PassBreakdown({ passed, total, failLabel }: { passed: number; total: number; failLabel: string }) {
  return <div className="activity-preview-breakdown">
    <div className="activity-preview-bar" aria-hidden="true">
      <span style={{ width: `${passed / total * 100}%` }} />
    </div>
    <dl>
      <div><dt><i className="is-pass" aria-hidden="true" />Passed</dt><dd>{passed}</dd></div>
      <div><dt><i className="is-fail" aria-hidden="true" />{failLabel}</dt><dd>{total - passed}</dd></div>
    </dl>
  </div>;
}

export function ActivityPerformancePreview({ kind, activityId, title, onClose, details }: {
  kind: ActivityKind;
  activityId: string;
  title: string;
  onClose: () => void;
  details?: ActivityPreviewDetails;
}) {
  const sectionId = `activity-preview-${activityId}`;
  const panelRef = useRef<HTMLElement>(null);
  const path = kind === "exam" ? "/exams" : "/quests";
  const { data, loading, error, reload } = useApi<ActivityHistory>(`${path}/${activityId}/performance-preview`, true);

  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    document.getElementById(`preview-trigger-${activityId}`)?.focus({ preventScroll: true });
  }, [activityId, onClose]);

  useEffect(() => {
    const card = panelRef.current?.parentElement;
    if (!card) return;
    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !card?.contains(event.target)) onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeAndRestoreFocus();
    }
    document.addEventListener("click", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [closeAndRestoreFocus, onClose]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const card = panel?.parentElement;
    const list = card?.closest<HTMLElement>(".activity-preview-list");
    if (!panel || !card || !list) return;
    const topbar = document.querySelector(".bq-app-topbar");
    let frame = 0;

    function place() {
      if (!panel || !card || !list) return;
      const lane = list.getBoundingClientRect();
      const edge = 16;
      const gap = 20;
      const rightEdge = document.documentElement.clientWidth - edge;
      const marginSpace = rightEdge - lane.right - gap;
      const width = Math.min(480, Math.floor(marginSpace >= 320 ? marginSpace : Math.max(320, lane.width * 0.42)));
      const reserve = Math.max(0, width - marginSpace);
      if (lane.width - reserve < 340 || window.innerHeight < 400) {
        panel.dataset.placement = "inline";
        list.removeAttribute("data-preview-reserved");
        return;
      }
      list.style.setProperty("--preview-width", `${width}px`);
      list.style.setProperty("--preview-reserve", `${reserve}px`);
      list.toggleAttribute("data-preview-reserved", reserve > 0);
      panel.dataset.placement = "side";
      const topEdge = Math.max(edge, topbar?.getBoundingClientRect().bottom ?? edge) + 8;
      panel.style.setProperty("--preview-room", `${window.innerHeight - topEdge - edge}px`);
      const anchor = card.getBoundingClientRect();
      const top = Math.max(topEdge, Math.min(anchor.top, window.innerHeight - panel.offsetHeight - edge));
      const left = Math.min(lane.right + gap, rightEdge - width);
      panel.style.setProperty("--preview-left", `${left - anchor.left - card.clientLeft}px`);
      panel.style.setProperty("--preview-top", `${top - anchor.top - card.clientTop}px`);
    }

    function schedule(event?: Event) {
      if (event?.target === panel) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    }

    place();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedule()) : null;
    observer?.observe(list);
    observer?.observe(card);
    if (panel.firstElementChild) observer?.observe(panel.firstElementChild);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      list.removeAttribute("data-preview-reserved");
      list.style.removeProperty("--preview-width");
      list.style.removeProperty("--preview-reserve");
    };
  }, []);

  const isExam = kind === "exam";
  const scoredWithoutMark = isExam && data ? data.total - data.pass_marked : 0;
  const scopeLabel = data?.scope === "course" ? "this course" : "this workshop";

  return <section ref={panelRef} id={sectionId} className="activity-performance-preview"
    aria-label={`Performance preview for ${title}`}>
    <div className="activity-preview-content">
      <header className="activity-preview-heading">
        <div>
          <p className="activity-preview-kind">
            {details?.number != null && <span className="activity-preview-number">#{details.number}</span>}
            {kindLabels[kind]}
          </p>
          <h3>{title}</h3>
        </div>
        <button type="button" className="text-button activity-preview-control"
          onClick={closeAndRestoreFocus} aria-label="Close performance preview">Close</button>
      </header>
      {details && <ul className="activity-preview-facts" aria-label="Activity details">
        {details.topic && <li>{details.topic}</li>}
        {details.difficulty != null && <li>Difficulty {details.difficulty} of 5</li>}
        {details.xp != null && <li className="is-xp">{details.xp} XP</li>}
        {details.closesAt && <li className={details.isClosed ? "is-closed" : "is-due"}>
          {details.isClosed ? "Closed " : "Due "}
          <time dateTime={details.closesAt}>{formatManilaDateTime(details.closesAt)}</time>
        </li>}
      </ul>}
      <div className="activity-preview-body">
        {loading && <p role="status">Loading past results…</p>}
        {error && !loading && <div className="activity-preview-error">
          <p role="alert">Past results couldn’t load.</p>
          <button type="button" className="text-button activity-preview-control" onClick={reload}>Retry</button>
        </div>}
        {data && !loading && !error && <div role="status" className="activity-preview-results">
          <p className="activity-preview-scope">Your record in {scopeLabel}</p>
          {data.total === 0 ? <div className="activity-preview-empty">
            <p>No comparable results yet.</p>
            <p>This is your first of these {kindNouns[kind]} here, so there’s no pattern to show.</p>
          </div> : isExam ? <>
            {data.average_percent != null && <div className="activity-preview-summary">
              <ScoreRing percent={data.average_percent} label={`Average score ${data.average_percent}%`} />
              <p className="activity-preview-metric">
                <span>Your average across {data.total} released {data.total === 1 ? "exam" : "exams"}</span>
              </p>
            </div>}
            {data.pass_marked > 0 && <>
              <p>You passed <strong>{data.passed} of {data.pass_marked}</strong> released {data.pass_marked === 1 ? "exam" : "exams"} with a pass mark.</p>
              <PassBreakdown passed={data.passed} total={data.pass_marked} failLabel="Did not pass" />
            </>}
            {scoredWithoutMark > 0 && <p className="activity-preview-note">
              {scoredWithoutMark} released {scoredWithoutMark === 1 ? "exam has" : "exams have"} a score only.
            </p>}
          </> : <>
            <div className="activity-preview-summary">
              <ScoreRing percent={data.passed / data.total * 100}
                label={`${Math.round(data.passed / data.total * 100)}% passed on the first try`} />
              <p className="activity-preview-metric">
                <strong>{data.passed} of {data.total}</strong>
                <span>Passed on the first try</span>
              </p>
            </div>
            <PassBreakdown passed={data.passed} total={data.total} failLabel="Needed another try" />
            <p className="activity-preview-readout">{readout(kind, data.passed, data.total)}</p>
          </>}
          {isExam && data.pass_mark_percent != null && <p className="activity-preview-mark">
            This exam’s pass mark is <strong>{data.pass_mark_percent}%</strong>.
          </p>}
        </div>}
      </div>
      <footer className="activity-preview-tip">
        <strong>Before you start</strong>
        <ul>{preparation[kind].map((step) => <li key={step}>{step}</li>)}</ul>
      </footer>
    </div>
  </section>;
}
