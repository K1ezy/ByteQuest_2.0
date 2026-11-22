import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api";
import { CHAT_STORAGE_KEY, contextMessages } from "./chat-session";
import { ChatProvider, useChat } from "./chat-provider";

const auth = vi.hoisted(() => ({
  user: "student",
  listener: undefined as ((event: string, session: { user: { id: string } } | null) => void) | undefined,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: auth.user } } } }),
      onAuthStateChange: (callback: typeof auth.listener) => {
        auth.listener = callback;
        return { data: { subscription: { unsubscribe: () => { auth.listener = undefined; } } } };
      },
    },
  }),
}));

const ready = {
  status: "ready",
  role: "student",
  language: "python",
  limits: { max_messages: 12, max_message_chars: 4_000, max_total_chars: 16_000 },
};
const enrollmentMessage = "The learning assistant is available once your instructor adds you to a class block.";
const examMessage = "Study help is paused during your exam.";

beforeEach(() => {
  auth.user = "student";
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockResolvedValue(ready);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openChat() {
  const hook = renderHook(useChat, { wrapper: ChatProvider });
  await waitFor(() => expect(hook.result.current.signedIn).toBe(true));
  await act(async () => hook.result.current.refreshAvailability());
  return hook;
}

function deferredReply() {
  let resolve!: (value: { reply: string }) => void;
  const promise = new Promise<{ reply: string }>((resolveReply) => { resolve = resolveReply; });
  return { promise, resolve };
}

it.each([
  ["enrollment_required", enrollmentMessage, enrollmentMessage],
  ["other_code", "Other server detail", "This account cannot use the learning assistant."],
])("maps a 403 with code %s", async (code, serverMessage, expectedMessage) => {
  const { result } = await openChat();
  vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError(serverMessage, 403, code));
  act(() => result.current.setDraft("Explain a loop invariant."));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.error).toMatchObject({
    kind: "forbidden", message: expectedMessage, retryable: false,
  }));
});

it("restores the draft, verified course sources, and safe return route for the matching account", async () => {
  const first = await openChat();
  const reply = { reply: "A loop repeats a block.", sources: [{ document_title: "Python Reader.pdf", page_number: 7 }] };
  vi.mocked(apiRequest).mockResolvedValueOnce(reply);
  act(() => {
    first.result.current.setReturnPath("/quests?track=python");
    first.result.current.setDraft("What is a loop?");
  });
  act(() => first.result.current.sendMessage());
  await waitFor(() => expect(first.result.current.messages.at(-1)?.sources).toEqual(reply.sources));
  act(() => first.result.current.setDraft("What about nested loops?"));
  first.unmount();

  const resumed = await openChat();
  expect(resumed.result.current.messages.at(-1)?.sources).toEqual(reply.sources);
  expect(resumed.result.current.draft).toBe("What about nested loops?");
  expect(resumed.result.current.returnPath).toBe("/quests?track=python");
  act(() => resumed.result.current.clearConversation());
  expect(JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) ?? "null")?.messages).toEqual([]);
  act(() => resumed.result.current.setDraft("A draft on a shared PC"));
  act(() => window.dispatchEvent(new Event("bytequest:auth-cleared")));
  expect(resumed.result.current.signedIn).toBe(false);
  expect(resumed.result.current.draft).toBe("");
  expect(sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
});

it("recovers an interrupted question after refresh and retries it once without duplicating it", async () => {
  const first = await openChat();
  const firstReply = deferredReply();
  vi.mocked(apiRequest).mockReturnValueOnce(firstReply.promise);
  act(() => first.result.current.setDraft("Explain a loop."));
  act(() => first.result.current.sendMessage());
  expect(first.result.current.pending).toBe(true);
  first.unmount();

  const resumed = await openChat();
  expect(resumed.result.current.error?.retryable).toBe(true);
  expect(resumed.result.current.pending).toBe(false);
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/chat/messages")).toHaveLength(1);
  firstReply.resolve({ reply: "A stale response" });
  vi.mocked(apiRequest).mockResolvedValueOnce({ reply: "A loop repeats a block." });
  act(() => {
    resumed.result.current.retryLast();
    resumed.result.current.retryLast();
  });
  await waitFor(() => expect(resumed.result.current.messages.map(({ content }) => content))
    .toEqual(["Explain a loop.", "A loop repeats a block."]));
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/chat/messages")).toHaveLength(2);
});

