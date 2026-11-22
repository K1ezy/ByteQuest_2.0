import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { ChatConversation } from "./chat-conversation";
import { messageParts } from "./chat-message-content";
import { ChatProvider } from "./chat-provider";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "student" } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}));

const reply = "Use <b>print</b> like this:\n```python\nprint('<script>alert(1)</script>')\nvalues = [1, 2, 3]\n```\nThen run it.";
const writeText = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  vi.mocked(apiRequest).mockReset().mockImplementation(async (path: string) => (path === "/chat/status" ? {
    status: "ready", role: "student", language: "python",
    limits: { max_messages: 12, max_message_chars: 4_000, max_total_chars: 16_000 },
  } : { reply, sources: [{ document_title: "Python Reader.pdf", page_number: 4 }] }) as never);
});

afterEach(() => cleanup());

it("splits fenced examples from prose, including a fence cut off at the token limit", () => {
  expect(messageParts("Intro\n```py\na = 1\n```\nOutro")).toEqual([
    { code: false, text: "Intro" }, { code: true, text: "a = 1" }, { code: false, text: "Outro" },
  ]);
  expect(messageParts("Start\n```\nfor x in y:\n    print(x)\n")).toEqual([
    { code: false, text: "Start" }, { code: true, text: "for x in y:\n    print(x)" },
  ]);
  expect(messageParts("No fences, just `inline` text.")).toEqual([{ code: false, text: "No fences, just `inline` text." }]);
});

it.each(["compact", "page"] as const)("renders copyable code and literal HTML in the %s chat view", async (variant) => {
  const view = render(<ChatProvider><ChatConversation variant={variant} /></ChatProvider>);
  const input = await waitFor(() => {
    window.dispatchEvent(new Event("online"));  // Rechecks availability once the session has loaded.
    const field = view.container.querySelector("textarea");
    expect(field).not.toBeNull();
    return field!;
  });
  fireEvent.change(input, { target: { value: "How do I print a list?" } });
  fireEvent.click(view.getByRole("button", { name: "Send" }));
  const code = await waitFor(() => view.getByLabelText("Code example"));

  expect(code.textContent).toBe("print('<script>alert(1)</script>')\nvalues = [1, 2, 3]");
  const bubble = code.closest(".chat-bubble")!;
  expect(bubble.querySelector("b, script")).toBeNull();
  expect(bubble.textContent).toContain("Use <b>print</b> like this:");
  expect(bubble.textContent).toContain("Then run it.");
  expect(view.getByText("Python Reader.pdf, p. 4")).toBeTruthy();

  await act(async () => fireEvent.click(view.getByRole("button", { name: "Copy code" })));
  expect(writeText).toHaveBeenCalledWith("print('<script>alert(1)</script>')\nvalues = [1, 2, 3]");
  expect(view.getByRole("button", { name: "Copied" })).toBeTruthy();
  expect(view.getByText("Code copied to the clipboard.").getAttribute("role")).toBe("status");

  writeText.mockRejectedValueOnce(new Error("Denied"));
  await act(async () => fireEvent.click(view.getByRole("button", { name: "Copied" })));
  expect(view.getByText("Couldn't copy the code.")).toBeTruthy();
});
