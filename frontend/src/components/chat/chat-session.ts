import { belongsTo, internalPath, isStudentExamView } from "@/lib/navigation";
import type { ChatMode } from "./chat-history";

export type ActivityContext = { id: string; kind: "arena" | "quiz" };
export type ChatSource = { document_title: string; page_number: number };
export type ChatReply = { reply: string; sources?: ChatSource[]; consulted_sources?: ChatSource[] };
export type ChatPdfAttachment = {
  filename: string;
  excerpts: { page_number: number; text: string }[];
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  consulted_sources?: ChatSource[];
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

const PDF_STOP_WORDS = new Set(
  "about all also am an and another answer are as ask be briefly by can challenge chapter coding could did do document does example explain file for from generate get give have help how in into is it key lesson main make me more of on or page pages pdf please practice question questions quiz short show something summary summarize summarise tell than that the their then there these they this to use using was were what when where which why will with work works would you your".split(" "),
);

function pdfWords(text: string) {
  return (text.toLowerCase().match(/[\p{L}_][\p{L}\p{N}_+#]+/gu) ?? [])
    .filter((term) => !PDF_STOP_WORDS.has(term))
    .map((term) => term.length > 4 ? term.replace(/(?:ing|ed|s|e)$/u, "") : term);
}

export function pdfEvidence(attachment: ChatPdfAttachment, messages: ReturnType<typeof contextMessages>): ChatPdfAttachment {
  const question = messages.at(-1)?.content ?? "";
  const followUp = /^(?:why|how so|what else|more)\W*$|\b(another|that|those|it|previous|again)\b/i.test(question);
  const earlier = followUp ? messages.slice(0, -1).findLast((message) => message.role === "user") : undefined;
  const pageReference = /\b(?:pages?\s+|p\.\s*)(\d{1,3})(?:\s*(?:[-–]|to)\s*(\d{1,3}))?/i;
  const pageMatch = question.match(pageReference) ?? earlier?.content.match(pageReference);
  if (pageMatch) {
    const start = Number(pageMatch[1]);
    const end = Number(pageMatch[2] ?? start);
    return { filename: attachment.filename, excerpts: attachment.excerpts
      .filter(({ page_number }) => page_number >= start && page_number <= end).slice(0, 4) };
  }

  const terms = new Set(pdfWords(question));
  const earlierTerms = new Set(pdfWords(earlier?.content ?? ""));
  const overview = (!terms.size && !earlierTerms.size) || /\b(?:whole (?:pdf|lesson|document)|all about|key ideas)\b/i.test(question);
  if (overview) {
    const pages = attachment.excerpts.filter((excerpt, i, excerpts) =>
      excerpt.page_number !== excerpts[i - 1]?.page_number && !/^(?:acknowledg|copyright)/i.test(excerpt.text),
    );
    const count = Math.min(pages.length, 8);
    return { filename: attachment.filename, excerpts: Array.from({ length: count }, (_, i) => {
      const page = pages[Math.round(i * (pages.length - 1) / Math.max(1, count - 1))];
      return { ...page, text: page.text.slice(0, 650) };
    }) };
  }

  const relevant = attachment.excerpts.map((excerpt) => {
    const counts = new Map<string, number>();
    for (const term of pdfWords(excerpt.text)) counts.set(term, (counts.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of terms) {
      const matches = counts.get(term) ?? 0;
      if (matches) score += 4 + Math.min(matches - 1, 2);
    }
    for (const term of earlierTerms) if (counts.has(term)) score += 1;
    return { excerpt, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.excerpt.page_number - a.excerpt.page_number);
  return { filename: attachment.filename, excerpts: relevant.slice(0, 4).map(({ excerpt }) => excerpt) };
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
    && typeof message.content === "string" && [message.sources, message.consulted_sources].every((pages) =>
      pages === undefined || (Array.isArray(pages) && pages.every((source) => source
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
