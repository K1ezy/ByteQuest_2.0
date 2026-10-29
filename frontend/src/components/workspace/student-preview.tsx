"use client";

import { formatDateTime, type StudentPreview } from "@/lib/workspace";

/** The exact student-visible shape: no answer key, no hidden inputs or outputs. */
export function StudentPreviewCard({
  preview,
  schedule,
  compact = false,
}: {
  preview: StudentPreview;
  schedule?: { opens_at: string | null; closes_at: string | null; state: string; timezone?: string };
  compact?: boolean;
}) {
  const type = preview.activity_type === "quiz" ? "Concept check" : "Code challenge";
  return (
    <article className={`ws-student-preview${compact ? " is-compact" : ""}`} aria-label="Student-visible preview">
      <header className="ws-preview-head">
        <span className="ws-preview-tag">STUDENT VIEW</span>
        <span className="ws-preview-state">{preview.state}</span>
      </header>
      <h3>{preview.title || preview.topic_concept}</h3>
      <p className="ws-preview-meta">
        {type} · {preview.topic_concept} · Difficulty {preview.difficulty_level} · {preview.xp_reward} XP
      </p>
      {schedule ? (
        <p className="ws-preview-schedule">
          {schedule.opens_at ? `Opens ${formatDateTime(schedule.opens_at)}` : "Opens immediately when published"}
          {schedule.closes_at ? ` · closes ${formatDateTime(schedule.closes_at)}` : " · no closing time"}
          {` (${schedule.timezone || "Asia/Manila"})`}
        </p>
      ) : null}
      {preview.problem_statement ? (
        <div className="ws-preview-body">
          {preview.problem_statement.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      {preview.activity_type === "challenge" ? (
        <>
          {preview.starter_code ? (
            <div className="ws-preview-section">
              <h4>Starter code</h4>
              <pre className="ws-code">{preview.starter_code}</pre>
            </div>
          ) : null}
          <div className="ws-preview-section">
            <h4>Sample cases</h4>
            {preview.sample_cases && preview.sample_cases.length > 0 ? (
              <div className="ws-sample-grid">
                {preview.sample_cases.map((sample) => (
                  <div className="ws-sample" key={sample.order_index}>
                    <span>Input</span>
                    <pre>{sample.stdin || "(no input)"}</pre>
                    <span>Expected output</span>
                    <pre>{sample.expected_stdout}</pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ws-muted">No sample cases are visible to students.</p>
            )}
            {preview.hidden_case_count ? (
              <p className="ws-muted">
                {preview.hidden_case_count} hidden grading {preview.hidden_case_count === 1 ? "case" : "cases"} — not shown
                to students.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="ws-preview-section">
          <h4>Questions</h4>
          {(preview.questions || []).length === 0 ? (
            <p className="ws-muted">No questions yet.</p>
          ) : (
            <ol className="ws-preview-questions">
              {(preview.questions || []).map((question) => (
                <li key={question.id}>
                  <p>{question.prompt}</p>
                  <ul>
                    {question.options.map((option) => (
                      <li key={option.key}>
                        <span className="ws-option-key">{option.key}</span>
                        {option.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          <p className="ws-muted">Correct answers are withheld from the student view.</p>
        </div>
      )}
    </article>
  );
}
