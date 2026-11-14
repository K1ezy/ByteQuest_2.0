import { afterEach, expect, it, vi } from "vitest";
import { AuthClient } from "@supabase/auth-js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("keeps the session key, auth URL and API key headers that existing sign-ins depend on", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15431");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");
  const { getSupabase } = await import("./supabase");

  const auth = getSupabase().auth as unknown as {
    url: string;
    storageKey: string;
    headers: Record<string, string>;
    flowType: string;
  };

  expect(auth).toBeInstanceOf(AuthClient);
  // A different key would sign every open tab out after a deploy.
  expect(auth.storageKey).toBe("sb-127-auth-token");
  expect(auth.url).toBe("http://127.0.0.1:15431/auth/v1");
  expect(auth.headers).toMatchObject({ apikey: "public-anon-key", Authorization: "Bearer public-anon-key" });
  expect(auth.flowType).toBe("implicit");
});
