"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SolveStars } from "@/components/solve-stars";
import { formatActivityDate, formatManilaDateTime } from "@/lib/activity-date";
import type { Quest, Workshop } from "@/lib/types";

export type QuestWorkshopSource = Pick<Workshop, "id" | "name"> & { sharedAt: string };

export function questHref(quest: Pick<Quest, "id" | "activity_type">) {
  return `/${quest.activity_type === "challenge" ? "arena" : "quiz"}/${quest.id}`;
}

/** The "#" number a learner sees on the card; search matches this same value. */
export function questNumber(quest: Pick<Quest, "position" | "sequence_order">) {
  return quest.position ?? quest.sequence_order;
}

function briefDescription(quest: Quest): string {
  if (quest.problem_statement) {
    const firstParagraph = quest.problem_statement.split(/\n\s*\n/)[0]?.trim() ?? "";
    const text = firstParagraph.replace(/[#*`_~]/g, "").replace(/\s+/g, " ").trim();
    return text.length > 150 ? `${text.slice(0, 147)}…` : text;
  }
  const questionCount = quest.quiz_questions?.length;
  if (questionCount) return `${questionCount} concept ${questionCount === 1 ? "question" : "questions"} on ${quest.topic_concept}.`;
  return quest.activity_type === "quiz"
    ? `Practice and test your understanding of ${quest.topic_concept} with focused concept questions.`
    : `Implement a solution for ${quest.topic_concept} and verify your code with automated test cases.`;
}

export function QuestCard({ quest, learner, next = false, selected = false, onSelect, onOpen, workshop = false, availability, preview, sourceWorkshops }: {
  quest: Quest;
  learner: boolean;
  next?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  workshop?: boolean;
  availability?: string;
  preview?: ReactNode;
  sourceWorkshops?: QuestWorkshopSource[];
}) {
  const Heading = workshop ? "h4" : "h2";
  const concept = quest.topic_concept;
  const topic = concept.includes(":") ? concept.split(":")[0].trim()
    : concept.length > 28 ? `${concept.slice(0, 26)}…` : concept;
  const challenge = quest.activity_type === "challenge";
  const completedAt = quest.completed_at ? Date.parse(quest.completed_at) : NaN;
  const completedBeforeSharing = workshop ? completedAt < Date.parse(quest.added_at)
    : !!sourceWorkshops?.length && sourceWorkshops.every(({ sharedAt }) => completedAt < Date.parse(sharedAt));
  const label = challenge
    ? quest.is_completed ? "Practice again" : next ? "Start next challenge →" : "Start challenge →"
    : quest.is_completed ? "Review quiz" : next ? "Start next quiz →" : "Start quiz →";
  return <article className={`quest-card ${selected ? "is-selected-card" : ""}`}
    id={`quest-${quest.id}`} tabIndex={onSelect ? 0 : workshop ? -1 : undefined} role={onSelect ? "region" : undefined}
    aria-labelledby={`quest-title-${quest.id}`}
    onClick={onSelect ? (event) => {
      if (!(event.target as Element).closest("a, button, .activity-performance-preview")) onSelect();
    } : undefined} onKeyDown={onSelect ? (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
        event.preventDefault();
        if (selected && event.key === "Enter" && onOpen) onOpen();
        else onSelect();
      }
    } : undefined}>
    <div className="quest-card-body">
      <div className="quest-card-head">
        <div className="quest-card-badges">
          {!workshop && <span className="activity-number">#{questNumber(quest)}</span>}
          <span className="tag">{challenge ? "CODE CHALLENGE" : "Concept check quiz"}</span>
          {next && <span className="next-badge" aria-label="Next recommended quest">
            <span className="status-dot pulsing" aria-hidden="true" /> NEXT UP
          </span>}
          {quest.is_completed && <span className="completion">{completedBeforeSharing ? "✓ Completed before sharing" : "✓ Complete"}</span>}
          {quest.stars ? <SolveStars stars={quest.stars} /> : null}
        </div>
        <div className="quest-meta">
          <span className="tag" title={concept}>{topic}</span>
          <span className="tag">Difficulty {quest.difficulty_level}</span>
          <span className="tag xp">✦ {quest.xp_reward} XP</span>
        </div>
      </div>
      {sourceWorkshops && <div className="quest-workshop-sources">
        {sourceWorkshops.length ? <>
          <span>From</span>
          <ul>
            {sourceWorkshops.map(({ id, name }) => <li key={id}>
              <Link href={`/workshops/${id}/activities#quest-${quest.id}`}>{name}</Link>
            </li>)}
          </ul>
        </> : <span>Track practice</span>}
      </div>}
      <Heading id={`quest-title-${quest.id}`}>{quest.title || concept}</Heading>
      {quest.added_at && <p className="activity-added-date">
        {quest.added_at_estimated ? "Added around " : "Added "}
        <time dateTime={quest.added_at}>{formatActivityDate(quest.added_at)}</time>
      </p>}
      <p className="quest-card-desc">{briefDescription(quest)}</p>
      {quest.closes_at && <p className="activity-added-date">
        {quest.is_closed ? "Closed " : "Due "}
        <time dateTime={quest.closes_at}>{formatManilaDateTime(quest.closes_at)}</time>
      </p>}
    </div>
    {(learner || availability || !workshop) && <div className="quest-card-actions">
      <span className="quest-instructions-hint">{availability ?? (challenge
        ? "Full instructions & test cases open in arena"
        : "Questions & explanations open in quiz")}</span>
      {learner && onSelect && <button type="button" className="text-button" id={`preview-trigger-${quest.id}`}
        aria-label={`Performance preview for ${quest.title || concept}`}
        aria-expanded={selected} aria-controls={selected ? `activity-preview-${quest.id}` : undefined}
        onClick={onSelect}>Preview</button>}
      {learner && <Link className={`button ${next ? "button-primary" : "button-outline"}`}
        href={questHref(quest)} data-tooltip={quest.is_completed ? (challenge
          ? "Reopen the editor to practice this challenge again."
          : "Reopen the concept quiz to review what you learned.") : undefined}>
        {label}
      </Link>}
    </div>}
    {preview}
  </article>;
}
