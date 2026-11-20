"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { UserRole } from "@/lib/types";
import { useChat } from "./chat-provider";
import type { ActivityContext } from "./chat-session";

const languageNames: Record<string, string> = { python: "Python", cpp: "C++", java: "Java" };

function suggestedPrompts(role: UserRole | undefined, language: string | null | undefined, activity: ActivityContext | null) {
  if (role === "instructor" || role === "admin") return [
    ["Explain a concept", "How can I explain the difference between a variable and a value to beginners?"],
    ["Prepare an example", "Suggest a short classroom example that introduces loops gradually."],
  ];
  if (activity?.kind === "arena") return [
    ["Give me a hint", "Give me a first hint for this practice challenge."],
    ["Explain my sample run", "Help me understand my latest sample run and what to check next."],
  ];
  if (activity?.kind === "quiz") return [
    ["Explain the concept", "Explain the concept this practice activity covers using a different example."],
    ["Help me review", "What should I review to understand this topic better?"],
  ];
  const subject = language ? languageNames[language] : undefined;
  return [
    ["Explain loops", subject ? "Explain loops in " + subject + " with a simple example." : "Explain loops with a simple example."],
    ["Help me debug", "How do I start debugging a program that gives the wrong output?"],
    ["Review a lesson", "Help me review a programming concept from my course materials."],
  ];
}

const availabilityCopy = {
  checking: ["Checking availability…", ""],
  exam_in_progress: ["Chat is paused during your exam", "You can return after you submit or the answer window closes."],
  enrollment_required: ["Chat opens when you join a class", "Ask your instructor to add you to a class block."],
  disabled: ["Chat is turned off", "You can continue with your ByteQuest activities."],
  unavailable: ["Chat is temporarily unavailable", "You can keep working in ByteQuest and check again later."],
  connection_error: ["Couldn’t connect to Chat Assistant", "Check your connection and try again."],
  session: ["Sign in to continue", "Your ByteQuest session expired."],
} as const;

