import { defineConfig } from "@playwright/test";

const existingServer = process.env.BQ_LAYOUT_BASE;
const baseURL = existingServer ?? "http://127.0.0.1:3102";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Layout tests require a loopback frontend.");
}

export default defineConfig({
  testDir: "./layout-tests",
  testMatch: "**/*.layout.ts",
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: { executablePath: process.env.BQ_LAYOUT_BROWSER },
    screenshot: "only-on-failure",
  },
  webServer: existingServer ? undefined : {
    command: "npm run start -- --hostname 127.0.0.1 --port 3102",
    url: baseURL,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "narrow", use: { viewport: { width: 320, height: 800 }, hasTouch: true } },
    { name: "large-text", use: { viewport: { width: 1280, height: 900 } } },
  ],
});
