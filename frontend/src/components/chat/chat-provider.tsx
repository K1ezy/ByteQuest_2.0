"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { newRequestId } from "@/lib/network";
import type { UserRole } from "@/lib/types";
import { chatHistory, turnMessages, type ChatMode, type ConversationSummary, type SavedReply } from "./chat-history";
import {
  activityFromPath, contextMessages, DEFAULT_LIMITS, loadChatSnapshot, MAX_SAVED_MESSAGES,
  safeChatReturnPath, saveChatSnapshot, type ChatLimits, type ChatMessage, type ChatSource,
} from "./chat-session";

type ServerChatState = "ready" | "exam_in_progress" | "enrollment_required" | "disabled" | "unavailable";
type ChatStatusResponse = { status: ServerChatState; role: UserRole; language: string | null; limits: ChatLimits; history_enabled?: boolean };
type ChatAvailability = ServerChatState | "checking" | "offline" | "connection_error" | "session";
type ChatError = {
  kind: "network" | "rate_limit" | "unavailable" | "invalid" | "session" | "forbidden" | "pending" | "unknown";
  message: string;
  retryable: boolean;
  retryAt?: number;
  blocked?: ServerChatState;
  clearActivity?: boolean;
  /** The saved reply may still arrive: offer a read-only check instead of a new generation. */
  check?: boolean;
};

const INTERRUPTED_REPLY: ChatError = {
  kind: "network",
  message: "Your question is still here. Retry when you're ready.",
  retryable: true,
};
const PENDING_REPLY: ChatError = {
  kind: "pending",
  message: "A reply is still being prepared for this chat. Check again in a moment.",
  retryable: false,
  check: true,
};
const MISSING_REPLY: ChatError = {
  kind: "unavailable",
  message: "Your reply wasn't saved. Your question is still here, so retry when you're ready.",
  retryable: true,
};
// The request may have reached the server even though its response never arrived.
const LOST_RESPONSE = [0, 502, 504];

function mapChatError(error: unknown): ChatError {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return {
          kind: "network",
          message: navigator.onLine ? "ByteQuest could not connect. Try again in a moment." : "You're offline. Reconnect to retry your question.",
          retryable: true,
        };
      case 401:
        return { kind: "session", message: "Your session expired. Sign in again to continue.", retryable: false };
      case 403:
        return {
          kind: "forbidden",
          message: error.code === "exam_in_progress" || error.code === "enrollment_required"
            ? error.message : "This account cannot use the learning assistant.",
          retryable: error.code === "exam_in_progress",
          blocked: error.code === "exam_in_progress" || error.code === "enrollment_required" ? error.code : undefined,
        };
      case 404:
        if (error.code === "conversation_missing") {
          return { kind: "invalid", message: "This chat was deleted or expired. Start a new chat to continue.", retryable: false };
        }
        return {
          kind: "invalid",
          message: "This activity is unavailable. Retry to ask your question without the activity.",
          retryable: true,
          clearActivity: true,
        };
      case 409:
        if (error.code === "chat_turn_in_progress") return PENDING_REPLY;
        if (error.code === "conversation_changed") {
          return { kind: "unavailable", message: "This chat changed on another device. Review the latest messages before retrying.", retryable: true };
        }
        return { kind: "unavailable", message: "The available course material changed. Try your question again.", retryable: true };
      case 422:
        return { kind: "invalid", message: "Edit your question and send it again.", retryable: false };
      case 429:
        return {
          kind: "rate_limit",
          message: error.retryAfterSeconds ? "You've reached the chat limit. Retry when the wait ends." : "You've reached the chat limit. Try again later.",
          retryable: true,
          retryAt: error.retryAfterSeconds ? Date.now() + error.retryAfterSeconds * 1_000 : undefined,
        };
      case 503: {
        const retryAt = error.retryAfterSeconds ? Date.now() + error.retryAfterSeconds * 1_000 : undefined;
        if (error.code === "provider_rate_limited") {
          return { kind: "rate_limit", message: "The assistant is busy right now. Your question is still here.", retryable: true, retryAt };
        }
        if (error.code === "provider_timeout") {
          return { kind: "unavailable", message: "The assistant took too long to reply. Your question is still here.", retryable: true, retryAt };
        }
        return {
          kind: "unavailable",
          message: "The assistant is temporarily unavailable. Your question is still here.",
          retryable: true,
          retryAt,
        };
      }
    }
  }
  if (error instanceof Error && error.message.startsWith("Your session has expired.")) {
    return { kind: "session", message: "Your session expired. Sign in again to continue.", retryable: false };
  }
  return { kind: "unknown", message: "The assistant couldn't respond. Your question is still here.", retryable: true };
}

