import { afterEach, expect, it, vi } from "vitest";
import { newRequestId, reachableServiceUrl } from "./network";

const originalLocation = window.location;
function openPageAt(url: string) {
  Object.defineProperty(window, "location", { value: new URL(url), configurable: true });
}

afterEach(() => {
  Object.defineProperty(window, "location", { value: originalLocation, configurable: true });
  vi.unstubAllGlobals();
});

it("keeps loopback service URLs on this PC", () => {
  openPageAt("http://127.0.0.1:3000/dashboard");
  expect(reachableServiceUrl("http://127.0.0.1:8001/api/v1")).toBe("http://127.0.0.1:8001/api/v1");
});

it("points loopback services at the page's host when opened over ZeroTier", () => {
  openPageAt("http://10.147.17.210:3000/dashboard");
  expect(reachableServiceUrl("http://127.0.0.1:8001/api/v1")).toBe("http://10.147.17.210:8001/api/v1");
  expect(reachableServiceUrl("http://127.0.0.1:15431")).toBe("http://10.147.17.210:15431");
  // Non-loopback (real hosted) services are never rewritten.
  expect(reachableServiceUrl("https://api.example.test/api/v1")).toBe("https://api.example.test/api/v1");
});

it("makes valid v4 ids where randomUUID is unavailable (plain HTTP on a phone)", () => {
  vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });
  const id = newRequestId();
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  vi.stubGlobal("crypto", undefined);
  expect(newRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