export function ChatConversation({ variant }: { variant: "compact" | "page" }) {
  const {
    messages, draft, setDraft, pending, error, activity, detachActivity, availability,
    role, language, limits, sendMessage, retryLast, editLast, clearConversation, refreshAvailability,
    scrollToLatest, setScrollToLatest,
    mode, conversation, historyEnabled, canBrowseHistory, loadingTranscript, canLoadEarlier, loadEarlier,
  } = useChat();
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const clearButton = useRef<HTMLButtonElement>(null);
  const cancelClear = useRef<HTMLButtonElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [elapsedRetryAt, setElapsedRetryAt] = useState<number | undefined>();
  const composerId = useId();
  const noticeId = useId();
  const ready = availability === "ready";
  const readOnlyHistory = canBrowseHistory && !!conversation && !ready;
  const showConversation = ready || availability === "offline" || readOnlyHistory;
  const waitingToRetry = Boolean(error?.retryAt && elapsedRetryAt !== error.retryAt);
  const maxChars = Math.min(limits.max_message_chars, limits.max_total_chars);

  useEffect(() => {
    const check = () => { void refreshAvailability(); };
    const onFocus = () => { void refreshAvailability(true); };
    check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, [refreshAvailability]);

  useEffect(() => {
    if (confirmClear && showConversation) cancelClear.current?.focus();
  }, [confirmClear, showConversation]);

  useEffect(() => {
    const retryAt = error?.retryAt;
    if (retryAt === undefined) return;
    const timer = window.setTimeout(() => setElapsedRetryAt(retryAt), Math.max(0, retryAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [error?.retryAt]);

  useEffect(() => {
    if (showConversation && scrollToLatest && transcript.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight;
    }
  }, [messages, pending, scrollToLatest, showConversation]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function onInputKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    sendMessage();
  }

  function closeConfirmation() {
    setConfirmClear(false);
    clearButton.current?.focus();
  }

  if (showConversation && loadingTranscript && !messages.length) {
    return <div className="chat-availability" role="status">Loading conversation…</div>;
  }

  if (!showConversation) {
    const [heading, description] = availabilityCopy[availability];
    const StatusHeading = variant === "page" ? "h2" : "h3";
    return (
      <div className="chat-availability">
        <div role="status">
          <StatusHeading>{heading}</StatusHeading>
          {description && <p>{description}</p>}
        </div>
        {availability === "session" ? (
          <Link href="/onboarding?redirect=%2Fchat" className="button button-primary">Sign in</Link>
        ) : availability !== "checking" && availability !== "disabled" && (
          <button type="button" className="button button-outline" onClick={() => void refreshAvailability()}>Check again</button>
        )}
      </div>
    );
  }

  return (
    <div className={`chat-conversation chat-conversation-${variant}`}>
      {variant === "page" && historyEnabled && <div className="chat-mode-label">
        {mode === "temporary" ? "Temporary Chat" : conversation?.title ?? "New chat"}
      </div>}
      {activity && (
        <div className="chat-activity">
          <span>{activity.kind === "arena" ? "Using this coding activity" : "Using this quiz topic"}</span>
          <button type="button" onClick={() => { detachActivity(); input.current?.focus(); }}>Ask generally</button>
        </div>
      )}
      <div ref={transcript} className="chat-transcript" role="log" aria-label="Chat conversation"
        aria-relevant="additions" tabIndex={messages.length ? 0 : undefined}
        onScroll={() => {
          const element = transcript.current;
          if (element) setScrollToLatest(element.scrollHeight - element.scrollTop - element.clientHeight < 80);
        }}>
        {canLoadEarlier && canBrowseHistory && <button type="button" className="chat-load-history" disabled={loadingTranscript || pending} onClick={loadEarlier}>Load earlier messages</button>}
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-title">{role === "student" ? "What are you working on?" : "What would you like to explain?"}</p>
            <p className="chat-empty-text">Ask for a clear explanation, a small example, or a practice hint.</p>
            <div className="chat-suggestions" aria-label="Suggested prompts">
              {suggestedPrompts(role, language, activity).map(([label, prompt]) => (
                <button key={label} type="button" onClick={() => { setDraft(prompt); input.current?.focus(); }}>{label}</button>
              ))}
            </div>
          </div>
        ) : messages.map((message) => (
          <article key={message.id} className={`chat-message chat-message-${message.role}`}>
            <span className="chat-message-role">{message.role === "user" ? "You" : "Chat Assistant"}</span>
            <div className="chat-bubble">{message.content}</div>
            {message.sources && message.sources.length > 0 && (
              <div className="chat-sources">
                <span>Course sources</span>
                <ul>{message.sources.map((source, index) => (
                  <li key={index}>{source.document_title}, p. {source.page_number}</li>
                ))}</ul>
              </div>
            )}
          </article>
        ))}
      </div>
      {pending && <p className="chat-thinking" role="status">Preparing a reply…</p>}
      {!scrollToLatest && messages.length > 0 && (
        <button type="button" className="chat-jump" onClick={() => {
          setScrollToLatest(true);
          transcript.current?.focus({ preventScroll: true });
        }}>Jump to latest</button>
      )}
      <div className="chat-dock">
        {!ready && <p className="chat-offline" role="status">{readOnlyHistory
          ? availabilityCopy[availability as keyof typeof availabilityCopy]?.[0]
          : "You’re offline. You can keep writing and send when you reconnect."}</p>}
        {error && (
          <div className={`chat-error chat-error-${error.kind}`}>
            <p role="alert">{error.message}</p>
            <div className="chat-error-actions">
              {error.retryable && (
                <button type="button" disabled={!ready || pending || loadingTranscript || waitingToRetry} onClick={retryLast}>
                  {waitingToRetry ? "Retry after the wait" : "Retry question"}
                </button>
              )}
              {messages.at(-1)?.role === "user" && !draft && (
                <button type="button" onClick={() => { editLast(); input.current?.focus(); }}>Edit question</button>
              )}
              {error.kind === "network" && mode === "saved" && !conversation && (
                <button type="button" onClick={() => void refreshAvailability()}>Reconnect</button>
              )}
            </div>
          </div>
        )}
        {confirmClear && (
          <div className="chat-clear-confirm" role="group" aria-label="Confirm clear conversation"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              closeConfirmation();
            }}>
            <p>Clear these messages and your draft?</p>
            <div className="chat-clear-actions">
              <button ref={cancelClear} type="button" onClick={closeConfirmation}>Cancel</button>
              <button type="button" className="chat-clear-danger" onClick={() => {
                clearConversation();
                setConfirmClear(false);
                input.current?.focus();
              }}>Clear conversation</button>
            </div>
          </div>
        )}
        <form className="chat-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor={composerId}>Your question</label>
          <textarea id={composerId} ref={input} className="chat-input" rows={2}
            maxLength={maxChars} value={draft}
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onInputKey}
            placeholder="Ask a question…" aria-describedby={noticeId} />
          <button type="submit" className="chat-send-btn"
            disabled={!ready || pending || loadingTranscript || waitingToRetry || !draft.trim()}>Send</button>
        </form>
        <div className="chat-footer-meta">
          <p className="chat-ai-notice" id={noticeId}>
            {historyEnabled && (mode === "temporary" ? "Temporary chat stays in this tab. " : "Regular chats save to your account. ")}
            Gemini receives recent messages and relevant course excerpts. Verify important details.
          </p>
          {(!historyEnabled || mode === "temporary") && (messages.length > 0 || draft) && (
            <button ref={clearButton} type="button" className="chat-clear-btn"
              aria-expanded={confirmClear} onClick={() => setConfirmClear(true)}>Clear chat</button>
          )}
        </div>
      </div>
    </div>
  );
}
