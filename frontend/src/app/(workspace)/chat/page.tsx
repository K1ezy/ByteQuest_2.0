"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { ChatConversation } from "@/components/chat/chat-conversation";
import { ChatLessonPractice } from "@/components/chat/chat-lesson-practice";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { useChat } from "@/components/chat/chat-provider";
import { useChatViewport } from "@/components/chat/use-chat-viewport";
import { canOpenPath, internalPath, primaryNavigation } from "@/lib/navigation";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export default function ChatPage() {
  return <Suspense fallback={<p role="status">Loading chat…</p>}><ChatPageContent /></Suspense>;
}

function ChatPageContent() {
  const { ownerId, signedIn, returnPath, role } = useChat();
  const params = useSearchParams();
  const workshop = params.get("workshop") ?? "";
  const lesson = params.get("lesson") ?? "";
  const lessonPath = uuid.test(workshop) && uuid.test(lesson) ? `/workshops/${workshop}/materials` : null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewportRef = useChatViewport<HTMLDivElement>();
  const destination = internalPath(returnPath);
  const backHref = destination && (!role || canOpenPath(role, destination.pathname)) && returnPath
    ? returnPath : role ? primaryNavigation[role][0][0] : "/quests";

  useEffect(() => {
    if (signedIn !== null) headingRef.current?.focus({ preventScroll: true });
  }, [signedIn]);

  if (signedIn === null) {
    return (
      <div className="chat-page" ref={viewportRef}>
        <section className="chat-page-card chat-page-state" role="status">
          Loading chat…
        </section>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="chat-page" ref={viewportRef}>
        <section className="chat-page-card chat-page-state">
          <h1 id="chat-page-title" ref={headingRef} tabIndex={-1}>
            Chat Assistant
          </h1>
          <p>
            Sign in to ask about programming concepts, review a lesson idea, or
            request a hint for a coding challenge.
          </p>
          <Link href={`/onboarding?redirect=${encodeURIComponent(lessonPath ? `/chat?workshop=${workshop}&lesson=${lesson}` : "/chat")}`} className="button button-primary">
            Sign in to chat
          </Link>
        </section>
      </div>
    );
  }

  if (lessonPath) return <div className="chat-page" ref={viewportRef}>
    <section className="chat-page-card chat-practice-card" aria-labelledby="chat-page-title">
      <header className="chat-page-header">
        <Link href={lessonPath} className="chat-back-link">← Workshop materials</Link>
        <h1 id="chat-page-title" ref={headingRef} tabIndex={-1}>Chat Assistant</h1>
      </header>
      <ChatLessonPractice key={`${ownerId}:${workshop}:${lesson}`} workshopId={workshop} lessonId={lesson} />
    </section>
  </div>;

  return (
    <div className="chat-page" ref={viewportRef}>
      <section className="chat-page-card" aria-labelledby="chat-page-title">
        <ChatWorkspace header={<>
          <Link href={backHref} className="chat-back-link">
            <span aria-hidden="true">←</span> {returnPath && backHref === returnPath ? "Back to previous page" : "Back to workspace"}
          </Link>
          <h1 id="chat-page-title" ref={headingRef} tabIndex={-1}>
            Chat Assistant
          </h1>
        </>}><ChatConversation variant="page" /></ChatWorkspace>
      </section>
    </div>
  );
}
