"use client";

import Link from "next/link";
import { SolveStars } from "@/components/solve-stars";
import { formatActivityDate } from "@/lib/activity-date";
import type { Quest } from "@/lib/types";

export function questHref(quest: Pick<Quest, "id" | "activity_type">) {
  return `/${quest.activity_type === "challenge" ? "arena" : "quiz"}/${quest.id}`;
}

function briefDescription(quest: Quest): string {
  if (quest.problem_statement) {
    const firstParagraph = quest.problem_statement.split(/\n\s*\n/)[0]?.trim() ?? "";
    const text = firstParagraph.replace(/[#*`_~]/g, "").replace(/\s+/g, " ").trim();
    return text.length > 150 ? `${text.slice(0, 147)}…` : text;
  }
  return quest.activity_type === "quiz"
    ? `Practice and test your understanding of ${quest.topic_concept} with focused concept questions.`
    : `Implement a solution for ${quest.topic_concept} and verify your code with automated test cases.`;
}

export function QuestCard({ quest, learner, next = false, selected = false, onSelect, onOpen, workshop = false, availability }: {
  quest: Quest;
  learner: boolean;
  next?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  workshop?: boolean;
  availability?: string;
}) {
  const Heading = workshop ? "h4" : "h2";
  const concept = quest.topic_concept;
  const topic = concept.includes(":") ? concept.split(":")[0].trim()
    : concept.length > 28 ? `${concept.slice(0, 26)}…` : concept;
  const challenge = quest.activity_type === "challenge";
  const label = challenge
    ? quest.is_completed ? "Practice again" : next ? "Start next challenge →" : "Start challenge →"
    : quest.is_completed ? "Review quiz" : next ? "Start next quiz →" : "Start quiz →";
  return <article className={`quest-card ${selected ? "is-selected-card" : ""}`}
    id={`quest-${quest.id}`} tabIndex={onSelect ? 0 : undefined} role={onSelect ? "region" : undefined}
    onClick={onSelect} onKeyDown={onOpen ? (event) => {
      if (event.key === "Enter" && event.target === event.currentTarget) {
        event.preventDefault();
        onOpen();
      }
    } : undefined}>
    <div className="quest-card-body">
      <div className="quest-card-head">
        <div className="quest-card-badges">
          {!workshop && <span className="activity-number">Quest #{quest.position ?? quest.sequence_order}</span>}
          <span className="tag">{challenge ? "CODE CHALLENGE" : "CONCEPT CHECK"}</span>
          {next && <span className="next-badge" aria-label="Next recommended quest">
            <span className="status-dot pulsing" aria-hidden="true" /> NEXT UP
          </span>}
          {quest.is_completed && <span className="completion">✓ Complete</span>}
          {quest.stars ? <SolveStars stars={quest.stars} /> : null}
        </div>
        <div className="quest-meta">
          <span className="tag" title={concept}>{topic}</span>
          <span className="tag">Difficulty {quest.difficulty_level}</span>
          <span className="tag xp">✦ {quest.xp_reward} XP</span>
        </div>
      </div>
      <Heading>{quest.title || concept}</Heading>
      {quest.added_at && <p className="activity-added-date">
        {quest.added_at_estimated ? "Added around " : "Added "}
        <time dateTime={quest.added_at}>{formatActivityDate(quest.added_at)}</time>
      </p>}
      <p className="quest-card-desc">{briefDescription(quest)}</p>
    </div>
    {(learner || availability || !workshop) && <div className="quest-card-actions">
      <span className="quest-instructions-hint">{availability ?? (challenge
        ? "Full instructions & test cases open in arena"
        : "Questions & explanations open in quiz")}</span>
      {learner && <Link className={`button ${next ? "button-primary" : "button-outline"}`}
        href={questHref(quest)} data-tooltip={quest.is_completed ? (challenge
          ? "Reopen the editor to practice this challenge again."
          : "Reopen the concept quiz to review what you learned.") : undefined}>
        {label}
      </Link>}
    </div>}
  </article>;
}
