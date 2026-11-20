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
