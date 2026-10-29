import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  // The local dev UI is opened at 127.0.0.1:3000 while Next starts on
  // localhost, so its HMR/dev assets must be explicitly allowed.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
