import type { NextConfig } from "next";

// /api/* is handled by src/app/api/[...path]/route.ts: it proxies to the Python API
// (API_URL, default http://127.0.0.1:8000) or, with DEMO_MODE=1, serves the bundled
// snapshot so the dashboard can be deployed on its own (e.g. Vercel).
const nextConfig: NextConfig = {};

export default nextConfig;
