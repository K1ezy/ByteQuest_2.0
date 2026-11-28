"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useShellProfile } from "@/components/app-shell";
import { apiRequest, getErrorMessage } from "@/lib/api";
import type { Quest, QuizQuestion } from "@/lib/types";

// Display mirror of backend QUIZ_MASTERY_SCORE (app/services/gamification/sequencer.py); the server decides pass/fail.
const QUIZ_PASS_PERCENT = 75;

interface QuizResult {
  score_percentage: number;
  is_successful: boolean;
  xp_awarded: number;
  correct_answers: number;
  total_questions: number;
  attempt_number?: number;
  new_total_xp?: number;
  new_level?: number;
  level_up?: boolean;
  new_badges_unlocked?: string[];
  badge_xp_awarded?: number;
}

function getActivityHref(quest: Quest): string {
  return quest.activity_type === "quiz" ? `/quiz/${quest.id}` : `/arena/${quest.id}`;
}

export default function QuizView({ activityId }: { activityId: string }) {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [trackActivities, setTrackActivities] = useState<Quest[]>([]);
  const { role } = useShellProfile();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (role !== "student") {
          throw new Error("Concept check quizzes are available to student accounts.");
        }
        const activities = await apiRequest<Quest[]>(`/quests?details_for=${encodeURIComponent(activityId)}`);
        if (!active) return;
        setTrackActivities(activities);
        const target = activities.find(
          (item) => item.id === activityId && item.activity_type === "quiz"
        );
        if (!target) {
          throw new Error("This quiz isn’t shared in any of your workshops.");
        }
        setQuest(target);

        // Restore saved in-progress answers if available
        try {
          const savedAnswers = window.sessionStorage.getItem(`bytequest:quiz-answers:${target.id}`);
          if (savedAnswers) {
            setAnswers(JSON.parse(savedAnswers));
          }
        } catch {
          // ignore storage error
        }
      } catch (error) {
        if (active) {
          setIsError(true);
          setMessage(getErrorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [activityId, role]);

  function handleSelectOption(questionId: string, optionKey: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionKey };
      if (quest) {
        try {
          window.sessionStorage.setItem(`bytequest:quiz-answers:${quest.id}`, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
    setMessage("");
  }

  function handleNextQuestion() {
    if (!quest?.quiz_questions) return;
    if (currentQuestionIndex < quest.quiz_questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      promptHeadingRef.current?.focus();
    } else {
      setIsReviewing(true);
    }
  }

  function handlePrevQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      promptHeadingRef.current?.focus();
    }
  }

  function jumpToQuestion(index: number) {
    setCurrentQuestionIndex(index);
    setIsReviewing(false);
  }

  async function handleSubmitQuiz() {
    if (!quest) return;
    const questions = quest.quiz_questions ?? [];
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setIsError(true);
      setMessage(`Please answer all questions before submitting. ${unanswered.length} question(s) remaining.`);
      setIsReviewing(true);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await apiRequest<QuizResult & Record<string, unknown>>("/quests/submit-quiz", {
        method: "POST",
        body: JSON.stringify({
          activity_id: quest.id,
          answers,
        }),
      });
      setResult(response);
      setQuest((current) => current && { ...current, is_completed: current.is_completed || response.is_successful });
      try {
        window.sessionStorage.removeItem(`bytequest:quiz-answers:${quest.id}`);
      } catch {
        // ignore
      }
      setMessage(
        response.is_successful
          ? `Quiz complete! Score: ${response.score_percentage}% (${response.correct_answers}/${response.total_questions} correct). +${response.xp_awarded} XP awarded.`
          : `Score: ${response.score_percentage}% (${response.correct_answers}/${response.total_questions} correct). Review the concept and try again.`
      );
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetryQuiz() {
    setAnswers({});
    setResult(null);
    setCurrentQuestionIndex(0);
    setIsReviewing(false);
    setMessage("");
    setIsError(false);
    if (quest) {
      try {
        window.sessionStorage.removeItem(`bytequest:quiz-answers:${quest.id}`);
      } catch {
        // ignore
      }
    }
  }

  const questions: QuizQuestion[] = quest?.quiz_questions ?? [];
  const currentQuestion: QuizQuestion | undefined = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => Boolean(answers[q.id])).length;
  const unansweredCount = questions.length - answeredCount;
  const currentActivityIndex = trackActivities.findIndex((a) => a.id === activityId);
  const prevActivity = currentActivityIndex > 0 ? trackActivities[currentActivityIndex - 1] : null;
  const nextActivity =
    currentActivityIndex >= 0 && currentActivityIndex < trackActivities.length - 1
      ? trackActivities[currentActivityIndex + 1]
      : null;

  return (
    <div className="page-shell quiz-page">
      {/* Top Activity Navigation Bar */}
      <nav className="activity-topbar" aria-label="Activity navigation">
        <div className="activity-nav-group">
          {prevActivity ? (
            <Link href={getActivityHref(prevActivity)} className="button button-outline small">
              ← Previous activity
            </Link>
          ) : (
            <button type="button" className="button button-outline small" disabled>
              ← Previous activity
            </button>
          )}
          {nextActivity ? (
            <Link href={getActivityHref(nextActivity)} className="button button-outline small">
              Next activity →
            </Link>
          ) : (
            <button type="button" className="button button-outline small" disabled>
              Next activity →
            </button>
          )}
        </div>
      </nav>

      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <p className="eyebrow-label">{quest && `#${quest.position ?? quest.sequence_order} · `}Concept check quiz · {quest?.language.toUpperCase()}</p>
          <h1>{quest?.title || "Concept knowledge check"}</h1>
          <p>{quest ? `${quest.topic_concept} · ${quest.xp_reward} XP on first completion` : "Test your understanding of core concepts."}</p>
        </div>
        {quest && (
          <div className="quest-meta" style={{ margin: 0 }}>
            <span className="tag">{quest.topic_concept}</span>
            <span className="tag">Difficulty {quest.difficulty_level}</span>
            <span className="tag xp">✦ {quest.xp_reward} XP</span>
            {quest.is_completed && <span className="completion">✓ Completed</span>}
          </div>
        )}
      </div>

      {loading ? (
        <section className="panel" role="status">Loading concept quiz…</section>
      ) : message && !quest ? (
        <section className="panel">
          <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>
          <Link className="button button-primary" href="/onboarding">Sign in</Link>
        </section>
      ) : quest && questions.length === 0 ? (
        <section className="panel empty-state">
          <h2>No quiz questions available</h2>
          <p>This quiz does not have any questions published yet. Check back soon or return to the quest map.</p>
          <Link className="button button-primary" href="/quests">Back to quest map</Link>
        </section>
      ) : quest && (
        <div className="quiz-activity-container">
          {message && <p className={`notice ${isError ? "error" : ""}`} role="status">{message}</p>}

          {/* Result Summary View */}
          {result ? (
            <section className="panel quiz-step-card" aria-live="polite">
              <div className="quiz-step-header">
                <span className="eyebrow-label">QUIZ RESULTS</span>
                <span className={`tag ${result.is_successful ? "pass" : ""}`}>
                  {result.is_successful ? "PASSED" : "NEEDS PRACTICE"}
                </span>
              </div>
              <h2>{result.is_successful ? "Great work!" : "Keep practicing"}</h2>
              <p className="panel-subtitle">
                You scored <strong>{result.score_percentage}%</strong> ({result.correct_answers} of {result.total_questions} questions correct).
                {result.xp_awarded > 0
                  ? ` +${result.xp_awarded} XP awarded!`
                  : result.is_successful
                    ? " Completion XP was previously recorded."
                    : ` Score ${QUIZ_PASS_PERCENT}% or higher to complete this quest and earn its XP.`}
              </p>

              {result.level_up && result.new_level ? (
                <p className="reward-news is-level" role="status">Level up! You reached Level {result.new_level}.</p>
              ) : null}

              {result.new_badges_unlocked && result.new_badges_unlocked.length > 0 && (
                <div className="notice" role="status">
                  <strong>✦ New Badge Unlocked:</strong> {result.new_badges_unlocked.join(", ")}
                  {result.badge_xp_awarded ? ` (+${result.badge_xp_awarded} bonus XP)` : null}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="button button-primary" onClick={handleRetryQuiz}>
                  Retry quiz
                </button>
                {nextActivity && (
                  <Link href={getActivityHref(nextActivity)} className="button button-outline">
                    Next activity ({nextActivity.title || nextActivity.topic_concept}) →
                  </Link>
                )}
                <Link href="/quests" className="button button-quiet">
                  Return to quest map
                </Link>
              </div>
            </section>
          ) : isReviewing ? (
            /* Review Mode View */
            <section className="panel quiz-step-card" aria-labelledby="review-heading">
              <div className="quiz-step-header">
                <span className="eyebrow-label">REVIEW YOUR ANSWERS</span>
                <span className="quiz-step-progress-pill">
                  {answeredCount} of {questions.length} answered
                </span>
              </div>
              <h2 id="review-heading" style={{ margin: 0 }}>Review before submitting</h2>
              <p className="panel-subtitle" style={{ margin: 0 }}>
                Check your selected answers below. Click any question to change your choice.
              </p>

              {unansweredCount > 0 && (
                <div className="notice warning" role="alert">
                  <strong>⚠️ {unansweredCount} question{unansweredCount === 1 ? "" : "s"} unanswered:</strong> Every question must be answered before official submission.
                </div>
              )}

              <div className="quiz-review-list">
                {questions.map((q, idx) => {
                  const selectedKey = answers[q.id];
                  const selectedOption = q.options.find((opt) => opt.key === selectedKey);
                  const isAnswered = Boolean(selectedKey);

                  return (
                    <div key={q.id} className={`quiz-review-item ${isAnswered ? "" : "unanswered"}`}>
                      <div>
                        <div className="prompt-preview">
                          <strong>{idx + 1}.</strong> {q.prompt}
                        </div>
                        <div className="answer-preview">
                          {isAnswered ? (
                            <>Selected: <strong>{selectedKey}.</strong> {selectedOption?.text}</>
                          ) : (
                            <span>⚠️ Not answered yet</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="button button-quiet small"
                        onClick={() => jumpToQuestion(idx)}
                        aria-label={`Jump to question ${idx + 1}`}
                        data-tooltip={`Jump directly to question ${idx + 1}.`}
                      >
                        {isAnswered ? "Change" : "Answer"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="quiz-nav-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setIsReviewing(false)}
                >
                  ← Back to questions
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={submitting || unansweredCount > 0}
                  onClick={() => void handleSubmitQuiz()}
                >
                  {submitting ? "Submitting quiz…" : "Submit quiz for grading"}
                </button>
              </div>
            </section>
          ) : currentQuestion ? (
            /* Single Question Step View */
            <section className="panel quiz-step-card" aria-labelledby="question-prompt">
              <div className="quiz-step-header">
                <span className="quiz-step-counter">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <span className="quiz-step-progress-pill">
                  {answeredCount} of {questions.length} answered
                </span>
              </div>

              <h2 id="question-prompt" className="quiz-question-prompt" ref={promptHeadingRef} tabIndex={-1}>
                {currentQuestion.prompt}
              </h2>

              <div className="quiz-options-group" role="radiogroup" aria-labelledby="question-prompt">
                {currentQuestion.options.map((option) => {
                  const isChecked = answers[currentQuestion.id] === option.key;
                  return (
                    <label key={option.key} className="quiz-option-radio-label">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.key}
                        checked={isChecked}
                        onChange={() => handleSelectOption(currentQuestion.id, option.key)}
                      />
                      <span>
                        <strong>{option.key}.</strong> {option.text}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="quiz-nav-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={handlePrevQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  ← Previous question
                </button>
                <div className="quiz-nav-group">
                  <button
                    type="button"
                    className="button button-quiet small"
                    onClick={() => setIsReviewing(true)}
                  >
                    Review all ({answeredCount}/{questions.length})
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleNextQuestion}
                  >
                    {currentQuestionIndex < questions.length - 1 ? "Next question →" : "Review answers →"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
