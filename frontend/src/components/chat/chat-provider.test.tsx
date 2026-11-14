import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api";
import { ChatProvider, useChat } from "./chat-provider";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "student" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

afterEach(cleanup);

const enrollmentMessage = "The learning assistant is available once your instructor adds you to a class block.";

it.each([
  ["enrollment_required", enrollmentMessage, enrollmentMessage],
  ["other_code", "Other server detail", "This account cannot use the learning assistant."],
])("maps a 403 with code %s", async (code, serverMessage, expectedMessage) => {
  vi.mocked(apiRequest).mockRejectedValueOnce(new ApiError(serverMessage, 403, code));
  const { result } = renderHook(useChat, { wrapper: ChatProvider });
  await waitFor(() => expect(result.current.signedIn).toBe(true));
  act(() => result.current.setDraft("Explain a loop invariant."));
  act(() => result.current.sendMessage());
  await waitFor(() => expect(result.current.error).toEqual({
    kind: "forbidden",
    message: expectedMessage,
    retryable: false,
  }));
});
