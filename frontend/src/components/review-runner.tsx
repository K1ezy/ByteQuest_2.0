"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Notice, useApi } from "@/components/workspace/ui";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { RecallReview, ReviewResult } from "@/lib/types";

export function ReviewRunner({ id }: { id: string }) {
  const { data: review, error, loading, reload } = useApi<RecallReview>(`/reviews/${id}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const prompt = useRef<HTMLLegendElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const question = review?.questions[index];
  const graded = result ?? review?.result;

  useEffect(() => { prompt.current?.focus(); }, [question?.id]);
  useEffect(() => { if (graded) resultHeading.current?.focus(); }, [graded]);

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      setResult(await apiRequest<ReviewResult>(`/reviews/${id}/submit`, {
        method: "POST", body: JSON.stringify({ answers }),
      }));
    } catch (cause) {
      setSubmitError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell review-page">
      <nav className="activity-topbar" aria-label="Review navigation">
        <Link href="/profile?tab=mastery" className="button button-quiet small">← Back to Mastery</Link>
      </nav>
      <div className="page-heading">
        <div><p className="eyebrow-label">Recall quest</p><h1>{review?.concept ?? "Memory check"}</h1></div>
      </div>
      {loading ? <div className="ws-skeleton gamification-skeleton" role="status" aria-label="Loading recall quest" /> : null}
      {error ? (
        <section className="panel"><Notice tone="error">{error}</Notice><Button onClick={reload}>Try again</Button></section>
      ) : null}
      {!loading && !error && review ? (
        <div className="quiz-activity-container">
          {graded ? (
            <section className="panel quiz-step-card" aria-labelledby="review-result">
              <h2 id="review-result" ref={resultHeading} tabIndex={-1}>
                {graded.passed ? `Memory refreshed: ${review.concept}.` : "Keep building your recall"}
              </h2>
              <p>
                {graded.passed
                  ? `Next check in ${graded.next_check_days} ${graded.next_check_days === 1 ? "day" : "days"}.`
                  : "No problem, this concept will come back tomorrow so you can lock it in."}
              </p>
              <p>{graded.correct} of {graded.total} correct{graded.xp_awarded > 0 ? ` · +${graded.xp_awarded} XP` : ""}</p>
              {graded.level_up ? <p className="reward-news is-level">Level up! You reached Level {graded.new_level}.</p> : null}
              {graded.new_badges_unlocked.length ? <p className="reward-news is-badge">Badge unlocked: <strong>{graded.new_badges_unlocked.join(", ")}</strong>{graded.badge_xp_awarded ? ` (+${graded.badge_xp_awarded} bonus XP)` : null}</p> : null}
              <Link href="/profile?tab=mastery" className="button button-primary">Return to Mastery</Link>
            </section>
          ) : question ? (
            <form className="panel quiz-step-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <div className="quiz-step-header">
                <span className="quiz-step-counter" role="status">Question {index + 1} of {review.questions.length}</span>
                <span className="quiz-step-progress-pill">{Object.keys(answers).length} answered</span>
              </div>
              <fieldset className="review-questions" disabled={submitting}>
                <legend id="review-prompt" className="quiz-question-prompt" tabIndex={-1} ref={prompt}>{question.prompt}</legend>
                <div className="quiz-options-group" role="radiogroup" aria-labelledby="review-prompt">
                  {question.options.map((option) => (
                    <label key={option.key} className="quiz-option-radio-label">
                      <input type="radio" name={question.id} value={option.key} checked={answers[question.id] === option.key}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.key }))} />
                      <span><strong>{option.key}.</strong> {option.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {submitError ? <Notice tone="error">{submitError}</Notice> : null}
              <div className="quiz-nav-actions">
                <Button disabled={index === 0 || submitting} onClick={() => setIndex(index - 1)}>Previous question</Button>
                {index + 1 < review.questions.length
                  ? <Button variant="primary" disabled={!answers[question.id]} onClick={() => setIndex(index + 1)}>Next question</Button>
                  : <Button type="submit" variant="primary" disabled={submitting || Object.keys(answers).length !== review.questions.length}>
                    {submitting ? "Submitting…" : "Submit review"}
                  </Button>}
              </div>
            </form>
          ) : <section className="panel empty-state"><h2>No recall questions are available</h2></section>}
        </div>
      ) : null}
    </div>
  );
}
