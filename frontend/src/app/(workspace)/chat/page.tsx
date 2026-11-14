"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { useChat } from "@/components/chat/chat-provider";

export default function ChatPage() {
  const { signedIn, returnPath } = useChat();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (signedIn === false) headingRef.current?.focus();
  }, [signedIn]);

  if (signedIn === null) {
    return (
      <div className="chat-page">
        <section className="chat-page-card chat-page-state" role="status">
          Loading chat…
        </section>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="chat-page">
        <section className="chat-page-card chat-page-state">
          <p className="chat-eyebrow">LEARNING ASSISTANT</p>
          <h1 id="chat-page-title" ref={headingRef} tabIndex={-1}>
            Chat Assistant
          </h1>
          <p>
            Sign in to ask about programming concepts, review a lesson idea, or
            request a hint for a coding challenge.
          </p>
          <Link href="/onboarding" className="button button-primary">
            Sign in to chat
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <section className="chat-page-card" aria-labelledby="chat-page-title">
        <header className="chat-page-header">
          <Link href={returnPath} className="chat-back-link">
            <span aria-hidden="true">←</span> Back to previous page
          </Link>
          <p className="chat-eyebrow">LEARNING ASSISTANT</p>
          <h1 id="chat-page-title" ref={headingRef} tabIndex={-1}>
            Chat Assistant
          </h1>
          <p className="chat-page-subtitle">
            Ask about concepts, lessons, or request a hint. I won&apos;t give full
            solutions or answer keys.
          </p>
        </header>
        <ChatConversation variant="page" />
      </section>
    </div>
  );
}
