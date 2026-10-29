"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  CHAT_MAX_MESSAGE_CHARS,
  MAX_CONTEXT_MESSAGES,
  useChat,
} from "@/components/chat/chat-provider";

interface ChatConversationProps {
  variant: "compact" | "page";
}

export function ChatConversation({ variant }: ChatConversationProps) {
  const {
    messages,
    draft,
    setDraft,
    pending,
    error,
    sendMessage,
    retryLast,
    clearConversation,
    clearError,
    scrollToLatest: autoScroll,
    setScrollToLatest: setAutoScroll,
  } = useChat();

  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const confirmClearRef = useRef<HTMLButtonElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const inputId = `chat-input-${variant}`;
  const noticeId = `chat-notice-${variant}`;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirmClear) confirmClearRef.current?.focus();
  }, [confirmClear]);

  useEffect(() => {
    if (!autoScroll) return;
    const element = transcriptRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [autoScroll, messages.length, pending]);

  function handleScroll() {
    const element = transcriptRef.current;
    if (!element) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setAutoScroll(nearBottom);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage();
    }
  }

  function chooseSuggestion(text: string) {
    setDraft(text);
    inputRef.current?.focus();
  }

  return (
    <div className={`chat-conversation chat-conversation-${variant}`}>
      <div
        ref={transcriptRef}
        className="chat-transcript"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat conversation"
        onScroll={handleScroll}
      >
        {messages.length === 0 && !pending ? (
          <div className="chat-empty">
            <span className="chat-empty-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 0 1 11 5h2a8 8 0 0 1 8 6.5Z" />
                <path d="M8 11h.01M12 11h.01M16 11h.01" />
              </svg>
            </span>
            <p className="chat-empty-title">Ask about a concept or request a hint</p>
            <p className="chat-empty-text">
              I can explain lesson ideas, break down programming concepts, and guide
              you toward an answer without giving away a full solution.
            </p>
            <div className="chat-suggestions" aria-label="Suggested prompts">
              <button
                type="button"
                onClick={() =>
                  chooseSuggestion("Explain Python loops with a simple example.")
                }
              >
                Explain loops
              </button>
              <button
                type="button"
                onClick={() =>
                  chooseSuggestion(
                    "Give me a hint for a challenge without writing the solution.",
                  )
                }
              >
                Give me a hint
              </button>
              <button
                type="button"
                onClick={() =>
                  chooseSuggestion("What should I study next in Python fundamentals?")
                }
              >
                What next?
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`chat-message chat-message-${message.role}`}
              >
                <span className="chat-message-role">
                  {message.role === "user" ? "You" : "ByteQuest Assistant"}
                </span>
                <div className="chat-bubble">{message.content}</div>
              </article>
            ))}
            {pending && (
              <div className="chat-thinking" role="status">
                <span className="chat-thinking-dot" aria-hidden="true" />
                Thinking…
              </div>
            )}
          </>
        )}
      </div>

      <div className="chat-dock">
        {error && (
          <div className={`chat-error chat-error-${error.kind}`} role="alert">
            <p>{error.message}</p>
            <div className="chat-error-actions">
              {error.kind === "session" && (
                <Link href="/onboarding" className="chat-error-link">
                  Sign in
                </Link>
              )}
              {error.retryable && (
                <button type="button" onClick={retryLast}>
                  Retry
                </button>
              )}
              <button type="button" onClick={clearError}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {confirmClear && (
          <div
            className="chat-clear-confirm"
            role="group"
            aria-label="Confirm clear conversation"
          >
            <p>Clear this conversation? This cannot be undone.</p>
            <div className="chat-clear-actions">
              <button
                ref={confirmClearRef}
                type="button"
                className="chat-clear-danger"
                onClick={() => {
                  clearConversation();
                  setConfirmClear(false);
                  inputRef.current?.focus();
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClear(false);
                  inputRef.current?.focus();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <form className="chat-composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor={inputId}>
            Message the learning assistant
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            className="chat-input"
            rows={2}
            maxLength={CHAT_MAX_MESSAGE_CHARS}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a concept or request a hint…"
            aria-describedby={noticeId}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={pending || !draft.trim()}
          >
            Send
          </button>
        </form>

        <div className="chat-footer-meta">
          <p className="chat-ai-notice" id={noticeId}>
            AI can make mistakes. Verify important details.
          </p>
          {messages.length > 0 && (
            <button
              type="button"
              className="chat-clear-btn"
              onClick={() => setConfirmClear(true)}
            >
              Clear conversation
            </button>
          )}
        </div>

        {messages.length >= MAX_CONTEXT_MESSAGES && (
          <p className="chat-context-note">
            Older messages stay visible here, but only the latest{" "}
            {MAX_CONTEXT_MESSAGES} are sent to the assistant.
          </p>
        )}
      </div>
    </div>
  );
}
