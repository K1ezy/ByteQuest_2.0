import { apiRequest } from "@/lib/api";
import type { ChatMessage, ChatSource } from "./chat-session";

export type ChatMode = "saved" | "temporary";
export type ConversationSummary = { id: string; title: string; revision: number; last_message_at: string | null };
type SavedTurn = { id: string; position: number; question: string; reply: string; sources: ChatSource[] };
type ConversationPage = { items: ConversationSummary[]; next_offset: number | null };
type Transcript = { conversation: ConversationSummary; turns: SavedTurn[]; before: number | null };
export type SavedReply = { conversation: ConversationSummary; turn: SavedTurn };
type TurnStatus = { status: "completed" | "pending" | "missing"; conversation: ConversationSummary; turn: SavedTurn | null };

const root = "/chat/conversations";

export const chatHistory = {
  list(query: string, offset: number, signal: AbortSignal) {
    const params = new URLSearchParams({ q: query, offset: String(offset) });
    return apiRequest<ConversationPage>(root + "?" + params, { signal });
  },
  create(id: string, signal: AbortSignal) {
    return apiRequest<ConversationSummary>(root, { method: "POST", body: JSON.stringify({ id }), signal });
  },
  turn(id: string, turnId: string, signal: AbortSignal) {
    return apiRequest<TurnStatus>(root + "/" + id + "/turns/" + turnId, { signal });
  },
  read(id: string, signal: AbortSignal, before?: number) {
    return apiRequest<Transcript>(root + "/" + id + (before ? "?before=" + before : ""), { signal });
  },
  send(conversation: ConversationSummary, question: ChatMessage, activityId: string | null, signal: AbortSignal) {
    return apiRequest<SavedReply>(root + "/" + conversation.id + "/turns", {
      method: "POST", signal,
      body: JSON.stringify({ turn_id: question.id, question: question.content, activity_id: activityId, expected_revision: conversation.revision }),
    });
  },
  rename(id: string, title: string, signal: AbortSignal) {
    return apiRequest<ConversationSummary>(root + "/" + id, { method: "PATCH", body: JSON.stringify({ title }), signal });
  },
  remove(id: string | null, signal: AbortSignal) {
    return apiRequest<void>(id ? root + "/" + id : root, { method: "DELETE", signal });
  },
};

export function turnMessages(turn: SavedTurn): ChatMessage[] {
  return [
    { id: turn.id, role: "user", content: turn.question },
    { id: turn.id + "-reply", role: "assistant", content: turn.reply, sources: turn.sources },
  ];
}
