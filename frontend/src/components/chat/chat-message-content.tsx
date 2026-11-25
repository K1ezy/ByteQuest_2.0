"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "./chat-session";

// An unclosed fence (a reply cut at its token limit) runs to the end of the message.
const FENCE = /```[^\n`]*\n([\s\S]*?)(?:\n?```|$)/g;

export function messageParts(content: string): { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = [];
  let last = 0;
  const prose = (text: string) => {
    const trimmed = text.replace(/^\n+|\n+$/g, "");
    if (trimmed) parts.push({ code: false, text: trimmed });
  };
  for (const match of content.matchAll(FENCE)) {
    prose(content.slice(last, match.index));
    parts.push({ code: true, text: match[1].replace(/\n+$/, "") });
    last = match.index + match[0].length;
  }
  prose(content.slice(last));
  return parts;
}

function CodeBlock({ code }: { code: string }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 2_500);
    return () => window.clearTimeout(timer);
  }, [copy]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="chat-code">
      <pre tabIndex={0} aria-label="Code example"><code>{code}</code></pre>
      <button type="button" className="chat-code-copy" onClick={() => void copyCode()}>
        {copy === "copied" ? "Copied" : copy === "failed" ? "Copy failed" : "Copy code"}
      </button>
      <span className="sr-only" role="status">
        {copy === "copied" ? "Code copied to the clipboard." : copy === "failed" ? "Couldn't copy the code." : ""}
      </span>
    </div>
  );
}

/** Assistant text with fenced examples as copyable code blocks. Everything renders as literal text. */
export function ChatMessageContent({ content }: { content: string }) {
  return messageParts(content).map((part, index) => part.code
    ? <CodeBlock key={index} code={part.text} />
    : <span key={index} className="chat-text">{part.text}</span>);
}

export function ChatMessageBubble({ message, sourceLabel = "Course sources" }: { message: ChatMessage; sourceLabel?: string }) {
  const cited = Boolean(message.sources?.length);
  const pages = cited ? message.sources : message.consulted_sources;
  return <article className={`chat-message chat-message-${message.role}`}>
    <span className="chat-message-role">{message.role === "user" ? "You" : "Chat Assistant"}</span>
    <div className="chat-bubble">
      {message.role === "assistant" ? <ChatMessageContent content={message.content} /> : message.content}
    </div>
    {Boolean(pages?.length) && <details className="chat-sources" open>
      <summary>{cited ? sourceLabel : "Pages consulted"}</summary>
      <ul>{pages?.map((source) => (
        <li key={`${source.document_title}:${source.page_number}`}>{source.document_title}, p. {source.page_number}</li>
      ))}</ul>
    </details>}
  </article>;
}
