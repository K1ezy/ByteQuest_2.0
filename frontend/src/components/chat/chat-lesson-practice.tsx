"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, useApi } from "@/components/workspace/ui";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import type { WorkshopLesson } from "@/lib/types";
import { ChatMessageBubble } from "./chat-message-content";
import { useChat } from "./chat-provider";
import { contextMessages, type ChatMessage, type ChatReply } from "./chat-session";

const prompts = {
  quiz: "Generate a practice quiz from this lesson.",
  challenge: "Generate a coding challenge from this lesson.",
};
type PracticeKind = keyof typeof prompts;

export function ChatLessonPractice({ workshopId, lessonId }: { workshopId: string; lessonId: string }) {
  const { limits, availability, role } = useChat();
  const lessonPath = `/workshops/${workshopId}/materials/${lessonId}`;
  const lesson = useApi<WorkshopLesson>(lessonPath, true);
  const [kind, setKind] = useState<PracticeKind | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lostAccess, setLostAccess] = useState(false);
  const request = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const quizButton = useRef<HTMLButtonElement>(null);
  const examined = availability === "exam_in_progress";

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const log = transcript.current;
    const latest = log?.lastElementChild;
    if (!log || !latest) return;
    log.scrollTop = messages.length === 2
      ? log.scrollTop + latest.getBoundingClientRect().top - log.getBoundingClientRect().top
      : log.scrollHeight;
  }, [messages]);

  async function send(nextKind: PracticeKind, question: string) {
    const text = question.trim();
    if (!text || request.current || examined || lesson.data?.practice_status !== "ready") return;
    const next: ChatMessage[] = [...messages, { id: String(messages.length), role: "user", content: text }];
    const history = contextMessages(next, limits);
    if (!history.length) {
      setError("Shorten your reply and try again.");
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<ChatReply>("/chat/messages", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
          practice: { workshop_id: workshopId, document_id: lessonId, kind: nextKind },
        }),
      });
      if (controller.signal.aborted) return;
      setKind(nextKind);
      setMessages([...next, {
        id: String(next.length), role: "assistant", content: result.reply,
        sources: result.sources, consulted_sources: result.consulted_sources,
      }]);
      setDraft("");
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof ApiError && caught.status === 404) {
        setLostAccess(true);
        setMessages([]);
        setDraft("");
      }
      setError(getErrorMessage(caught));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind) void send(kind, draft);
  }

  if (role && role !== "student") return <div className="chat-availability"><p>Lesson practice is available to students.</p></div>;
  if (lesson.loading) return <div className="chat-availability" role="status">Loading workshop lesson…</div>;
  if (lesson.error || lostAccess) return <div className="chat-availability">
    <p role="alert">{lostAccess ? error : lesson.error}</p>
    {!lostAccess && <Button variant="outline" type="button" onClick={lesson.reload}>Reload lesson</Button>}
  </div>;
  if (lesson.data?.practice_status !== "ready") return <div className="chat-availability">
    <p>{lesson.data?.practice_status === "indexing" ? "This lesson is still being prepared for Chat Assistant." : "Chat practice is unavailable for this PDF."}</p>
    <Button type="button" variant="outline" onClick={lesson.reload}>Reload lesson</Button>
  </div>;

  return <div className="chat-conversation chat-lesson-practice">
    <div className="chat-transcript" ref={transcript} tabIndex={0} aria-label="Lesson practice conversation" role="log">
      <div className="chat-practice-intro">
        <h2>{lesson.data.title}</h2>
        <p>Practice on your own. This chat stays on this page and does not count toward grades.</p>
        {!kind && <div className="chat-suggestions" aria-label="Choose a practice exercise">
          <button ref={quizButton} type="button" disabled={pending || examined} onClick={() => void send("quiz", prompts.quiz)}>Generate quiz</button>
          <button type="button" disabled={pending || examined} onClick={() => void send("challenge", prompts.challenge)}>Generate coding challenge</button>
        </div>}
      </div>
      {messages.map((message) => <ChatMessageBubble key={message.id} message={message} sourceLabel="Lesson sources" />)}
    </div>
    <div className="chat-dock">
      {examined && <p role="status">Study help is paused during your exam.</p>}
      {pending && <p role="status">Preparing your {kind ? "reply" : "practice exercise"}…</p>}
      {error && <p role="alert">{error}</p>}
      {kind && <form className="chat-composer chat-practice-form" onSubmit={submit}>
        <label htmlFor="lesson-practice-reply">{kind === "quiz" ? "Your answers" : "Your code or question"}</label>
        <textarea className="chat-input" id="lesson-practice-reply" rows={2} maxLength={limits.max_message_chars}
          value={draft} onChange={(event) => setDraft(event.target.value)} disabled={pending || examined} />
        <div className="chat-suggestions">
          <Button variant="primary" type="submit" disabled={pending || examined || !draft.trim()}>Send</Button>
          <Button variant="quiet" type="button" disabled={pending} onClick={() => {
            setKind(null);
            setMessages([]);
            setDraft("");
            setError("");
            window.requestAnimationFrame(() => quizButton.current?.focus());
          }}>New practice</Button>
        </div>
      </form>}
    </div>
  </div>;
}
