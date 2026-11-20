"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { chatHistory, type ChatMode, type ConversationSummary } from "./chat-history";
import { useChat } from "./chat-provider";
import { useCompactChatLayout } from "./use-chat-viewport";

type HistoryAction = { kind: "rename" | "delete"; chat: ConversationSummary };

function ChatDialog({ title, close, children, drawer = false }: {
  title: string; close: () => void; children: ReactNode; drawer?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={drawer ? "chat-dialog chat-history-drawer" : "chat-dialog"}
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="chat-dialog-header">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="button button-outline" onClick={close}>Done</button>
    </header>
    {children}
  </dialog>;
}

function HistoryPanel({ select, start, drawer }: {
  select: (chat: ConversationSummary) => void; start: (mode: ChatMode) => void; drawer: boolean;
}) {
  const { conversation, historyRevision, updateHistory, refreshAvailability } = useChat();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
  const [action, setAction] = useState<HistoryAction | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const request = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const searchId = useId();

  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const page = await chatHistory.list(query, 0, controller.signal);
        if (controller.signal.aborted) return;
        setItems(page.items);
        setNext(page.next_offset);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.code === "exam_in_progress") void refreshAvailability();
        setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 160 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      request.current?.abort();
    };
  }, [query, historyRevision, refreshAvailability, reload]);

  useEffect(() => () => mutation.current?.abort(), []);

  async function loadMore() {
    if (next === null || loading) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const page = await chatHistory.list(query, next, controller.signal);
      if (controller.signal.aborted) return;
      setItems((previous) => [...new Map([...previous, ...page.items].map((item) => [item.id, item])).values()]);
      setNext(page.next_offset);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.code === "exam_in_progress") void refreshAvailability();
      setLoadError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || saving || (action.kind === "rename" && !title.trim())) return;
    const controller = new AbortController();
    mutation.current = controller;
    setSaving(true);
    setActionError("");
    try {
      await updateHistory(action.chat.id, action.kind === "rename" ? title.trim() : null, controller.signal);
      if (controller.signal.aborted) return;
      setAction(null);
      setMenu(null);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.code === "exam_in_progress") void refreshAvailability();
      setActionError(error instanceof ApiError && error.status === 404 ? "This chat was deleted or expired." : "Couldn’t update this chat. Try again.");
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  function edit(kind: HistoryAction["kind"], chat: ConversationSummary) {
    setAction({ kind, chat });
    setTitle(chat.title);
    setActionError("");
  }

  return <aside className="chat-history" aria-label="Chat history">
    <div className="chat-history-controls">
      <div className="chat-new-actions">
        <button type="button" className="button button-primary" onClick={() => start("saved")}>New chat</button>
        <button type="button" className="button button-outline" onClick={() => start("temporary")}>Temporary Chat</button>
      </div>
      {!drawer && <h2>Chat history</h2>}
      <label className="sr-only" htmlFor={searchId}>Search chat titles</label>
      <input id={searchId} type="search" placeholder="Search chat titles" value={query} maxLength={100}
        onChange={(event) => { setQuery(event.target.value); setLoading(true); setMenu(null); }} />
    </div>
    <div className="chat-history-list">
      {loadError && <div className="chat-history-status" role="status">
        <p>Couldn’t load chat history.</p><button type="button" onClick={() => setReload((value) => value + 1)}>Try again</button>
      </div>}
      {!loadError && loading && !items.length && <p className="chat-history-status" role="status">Loading history…</p>}
      {!loadError && !loading && !items.length && <p className="chat-history-status">{query.trim() ? "No matching titles." : "Your saved chats will appear here."}</p>}
      <ul aria-label="Saved chats">
        {items.map((chat) => <li key={chat.id}>
          <div className="chat-history-row" data-current={conversation?.id === chat.id || undefined}>
            <button type="button" className="chat-history-title" title={chat.title}
              aria-current={conversation?.id === chat.id ? "true" : undefined} onClick={() => select(chat)}>{chat.title}</button>
            <button type="button" className="chat-history-options" aria-label={"Actions for " + chat.title}
              title="Chat actions" aria-expanded={menu === chat.id} onClick={() => { setMenu(menu === chat.id ? null : chat.id); setAction(null); }}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" /><circle cx="15" cy="10" r="1.4" /></svg>
            </button>
          </div>
          {menu === chat.id && action?.chat.id !== chat.id && <div className="chat-history-edit">
            <button type="button" onClick={() => edit("rename", chat)}>Rename</button>
            <button type="button" onClick={() => edit("delete", chat)}>Delete</button>
          </div>}
          {action?.chat.id === chat.id && <form className="chat-history-edit" onSubmit={submit}>
            {action.kind === "rename"
              ? <label>Chat title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
              : <p>Delete “{chat.title}”?</p>}
            {actionError && <p role="alert">{actionError}</p>}
            <button type="button" onClick={() => setAction(null)} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving || (action.kind === "rename" && !title.trim())}>
              {action.kind === "rename" ? "Save title" : "Delete chat"}
            </button>
          </form>}
        </li>)}
      </ul>
      {next !== null && !loadError && <button type="button" className="chat-load-history" disabled={loading} onClick={() => void loadMore()}>Load more chats</button>}
    </div>
  </aside>;
}

