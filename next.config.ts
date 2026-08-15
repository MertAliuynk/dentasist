import type { NextConfig } from "next";

// 'unsafe-inline' on script-src is required for next-themes' flash-prevention
// snippet and Next.js's own hydration bootstrap; a nonce-based CSP would
// remove this but needs per-request middleware wiring. Everything else here
// is genuinely restrictive (no third-party script/style/frame origins).
// 'unsafe-eval' is added in development only — React's dev tooling uses
// eval() to reconstruct stack traces across module boundaries; without it,
// the browser blocks it and Next.js surfaces a dev-only "Issues" indicator
// covering the page. Production never calls eval(), so this never applies
// to a real deployment.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
