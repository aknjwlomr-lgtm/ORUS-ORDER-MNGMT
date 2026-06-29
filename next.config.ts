import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.127"],
  experimental: {
    // Allow Server Actions (order save, status changes, etc.) to be invoked when
    // the app is opened from the LAN IP on a phone — not just localhost. Without
    // this, the action POST is rejected and the form shows "server unreachable".
    serverActions: {
      allowedOrigins: ["192.168.0.127:3000", "192.168.0.127"],
    },
  },
  // Hide the on-screen Next.js dev indicator (the floating "N" badge).
  devIndicators: false,
};

export default nextConfig;
