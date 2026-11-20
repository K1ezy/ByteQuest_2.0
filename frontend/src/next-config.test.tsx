import { afterEach, expect, it, vi } from "vitest";
import config from "../next.config";

afterEach(() => vi.unstubAllEnvs());

it.each(["production", "development"])("sets security headers in %s", async (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  const [rule] = await config.headers!();
  expect(rule.source).toBe("/:path*");
  expect(Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]))).toEqual({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    ...(environment === "production" ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  });
});
