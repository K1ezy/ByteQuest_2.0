"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { belongsTo } from "@/lib/navigation";
import { useChat } from "./chat-provider";
import { useChatViewport, useCompactChatLayout } from "./use-chat-viewport";

const ChatConversation = dynamic(
  () => import("./chat-conversation").then((module) => module.ChatConversation),
  { ssr: false, loading: () => <div className="chat-loading" role="status">Loading chat…</div> },
);

export function ChatIcon() {
  return (
    <svg className="bq-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 0 1 11 5h2a8 8 0 0 1 8 6.5Z" />
      <path d="M8 11h.01M12 11h.01M16 11h.01" />
    </svg>
  );
}

function ChatPanel({ id, mobile, arena, close, expand, minimize }: {
  id: string; mobile: boolean; arena: boolean; close: () => void; expand: () => void; minimize: () => void;
}) {
  const dialogRef = useChatViewport<HTMLDialogElement>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [dialogRef]);

  const title = id + "-title";
  const contents: ReactNode = <>
    <header className="chat-panel-header">
      <h2 id={title}>Chat Assistant</h2>
      <div className="chat-window-actions">
        <button type="button" className="chat-window-btn" aria-label="Minimize chat" title="Minimize chat" onClick={minimize}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button type="button" className="chat-window-btn" aria-label="Open full page" title="Open full page" onClick={expand}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 5h11v11h-3" /><rect x="5" y="8" width="11" height="11" rx="1" />
          </svg>
        </button>
        <button type="button" className="chat-window-btn" aria-label="Close chat" title="Close chat" ref={closeRef} onClick={close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </header>
    <ChatConversation variant="compact" />
  </>;

  if (mobile) return (
    <dialog id={id} ref={dialogRef} aria-labelledby={title} className="chat-panel chat-sheet"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      {contents}
    </dialog>
  );

  return (
    <section id={id} className="chat-panel chat-panel-desktop" role="dialog" aria-labelledby={title}
      data-arena={arena || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        close();
      }}>
      {contents}
    </section>
  );
}

export function ChatShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signedIn, setReturnPath, windowMode, setWindowMode } = useChat();
  const open = windowMode === "open";
  const mobile = useCompactChatLayout();
  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const visible = signedIn === true && !belongsTo(pathname, "/chat");

  useEffect(() => {
    if (!visible) return;
    const query = searchParams.toString();
    setReturnPath(query ? pathname + "?" + query : pathname);
  }, [visible, pathname, searchParams, setReturnPath]);

  useEffect(() => {
    if (visible) return;
    // The route or account may change while the portal is open.
    setWindowMode("closed");
  }, [visible, setWindowMode]);

  function close() {
    setWindowMode("closed");
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  }

  function expand() {
    setWindowMode("closed");
    router.push("/chat");
  }

  function minimize() {
    setWindowMode("minimized");
    requestAnimationFrame(() => restoreRef.current?.focus({ preventScroll: true }));
  }

  if (!visible) return null;
  return (
    <>
      <button ref={launcherRef} type="button" className="button button-outline bq-chat-action"
        aria-label={open ? "Close Chat Assistant" : "Open Chat Assistant"} aria-expanded={open} aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => open ? close() : setWindowMode("open")}
        onKeyDown={(event) => {
          if (open && event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}>
        <ChatIcon />
        <span className="chat-launcher-label">Chat Assistant</span>
      </button>
      {open && createPortal(
        <ChatPanel key={mobile ? "mobile" : "desktop"} id={panelId} mobile={mobile}
          arena={belongsTo(pathname, "/arena")} close={close} expand={expand} minimize={minimize} />, document.body,
      )}
      {windowMode === "minimized" && createPortal(
        <button ref={restoreRef} type="button" className="chat-restore-bar" aria-label="Restore Chat Assistant"
          onClick={() => setWindowMode("open")}><ChatIcon /> Chat Assistant <span aria-hidden="true">↑</span></button>,
        document.body,
      )}
    </>
  );
}