it("does not restore another account's draft and aborts replies when the account switches", async () => {
  sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
    ownerId: "other", draft: "Private draft", messages: [], returnPath: "/instructor",
  }));
  const { result } = await openChat();
  expect(result.current.draft).toBe("");
  expect(result.current.returnPath).toBeNull();
  const pending = deferredReply();
  vi.mocked(apiRequest).mockReturnValueOnce(pending.promise);
  act(() => result.current.setDraft("Private question"));
  act(() => result.current.sendMessage());
  act(() => auth.listener?.("SIGNED_IN", { user: { id: "second" } }));
  await act(async () => pending.resolve({ reply: "Private answer" }));
  expect(result.current.draft).toBe("");
  expect(result.current.messages).toEqual([]);
  expect(JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) ?? "null")?.ownerId).toBe("second");
});

it("keeps a working conversation when browser storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
  const { result } = await openChat();
  vi.mocked(apiRequest).mockResolvedValueOnce({ reply: "A variable holds a value." });
  act(() => result.current.setDraft("What is a variable?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.messages).toHaveLength(2));
});

it("waits for a fresh status after an exam pause, then lets the student retry manually", async () => {
  const { result } = await openChat();
  vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError(examMessage, 403, "exam_in_progress"));
  act(() => result.current.setDraft("What is a loop?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.availability).toBe("exam_in_progress"));
  act(() => result.current.retryLast());
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/chat/messages")).toHaveLength(1);
  await act(async () => result.current.refreshAvailability());
  vi.mocked(apiRequest).mockResolvedValueOnce({ reply: "A loop repeats a block." });
  act(() => result.current.retryLast());
  await waitFor(() => expect(result.current.messages.map(({ content }) => content))
    .toEqual(["What is a loop?", "A loop repeats a block."]));
});

it("discards a pending reply when a status recheck finds an active exam", async () => {
  const { result } = await openChat();
  const reply = deferredReply();
  vi.mocked(apiRequest).mockReturnValueOnce(reply.promise);
  act(() => result.current.setDraft("What is a loop?"));
  act(() => result.current.sendMessage());
  vi.mocked(apiRequest).mockResolvedValueOnce({ ...ready, status: "exam_in_progress" });
  await act(async () => result.current.refreshAvailability());
  await act(async () => reply.resolve({ reply: "This reply must stay hidden." }));
  expect(result.current.availability).toBe("exam_in_progress");
  expect(result.current.pending).toBe(false);
  expect(result.current.messages.map(({ content }) => content)).toEqual(["What is a loop?"]);
});

it("detaches a stale activity and retries without it", async () => {
  const { result } = await openChat();
  act(() => {
    result.current.setReturnPath("/arena/9ad5ef1d-897f-4dbe-8530-4dfc0df64483");
    result.current.setDraft("I need a hint.");
  });
  vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError("Unavailable", 404));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.error?.retryable).toBe(true));
  expect(result.current.activity).toBeNull();
  vi.mocked(apiRequest).mockResolvedValueOnce({ reply: "Consider the expected result." });
  act(() => result.current.retryLast());
  await waitFor(() => expect(result.current.messages).toHaveLength(2));
  const calls = vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/chat/messages");
  expect(calls.map(([, request]) => JSON.parse(String(request?.body)).activity_id)).toEqual([
    "9ad5ef1d-897f-4dbe-8530-4dfc0df64483", null,
  ]);
});

const savedChat = { id: "1f0c3c4e-7d2a-4c58-9a51-0f1e2d3c4b5a", title: "New chat", revision: 0, last_message_at: null };

function routeApi(handler: (path: string, init: RequestInit) => unknown) {
  vi.mocked(apiRequest).mockImplementation(async (path: string, init: RequestInit = {}) => {
    if (path === "/chat/status") return { ...ready, history_enabled: true } as never;
    return await handler(path, init) as never;
  });
}

function bodies(match: (path: string, init: RequestInit) => boolean) {
  return vi.mocked(apiRequest).mock.calls
    .filter(([path, init]) => match(path, init ?? {}))
    .map(([, init]) => JSON.parse(String(init?.body)));
}

const isSend = (path: string, init: RequestInit) => path.endsWith("/turns") && init.method === "POST";
const isCreate = (path: string, init: RequestInit) => path === "/chat/conversations" && init.method === "POST";

it("keeps the question and the cross-device explanation after refreshing a changed chat", async () => {
  const changed = { ...savedChat, revision: 1, title: "Loops" };
  routeApi((path, init) => {
    if (isCreate(path, init)) return savedChat;
    if (isSend(path, init)) throw new ApiError("This chat changed.", 409, "conversation_changed");
    if (path === "/chat/conversations/" + savedChat.id) {
      return { conversation: changed, before: null, turns: [
        { id: "laptop-turn", position: 1, question: "Asked on the laptop", reply: "Laptop reply", sources: [] },
      ] };
    }
    throw new Error("Unexpected request " + path);
  });
  const { result } = await openChat();
  act(() => result.current.setDraft("Asked on the phone"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.messages.map(({ content }) => content))
    .toEqual(["Asked on the laptop", "Laptop reply", "Asked on the phone"]));
  expect(result.current.error).toMatchObject({
    message: "This chat changed on another device. Review the latest messages before retrying.", retryable: true,
  });
  expect(result.current.conversation?.revision).toBe(1);
});

