"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export type ChatErrorKind =
  | "network"
  | "rate_limit"
  | "unavailable"
  | "invalid"
  | "session"
  | "forbidden"
  | "unknown";

export interface ChatError {
  kind: ChatErrorKind;
  message: string;
  retryable: boolean;
  clearActivity?: boolean;
}

export const MAX_CONTEXT_MESSAGES = 12;
export const CHAT_MAX_MESSAGE_CHARS = 4_000;
const RETURN_PATH_KEY = "bytequest:chat:return-path";

interface ChatContextValue {
  messages: ChatMessage[];
  draft: string;
  setDraft: (value: string) => void;
  pending: boolean;
  error: ChatError | null;
  signedIn: boolean | null;
  activityId: string | null;
  setActivityId: (value: string | null) => void;
  sendMessage: () => void;
  retryLast: () => void;
  clearConversation: () => void;
  clearError: () => void;
  returnPath: string;
  setReturnPath: (path: string) => void;
  scrollToLatest: boolean;
  setScrollToLatest: (value: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSafeReturnPath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    path !== "/" &&
    path !== "/chat" &&
    !path.startsWith("/chat?") &&
    !path.startsWith("/onboarding")
  );
}

function initialReturnPath(): string {
  if (typeof window === "undefined") return "/quests";
  try {
    const stored = window.sessionStorage.getItem(RETURN_PATH_KEY);
    return stored && isSafeReturnPath(stored) ? stored : "/quests";
  } catch {
    return "/quests";
  }
}

function mapChatError(error: unknown): ChatError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: "session",
        message: "Your session has expired. Sign in again to continue chatting.",
        retryable: false,
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        message: "This account cannot use the learning assistant.",
        retryable: false,
      };
    }
    if (error.status === 404) {
      return {
        kind: "invalid",
        message: "That activity is no longer available for chat. You can ask a general question instead.",
        retryable: false,
        clearActivity: true,
      };
    }
    if (error.status === 422) {
      return {
        kind: "invalid",
        message: "That message could not be sent. Shorten it or start a new conversation.",
        retryable: false,
      };
    }
    if (error.status === 429) {
      const seconds = error.retryAfterSeconds;
      return {
        kind: "rate_limit",
        message: seconds
          ? `Too many messages. Try again in ${seconds} seconds.`
          : "Too many messages. Please wait a moment and try again.",
        retryable: true,
      };
    }
    if (error.status === 503) {
      return {
        kind: "unavailable",
        message: "The learning assistant is temporarily unavailable. Your message is still here—try again.",
        retryable: true,
      };
    }
    if (error.status === 0) {
      return {
        kind: "network",
        message: "You appear to be offline. Check your connection and try again.",
        retryable: true,
      };
    }
  }
  return {
    kind: "unknown",
    message: "The assistant could not respond. Your message is still here—try again.",
    retryable: true,
  };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [activityId, setActivityIdState] = useState<string | null>(null);
  const [returnPath, setReturnPathState] = useState(initialReturnPath);
  const [scrollToLatest, setScrollToLatest] = useState(true);

  const messagesRef = useRef<ChatMessage[]>([]);
  const activityIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const setActivityId = useCallback((value: string | null) => {
    activityIdRef.current = value;
    setActivityIdState(value);
  }, []);

  const setReturnPath = useCallback((path: string) => {
    if (!isSafeReturnPath(path)) return;
    setReturnPathState(path);
    try {
      window.sessionStorage.setItem(RETURN_PATH_KEY, path);
    } catch {
      // Session storage can be unavailable; the in-memory path still works.
    }
  }, []);

  const resetConversation = useCallback(() => {
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = false;
    messagesRef.current = [];
    setMessages([]);
    setDraft("");
    setError(null);
    setPending(false);
    setScrollToLatest(true);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const requestReply = useCallback(
    async (history: ChatMessage[]) => {
      if (pendingRef.current) return;

      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      pendingRef.current = true;
      setPending(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      const payloadMessages = history
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => ({ role: message.role, content: message.content }));

      try {
        const response = await apiRequest<{ reply: string }>("/chat/messages", {
          method: "POST",
          body: JSON.stringify({
            messages: payloadMessages,
            activity_id: activityIdRef.current,
          }),
          signal: controller.signal,
        });
        if (seq !== requestSeqRef.current) return;

        const reply = (response.reply || "").trim();
        if (!reply) {
          throw new Error("The assistant returned an empty reply.");
        }

        const assistantMessage: ChatMessage = {
          id: createMessageId(),
          role: "assistant",
          content: reply,
        };
        const next = [...messagesRef.current, assistantMessage];
        messagesRef.current = next;
        setMessages(next);
      } catch (caught) {
        if (seq !== requestSeqRef.current) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const mapped = mapChatError(caught);
        if (mapped.clearActivity) {
          setActivityId(null);
        }
        setError(mapped);
      } finally {
        if (seq === requestSeqRef.current) {
          pendingRef.current = false;
          setPending(false);
        }
      }
    },
    [setActivityId],
  );

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || pendingRef.current) return;
    if (text.length > CHAT_MAX_MESSAGE_CHARS) {
      setError({
        kind: "invalid",
        message: "That message is too long. Please shorten it and try again.",
        retryable: false,
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
    };
    const next = [...messagesRef.current, userMessage];
    messagesRef.current = next;
    setMessages(next);
    setDraft("");
    setError(null);
    void requestReply(next);
  }, [draft, requestReply]);

  const retryLast = useCallback(() => {
    const history = messagesRef.current;
    const last = history[history.length - 1];
    if (!last || last.role !== "user" || pendingRef.current) return;
    void requestReply(history);
  }, [requestReply]);

  useEffect(() => {
    let active = true;
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      // The auth client is an external system. A missing configuration is the
      // only synchronous failure path, and the shell must stop showing chat.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSignedIn(false);
      return;
    }

    const applySession = (session: { user?: { id?: string } } | null) => {
      const nextUserId = session?.user?.id ?? null;
      if (
        userIdRef.current &&
        nextUserId &&
        userIdRef.current !== nextUserId
      ) {
        resetConversation();
      }
      userIdRef.current = nextUserId;
      setSignedIn(Boolean(session));
      if (!session) {
        resetConversation();
        setActivityId(null);
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) applySession(data.session);
      })
      .catch(() => {
        if (active) applySession(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      applySession(session);
    });

    const handleAuthCleared = () => {
      if (!active) return;
      userIdRef.current = null;
      setSignedIn(false);
      resetConversation();
      setActivityId(null);
    };
    window.addEventListener("bytequest:auth-cleared", handleAuthCleared);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener("bytequest:auth-cleared", handleAuthCleared);
    };
  }, [resetConversation, setActivityId]);

  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      draft,
      setDraft,
      pending,
      error,
      signedIn,
      activityId,
      setActivityId,
      sendMessage,
      retryLast,
      clearConversation: resetConversation,
      clearError,
      returnPath,
      setReturnPath,
      scrollToLatest,
      setScrollToLatest,
    }),
    [
      messages,
      draft,
      pending,
      error,
      signedIn,
      activityId,
      setActivityId,
      sendMessage,
      retryLast,
      resetConversation,
      clearError,
      returnPath,
      setReturnPath,
      scrollToLatest,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider.");
  }
  return context;
}
