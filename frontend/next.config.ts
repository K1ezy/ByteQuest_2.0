import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // The local dev UI is opened at 127.0.0.1:3000 while Next starts on
  // localhost, so its HMR/dev assets must be explicitly allowed.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  logging: {
    incomingRequests: {
      ignore: [/\/workshops\/join\//i, /\/onboarding\?.*%2fworkshops%2fjoin%2f/i],
    },
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }
    return [
      { source: "/:path*", headers },
      { source: "/workshops/join/:code", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/faculty/accessibility", destination: "/account/accessibility", permanent: true },
      { source: "/admin/accessibility", destination: "/account/accessibility", permanent: true },
      { source: "/faculty/:path*", destination: "/instructor/:path*", permanent: true },
      ...Object.entries({ leaderboard: "/leaderboard", journey: "/dashboard", "activity-hub": "/workshops", accessibility: "/account/accessibility" })
        .map(([value, destination]) => ({
          source: "/quests", has: [{ type: "query" as const, key: "view", value }],
          destination, permanent: true,
        })),
      { source: "/quests", has: [{ type: "query", key: "group" }], missing: [{ type: "query", key: "view" }], destination: "/workshops", permanent: true },
    ];
  },
};

export default nextConfig;
