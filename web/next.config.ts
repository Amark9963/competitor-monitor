import type { NextConfig } from "next";

// The Python API (python -m competitor_monitor serve) is proxied under /api so the
// browser talks to one origin and no CORS configuration is needed.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