it("restores a saved reply after a lost response with one read-only check", async () => {
  routeApi((path, init) => {
    if (isCreate(path, init)) return savedChat;
    if (isSend(path, init)) throw new ApiError("Network error", 0);
    const turn = path.match(/\/turns\/(.+)$/)?.[1];
    if (turn) {
      return { status: "completed", conversation: { ...savedChat, revision: 1 }, turn: {
        id: turn, position: 1, question: "What is a loop?", reply: "A loop repeats a block.", sources: [],
      } };
    }
    throw new Error("Unexpected request " + path);
  });
  const { result } = await openChat();
  act(() => result.current.setDraft("What is a loop?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.messages.map(({ content }) => content))
    .toEqual(["What is a loop?", "A loop repeats a block."]));
  expect(result.current.error).toBeNull();
  expect(bodies(isSend)).toHaveLength(1);
  expect(vi.mocked(apiRequest).mock.calls.filter(([path]) => /\/turns\/.+/.test(path))).toHaveLength(1);
});

it("offers Check for reply while pending, then retries a missing turn with the same turn ID", async () => {
  const outcomes = ["pending", "missing"];
  let sends = 0;
  routeApi((path, init) => {
    if (isCreate(path, init)) return savedChat;
    if (isSend(path, init)) {
      sends += 1;
      if (sends === 1) throw new ApiError("Network error", 0);
      const { turn_id, question } = JSON.parse(String(init.body));
      return { conversation: { ...savedChat, revision: 1 }, turn: { id: turn_id, position: 1, question, reply: "Trace it.", sources: [] } };
    }
    if (/\/turns\/.+/.test(path)) return { status: outcomes.shift(), conversation: savedChat, turn: null };
    throw new Error("Unexpected request " + path);
  });
  const { result } = await openChat();
  act(() => result.current.setDraft("Why does my loop stop early?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.error).toMatchObject({ kind: "pending", check: true, retryable: false }));
  expect(sends).toBe(1);
  act(() => result.current.checkReply());
  await waitFor(() => expect(result.current.error).toMatchObject({ retryable: true }));
  expect(result.current.error?.check).toBeFalsy();
  expect(result.current.messages.map(({ content }) => content)).toEqual(["Why does my loop stop early?"]);
  act(() => result.current.retryLast());
  await waitFor(() => expect(result.current.messages.at(-1)?.content).toBe("Trace it."));
  const [first, retry] = bodies(isSend);
  expect(retry.turn_id).toBe(first.turn_id);
  expect(retry.question).toBe(first.question);
});

it("reuses the client chat ID after a lost create and gives an edited question a new turn ID", async () => {
  let creates = 0;
  routeApi((path, init) => {
    if (isCreate(path, init)) {
      creates += 1;
      if (creates === 1) throw new ApiError("Network error", 0);
      return { ...savedChat, id: JSON.parse(String(init.body)).id };
    }
    if (isSend(path, init)) throw new ApiError("Busy", 503, "provider_rate_limited");
    throw new Error("Unexpected request " + path);
  });
  const { result } = await openChat();
  act(() => result.current.setDraft("What is a list?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.error?.kind).toBe("network"));
  act(() => result.current.retryLast());
  await waitFor(() => expect(result.current.error).toMatchObject({
    kind: "rate_limit", message: "The assistant is busy right now. Your question is still here.",
  }));
  const [lost, retried] = bodies(isCreate);
  expect(retried.id).toBe(lost.id);
  act(() => result.current.editLast());
  act(() => result.current.setDraft("What is a Python list?"));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(bodies(isSend)).toHaveLength(2));
  const [original, edited] = bodies(isSend);
  expect(edited.turn_id).not.toBe(original.turn_id);
  expect(bodies(isCreate)).toHaveLength(2);
});

it("keeps the newest question within both configured history limits", () => {
  const messages = [
    { id: "1", role: "assistant" as const, content: "abcde" },
    { id: "2", role: "assistant" as const, content: "fghij" },
    { id: "3", role: "user" as const, content: "question?" },
  ];
  const limits = { max_messages: 2, max_message_chars: 20, max_total_chars: 12 };
  expect(contextMessages(messages, limits)).toEqual([{ role: "user", content: "question?" }]);
  expect(contextMessages(messages, { ...limits, max_total_chars: 25 })).toHaveLength(2);
});
