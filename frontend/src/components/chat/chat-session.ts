import { belongsTo, internalPath, isStudentExamView } from "@/lib/navigation";
import type { ChatMode } from "./chat-history";

export type ActivityContext = { id: string; kind: "arena" | "quiz" };
export type ChatSource = { document_title: string; page_number: number };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

export type ChatLimits = {
  max_messages: number;
  max_message_chars: number;
  max_total_chars: number;
};

export const CHAT_STORAGE_KEY = "bytequest:chat:conversation:v1";
export const MAX_SAVED_MESSAGES = 50;
export const DEFAULT_LIMITS: ChatLimits = {
  max_messages: 12, max_message_chars: 4_000, max_total_chars: 16_000,
};

const ACTIVITY_PATH = /^\/(arena|quiz)\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i;

export function activityFromPath(path: string | null): ActivityContext | null {
  const match = path && internalPath(path)?.pathname.match(ACTIVITY_PATH);
  if (!match) return null;
  return { kind: match[1] === "arena" ? "arena" : "quiz", id: match[2] };
}

export function safeChatReturnPath(value: string | null): string | null {
  const url = internalPath(value);
  if (!url || url.pathname === "/" || isStudentExamView(url.pathname, url.searchParams.get("category")) || ["/chat", "/onboarding", "/reset-password"].some(
    (root) => belongsTo(url.pathname, root),
  )) return null;
  return url.pathname + url.search + url.hash;
}

export function contextMessages(messages: ChatMessage[], limits: ChatLimits) {
  const selected: { role: ChatMessage["role"]; content: string }[] = [];
  let total = 0;
  for (const message of messages.slice(-limits.max_messages).reverse()) {
    if (message.content.length > limits.max_message_chars || total + message.content.length > limits.max_total_chars) break;
    selected.push({ role: message.role, content: message.content });
    total += message.content.length;
  }
  return selected.reverse();
}

export type ChatSnapshot = {
  ownerId: string;
  messages: ChatMessage[];
  draft: string;
  returnPath: string | null;
  detachedActivity: string | null;
  lastActivityId: string | null;
  mode: ChatMode;
  conversationId: string | null;
  savedDrafts: Record<string, string>;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === "string" && (message.role === "user" || message.role === "assistant")
    && typeof message.content === "string" && (message.sources === undefined || (
      Array.isArray(message.sources) && message.sources.every((source) => source
        && typeof source.document_title === "string" && Number.isInteger(source.page_number)
        && source.page_number > 0)
    ));
}

export function loadChatSnapshot(ownerId: string): ChatSnapshot | null {
  try {
    const snapshot = JSON.parse(window.sessionStorage.getItem(CHAT_STORAGE_KEY) ?? "null") as Partial<ChatSnapshot> | null;
    if (snapshot?.ownerId !== ownerId || typeof snapshot.draft !== "string" || !Array.isArray(snapshot.messages)
      || !snapshot.messages.every(isChatMessage)) return null;
    return {
      ownerId,
      messages: snapshot.messages.slice(-MAX_SAVED_MESSAGES),
      draft: snapshot.draft,
      returnPath: safeChatReturnPath(typeof snapshot.returnPath === "string" ? snapshot.returnPath : null),
      detachedActivity: typeof snapshot.detachedActivity === "string" ? snapshot.detachedActivity : null,
      lastActivityId: typeof snapshot.lastActivityId === "string" ? snapshot.lastActivityId : null,
      mode: snapshot.mode === "saved" || (snapshot.mode === undefined && !snapshot.messages.length && !snapshot.draft)
        ? "saved" : "temporary",
      conversationId: typeof snapshot.conversationId === "string" && /^[0-9a-f-]{36}$/i.test(snapshot.conversationId) ? snapshot.conversationId : null,
      savedDrafts: Object.fromEntries(Object.entries(snapshot.savedDrafts ?? {}).filter(([id, draft]) =>
        /^[0-9a-f-]{36}$/i.test(id) && typeof draft === "string").slice(-25)),
    };
  } catch {
    return null;
  }
}

export function saveChatSnapshot(snapshot: ChatSnapshot | null) {
  try {
    if (snapshot) window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(snapshot));
    else window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // The current conversation still works when tab storage is blocked or full.
  }
}