function useChatController() {
  const [windowMode, setWindowMode] = useState<"closed" | "open" | "minimized">("closed");
  const [ownerId, setOwnerId] = useState<string | null | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [returnPath, setReturnPathState] = useState<string | null>(null);
  const [detachedActivity, setDetachedActivity] = useState<string | null>(null);
  const [scrollToLatest, setScrollToLatest] = useState(true);
  const [availability, setAvailability] = useState<ChatAvailability>("checking");
  const [serverStatus, setServerStatus] = useState<ChatStatusResponse | null>(null);
  const [mode, setMode] = useState<ChatMode>("saved");
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [before, setBefore] = useState<number | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const userRef = useRef<string | null | undefined>(undefined);
  const messagesRef = useRef<ChatMessage[]>([]);
  const lastActivity = useRef<string | null>(null);
  const replyRequest = useRef<AbortController | null>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const transcriptRequest = useRef<AbortController | null>(null);
  const conversationRef = useRef<ConversationSummary | null>(null);
  const restoreId = useRef<string | null>(null);
  const newConversationId = useRef<string | null>(null);
  const drafts = useRef<Record<string, string>>({});
  const routeActivity = activityFromPath(returnPath);
  const activity = routeActivity?.id === detachedActivity ? null : routeActivity;
  const limits = serverStatus?.limits ?? DEFAULT_LIMITS;
  const historyEnabled = serverStatus?.history_enabled === true;
  const canBrowseHistory = historyEnabled && ["ready", "disabled", "unavailable", "enrollment_required"].includes(availability);

  const replaceMessages = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(messagesRef.current);
  }, []);

  const updateConversation = useCallback((value: ConversationSummary | null) => {
    conversationRef.current = value;
    setConversation(value);
  }, []);

  const cancelTranscript = useCallback(() => {
    transcriptRequest.current?.abort();
    transcriptRequest.current = null;
    setLoadingTranscript(false);
  }, []);

  const stopReply = useCallback(() => {
    replyRequest.current?.abort();
    replyRequest.current = null;
    setPending(false);
  }, []);

  const clearConversation = useCallback(() => {
    stopReply();
    newConversationId.current = null;
    lastActivity.current = null;
    replaceMessages([]);
    setDraft("");
    setError(null);
    setScrollToLatest(true);
    saveChatSnapshot(null);
  }, [replaceMessages, stopReply]);

  const transitionAccount = useCallback((next: string | null) => {
    const previous = userRef.current;
    if (previous === next) return;
    userRef.current = next;
    stopReply();
    cancelTranscript();
    statusRequest.current?.abort();
    statusRequest.current = null;
    setAvailability("checking");
    setWindowMode("closed");
    setServerStatus(null);
    const snapshot = previous === undefined && next ? loadChatSnapshot(next) : null;
    if (!snapshot) saveChatSnapshot(null);
    replaceMessages(snapshot?.messages ?? []);
    drafts.current = snapshot?.savedDrafts ?? {};
    restoreId.current = snapshot?.conversationId ?? null;
    newConversationId.current = null;
    updateConversation(null);
    setBefore(null);
    setMode(snapshot?.mode ?? "saved");
    setHistoryRevision(0);
    lastActivity.current = snapshot?.lastActivityId ?? null;
    setDraft(snapshot?.draft ?? "");
    setReturnPathState(snapshot?.returnPath ?? null);
    setDetachedActivity(snapshot?.detachedActivity ?? null);
    setError(snapshot?.messages.at(-1)?.role === "user" ? INTERRUPTED_REPLY : null);
    setScrollToLatest(true);
    setOwnerId(next);
  }, [cancelTranscript, replaceMessages, stopReply, updateConversation]);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let subscription: { unsubscribe: () => void } | undefined;
    const onCleared = () => {
      revision += 1;
      transitionAccount(null);
    };
    window.addEventListener("bytequest:auth-cleared", onCleared);
    void (async () => {
      try {
        const { getSupabase } = await import("@/lib/supabase");
        if (!active) return;
        const auth = getSupabase().auth;
        const initialRevision = revision;
        subscription = auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          revision += 1;
          transitionAccount(session?.user.id ?? null);
        }).data.subscription;
        const { data } = await auth.getSession();
        if (active && initialRevision === revision) transitionAccount(data.session?.user.id ?? null);
      } catch {
        if (active && revision === 0) transitionAccount(null);
      }
    })();
    return () => {
      active = false;
      subscription?.unsubscribe();
      window.removeEventListener("bytequest:auth-cleared", onCleared);
      replyRequest.current?.abort();
      statusRequest.current?.abort();
      transcriptRequest.current?.abort();
    };
  }, [transitionAccount]);

  useEffect(() => {
    if (!ownerId || userRef.current !== ownerId) return;
    // Keep a safe return path for this account even before their first question.
    const conversationId = conversation?.id ?? restoreId.current;
    if (conversationId) {
      delete drafts.current[conversationId];
      drafts.current[conversationId] = draft;
    }
    const cachedMessages = conversationId ? messages.slice(-1).filter((message) => message.role === "user")
      : messages.slice(-MAX_SAVED_MESSAGES);
    saveChatSnapshot({
      ownerId, messages: cachedMessages, draft, returnPath, detachedActivity, lastActivityId: lastActivity.current,
      mode, conversationId, savedDrafts: Object.fromEntries(Object.entries(drafts.current).slice(-25)),
    });
  }, [ownerId, messages, draft, returnPath, detachedActivity, pending, error, mode, conversation, historyRevision]);

  const setReturnPath = useCallback((path: string) => {
    const safePath = safeChatReturnPath(path);
    if (safePath) setReturnPathState(safePath);
  }, []);

  const detachActivity = () => {
    if (!routeActivity) return;
    if (lastActivity.current === routeActivity.id) lastActivity.current = null;
    setDetachedActivity(routeActivity.id);
  };

  const readTranscript = useCallback(async (id: string, older?: number) => {
    transcriptRequest.current?.abort();
    const controller = new AbortController();
    transcriptRequest.current = controller;
    setLoadingTranscript(true);
    try {
      const result = await chatHistory.read(id, controller.signal, older);
      if (controller.signal.aborted) return;
      const loaded = result.turns.flatMap(turnMessages);
      if (older) {
        replaceMessages([...loaded, ...messagesRef.current]);
      } else {
        const previous = messagesRef.current.at(-1);
        const interrupted = previous?.role === "user" && !loaded.some((entry) => entry.id === previous.id);
        replaceMessages(interrupted ? [...loaded, previous] : loaded);
        // Keep the reason the question is unsaved (such as a cross-device conflict) rather than a generic notice.
        setError((current) => interrupted ? current ?? INTERRUPTED_REPLY : null);
        updateConversation(result.conversation);
      }
      setBefore(result.before);
      return true;
    } catch (caught) {
      if (controller.signal.aborted) return;
      const failure = mapChatError(caught);
      if (failure.blocked) setAvailability(failure.blocked);
      if (caught instanceof ApiError && caught.code === "conversation_missing") {
        updateConversation(null);
        replaceMessages([]);
        delete drafts.current[id];
        setDraft("");
        setBefore(null);
        setHistoryRevision((value) => value + 1);
        setError(failure);
        return true;
      }
      setError(failure);
    } finally {
      if (transcriptRequest.current === controller) {
        transcriptRequest.current = null;
        setLoadingTranscript(false);
      }
    }
  }, [replaceMessages, updateConversation]);

  const refreshAvailability = useCallback(async (background = false) => {
    if (!userRef.current) return;
    statusRequest.current?.abort();
    if (!navigator.onLine) {
      statusRequest.current = null;
      setAvailability((previous) => {
        if (previous === "ready" || previous === "offline") return "offline";
        return previous === "checking" ? "connection_error" : previous;
      });
      return;
    }
    const controller = new AbortController();
    statusRequest.current = controller;
    setAvailability((previous) => background && previous === "ready" ? previous : "checking");
    try {
      const result = await apiRequest<ChatStatusResponse>("/chat/status", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setServerStatus(result);
      setAvailability(result.status);
      if (!result.history_enabled && restoreId.current) {
        restoreId.current = null;
        setMode("temporary");
      }
      if (result.status === "ready") {
        setError((previous) => previous?.blocked ? INTERRUPTED_REPLY : previous);
      }
      if (result.status !== "ready" && replyRequest.current) {
        stopReply();
        setError(INTERRUPTED_REPLY);
      }
      if (result.status === "exam_in_progress") cancelTranscript();
      if (result.history_enabled && result.status !== "exam_in_progress" && !replyRequest.current && !transcriptRequest.current) {
        const id = restoreId.current ?? (background ? conversationRef.current?.id : null);
        if (id) {
          const resolved = await readTranscript(id);
          if (resolved && !controller.signal.aborted && restoreId.current === id) restoreId.current = null;
        }
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setAvailability(mapChatError(caught).kind === "session" ? "session" : "connection_error");
    } finally {
      if (statusRequest.current === controller) statusRequest.current = null;
    }
  }, [cancelTranscript, readTranscript, stopReply]);

  async function requestReply(history: ChatMessage[], activityId: string | null) {
    if (!navigator.onLine) {
      setError({ ...INTERRUPTED_REPLY, message: "You're offline. Reconnect to retry your question." });
      return;
    }
    const controller = new AbortController();
    replyRequest.current = controller;
    lastActivity.current = activityId;
    setPending(true);
    setError(null);
    setScrollToLatest(true);
    let sentTo: ConversationSummary | null = null;
    try {
      if (mode === "saved" && historyEnabled) {
        let current = conversationRef.current;
        if (!current) {
          // Reused on retry, so a lost create response cannot open (and charge for) a second chat.
          newConversationId.current ??= newRequestId();
          current = await chatHistory.create(newConversationId.current, controller.signal);
          if (controller.signal.aborted) return;
          newConversationId.current = null;
          updateConversation(current);
        }
        sentTo = current;
        const saved = await chatHistory.send(current, history.at(-1)!, activityId, controller.signal);
        if (controller.signal.aborted) return;
        await applySavedReply(current, saved);
        return;
      }
      setMode("temporary");
      const response = await apiRequest<{ reply: string; sources?: ChatSource[] }>("/chat/messages", {
        method: "POST",
        body: JSON.stringify({ messages: contextMessages(history, limits), activity_id: activityId }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const reply = response.reply.trim();
      if (!reply) throw new Error("Empty chat response");
      const message: ChatMessage = { id: newRequestId(), role: "assistant", content: reply, sources: response.sources };
      replaceMessages([...messagesRef.current, message].slice(-MAX_SAVED_MESSAGES));
    } catch (caught) {
      if (controller.signal.aborted) return;
      // The reply may have been saved even though its response was lost: check once before offering Retry.
      if (sentTo && caught instanceof ApiError && LOST_RESPONSE.includes(caught.status)) {
        await recoverTurn(sentTo, history.at(-1)!, controller.signal);
      } else {
        await handleFailure(caught, history, activityId);
      }
    } finally {
      if (replyRequest.current === controller) {
        replyRequest.current = null;
        setPending(false);
      }
    }
  }

  async function applySavedReply(current: ConversationSummary, saved: SavedReply) {
    updateConversation(saved.conversation);
    if (saved.turn.position !== current.revision + 1 || saved.turn.position !== saved.conversation.revision) {
      await readTranscript(current.id);
    } else {
      replaceMessages([...messagesRef.current.slice(0, -1), ...turnMessages(saved.turn)]);
    }
    setHistoryRevision((value) => value + 1);
  }

  /** Read-only: restores a saved reply or says whether a new generation is needed. Never calls Gemini. */
  async function recoverTurn(current: ConversationSummary, question: ChatMessage, signal: AbortSignal) {
    try {
      const result = await chatHistory.turn(current.id, question.id, signal);
      if (signal.aborted) return;
      if (result.turn) await applySavedReply(current, { conversation: result.conversation, turn: result.turn });
      else setError(result.status === "pending" ? PENDING_REPLY : MISSING_REPLY);
    } catch (caught) {
      if (!signal.aborted) await handleFailure(caught, messagesRef.current, lastActivity.current);
    }
  }

  async function handleFailure(caught: unknown, history: ChatMessage[], activityId: string | null) {
    const failure = mapChatError(caught);
    if (failure.clearActivity) {
      lastActivity.current = null;
      if (activityId === routeActivity?.id) setDetachedActivity(activityId);
    }
    if (failure.blocked) {
      statusRequest.current?.abort();
      statusRequest.current = null;
      setAvailability(failure.blocked);
    }
    if (failure.kind === "session") setAvailability("session");
    if (caught instanceof ApiError && caught.code === "conversation_missing") {
      restoreId.current = null;
      updateConversation(null);
      replaceMessages([]);
      setBefore(null);
      setDraft(history.at(-1)?.content ?? "");
      setHistoryRevision((value) => value + 1);
    }
    setError(failure);
    if (caught instanceof ApiError && caught.code === "conversation_changed" && conversationRef.current) {
      await readTranscript(conversationRef.current.id);
    }
  }

  function checkReply() {
    const current = conversationRef.current;
    const question = messagesRef.current.at(-1);
    if (!current || question?.role !== "user" || !canSend()) return;
    const controller = new AbortController();
    replyRequest.current = controller;
    setPending(true);
    void recoverTurn(current, question, controller.signal).finally(() => {
      if (replyRequest.current === controller) {
        replyRequest.current = null;
        setPending(false);
      }
    });
  }

  function canSend() {
    return ownerId && userRef.current === ownerId && !replyRequest.current && !transcriptRequest.current && !restoreId.current
      && (!conversationRef.current || historyEnabled) && availability === "ready"
      && (!error?.retryAt || Date.now() >= error.retryAt);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !canSend()) return;
    if (text.length > Math.min(limits.max_message_chars, limits.max_total_chars)) {
      setError({ kind: "invalid", message: "Shorten your question and send it again.", retryable: false });
      return;
    }
    const next: ChatMessage[] = [...messagesRef.current, { id: newRequestId(), role: "user", content: text }];
    replaceMessages(next);
    setDraft("");
    void requestReply(next, activity?.id ?? null);
  }

  function retryLast() {
    const history = messagesRef.current;
    const last = history.at(-1);
    if (!canSend() || last?.role !== "user") return;
    if (last.content.length > Math.min(limits.max_message_chars, limits.max_total_chars)) {
      setError({ kind: "invalid", message: "Shorten your question and send it again.", retryable: false });
      return;
    }
    void requestReply(history, lastActivity.current);
  }

  function editLast() {
    const last = messagesRef.current.at(-1);
    if (last?.role !== "user" || pending || draft) return;
    setDraft(last.content);
    replaceMessages(messagesRef.current.slice(0, -1));
    setError(null);
  }

  function startChat(next: ChatMode) {
    if (conversationRef.current) drafts.current[conversationRef.current.id] = draft;
    cancelTranscript();
    restoreId.current = null;
    updateConversation(null);
    setBefore(null);
    clearConversation();
    setMode(next);
  }

  function openConversation(selected: ConversationSummary) {
    if (!canBrowseHistory) return;
    if (conversationRef.current?.id === selected.id) return;
    startChat("saved");
    updateConversation(selected);
    setDraft(drafts.current[selected.id] ?? "");
    void readTranscript(selected.id);
  }

  async function updateHistory(id: string | null, title: string | null, signal: AbortSignal) {
    const owner = userRef.current;
    if (!owner || !canBrowseHistory) return;
    const updated = id && title ? await chatHistory.rename(id, title, signal) : await chatHistory.remove(id, signal);
    if (signal.aborted || owner !== userRef.current) return;
    if (updated && conversationRef.current?.id === updated.id) {
      updateConversation({ ...conversationRef.current, title: updated.title });
    }
    if (!title) {
      if (!id || id === conversationRef.current?.id || id === restoreId.current) {
        if (mode === "saved" && (id || conversationRef.current || restoreId.current || replyRequest.current)) startChat("saved");
      }
      if (id) delete drafts.current[id];
      else drafts.current = {};
    }
    setHistoryRevision((value) => value + 1);
  }

  return {
    windowMode, setWindowMode,
    signedIn: ownerId === undefined ? null : Boolean(ownerId),
    messages, draft, setDraft, pending, error, returnPath, setReturnPath, activity, detachActivity,
    scrollToLatest, setScrollToLatest, sendMessage, retryLast, checkReply, editLast, clearConversation,
    refreshAvailability, availability, role: serverStatus?.role, language: serverStatus?.language, limits,
    mode, conversation, historyEnabled, canBrowseHistory, historyRevision, startChat, openConversation, updateHistory,
    loadingTranscript, canLoadEarlier: before !== null,
    loadEarlier: () => {
      if (conversation && before && !loadingTranscript && !pending && canBrowseHistory) {
        setScrollToLatest(false);
        void readTranscript(conversation.id, before);
      }
    },
  };
}

const ChatContext = createContext<ReturnType<typeof useChatController> | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChatController();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within a ChatProvider.");
  return context;
}