function ChatSettings({ close }: { close: () => void }) {
  const { updateHistory, refreshAvailability } = useChat();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function removeAll() {
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      await updateHistory(null, null, controller.signal);
      if (controller.signal.aborted) return;
      setConfirm(false);
      setMessage("Saved chats deleted.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.code === "exam_in_progress") void refreshAvailability();
      setMessage("Couldn’t delete your saved chats. Try again.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <ChatDialog title="Chat Settings" close={close}>
    <div className="chat-settings-body">
      <section><h3>Saved history</h3><p>Your saved chats are available when you sign in. They expire 30 days after the last saved message.</p></section>
      <section><h3>Temporary Chat</h3><p>A temporary chat stays in its browser tab. Sign-out clears it from that tab.</p></section>
      <section><h3>What Gemini receives</h3><p>Gemini receives your question, recent conversation context, and relevant course excerpts in both modes.</p>
        <Link href="/privacy">Read the ByteQuest privacy notice</Link></section>
      {confirm ? <div className="chat-history-edit" role="group" aria-label="Confirm delete all saved chats">
        <p>Delete every saved chat in your account?</p>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        <button type="button" disabled={busy} onClick={() => void removeAll()}>Delete all saved chats</button>
      </div> : <button type="button" className="button button-outline chat-delete-all" onClick={() => { setConfirm(true); setMessage(""); }}>Delete all saved chats</button>}
      {message && <p role="status">{message}</p>}
    </div>
  </ChatDialog>;
}

export function ChatWorkspace({ header, children }: { header: ReactNode; children: ReactNode }) {
  const { canBrowseHistory, startChat, openConversation } = useChat();
  const compact = useCompactChatLayout();
  const [dialog, setDialog] = useState<"history" | "settings" | null>(null);

  function start(mode: ChatMode) {
    startChat(mode);
    setDialog(null);
  }

  function select(chat: ConversationSummary) {
    openConversation(chat);
    setDialog(null);
  }

  return <>
    <header className="chat-page-header">
      {header}
      {canBrowseHistory && <div className="chat-workspace-tools">
        {compact && <button type="button" className="button button-outline" onClick={() => setDialog("history")}>History</button>}
        <button type="button" className="button button-outline" onClick={() => setDialog("settings")}>Chat Settings</button>
      </div>}
    </header>
    <div className="chat-workspace-body" data-sidebar={canBrowseHistory && !compact || undefined}>
      {canBrowseHistory && !compact && <HistoryPanel select={select} start={start} drawer={false} />}
      <div className="chat-workspace-conversation">{children}</div>
    </div>
    {canBrowseHistory && compact && dialog === "history" && <ChatDialog drawer title="Chat history" close={() => setDialog(null)}>
      <HistoryPanel select={select} start={start} drawer />
    </ChatDialog>}
    {canBrowseHistory && dialog === "settings" && <ChatSettings close={() => setDialog(null)} />}
  </>;
}
