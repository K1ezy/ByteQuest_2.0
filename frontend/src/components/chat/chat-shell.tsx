"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@/components/chat/chat-provider";

const ChatConversation = dynamic(
  () =>
    import("@/components/chat/chat-conversation").then(
      (module) => module.ChatConversation,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="chat-loading" role="status">
        Loading chat…
      </div>
    ),
  },
);

const UUID_PATH =
  /^\/(?:arena|quiz)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

export function ChatShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    signedIn,
    setActivityId,
    setReturnPath,
  } = useChat();

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  const isChatPage = pathname === "/chat";
  const isExamRoute = pathname === "/exams" || pathname.startsWith("/exams/");
  const isDisallowed =
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/faculty" ||
    pathname.startsWith("/faculty/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/account") ||
    isExamRoute ||
    isChatPage;
  const canShow = signedIn === true && !isDisallowed;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isChatPage || isDisallowed) return;
    const query = searchParams.toString();
    setReturnPath(query ? `${pathname}?${query}` : pathname);
  }, [isChatPage, isDisallowed, pathname, searchParams, setReturnPath]);

  useEffect(() => {
    const match = pathname.match(UUID_PATH);
    setActivityId(match ? match[1] : null);
  }, [pathname, setActivityId]);

  useEffect(() => {
    if (!canShow && open) {
      // Route/auth visibility is an external system; collapse the panel when
      // the shell itself is no longer allowed on this page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [canShow, open]);

  const closePanel = useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    launcherRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (!isMobile || event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePanel, isMobile, open]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const main = document.getElementById("main-content");
    const header = document.querySelector<HTMLElement>(".site-header-redesign");
    const skipLink = document.querySelector<HTMLElement>(".skip-to-content");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    [main, header, skipLink].forEach((element) =>
      element?.setAttribute("inert", ""),
    );
    return () => {
      [main, header, skipLink].forEach((element) =>
        element?.removeAttribute("inert"),
      );
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, open]);

  const maximize = useCallback(() => {
    restoreFocusRef.current = false;
    setOpen(false);
    router.push("/chat");
  }, [router]);

  if (isChatPage || !canShow) return null;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          className="chat-launcher"
          aria-label="Open Chat Assistant"
          onClick={() => setOpen(true)}
        >
          <svg
            className="chat-launcher-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 0 1 11 5h2a8 8 0 0 1 8 6.5Z" />
            <path d="M8 11h.01M12 11h.01M16 11h.01" />
          </svg>
          <span className="chat-launcher-label">Chat</span>
        </button>
      )}

      {open && (
        <>
          {isMobile && (
            <div
              className="chat-backdrop"
              onClick={closePanel}
              aria-hidden="true"
            />
          )}
          <section
            ref={panelRef}
            className="chat-panel"
            role="dialog"
            aria-modal={isMobile ? true : undefined}
            aria-labelledby="chat-panel-title"
          >
            <header className="chat-panel-header">
              <div className="chat-panel-heading">
                <p className="chat-eyebrow">BYTEQUEST</p>
                <h2 id="chat-panel-title">Chat Assistant</h2>
                <p className="chat-panel-subtitle">Hints &amp; concepts</p>
              </div>
              <div className="chat-window-actions">
                <button
                  type="button"
                  className="chat-window-btn"
                  aria-label="Minimize chat"
                  data-tooltip="Minimize chat. The conversation is kept."
                  onClick={closePanel}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 12h12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="chat-window-btn"
                  aria-label="Open chat full page"
                  data-tooltip="Open the full chat workspace."
                  onClick={maximize}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="chat-window-btn"
                  aria-label="Close panel"
                  data-tooltip="Close panel. The conversation is kept."
                  onClick={closePanel}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </header>
            <ChatConversation variant="compact" />
          </section>
        </>
      )}
    </>
  );
}
