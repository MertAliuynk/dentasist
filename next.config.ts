import type { NextConfig } from "next";

// Content-Security-Policy is set per request in src/proxy.ts, not here:
// it must include the storage origin (S3_PUBLIC_ENDPOINT), which is only
// known at runtime — headers() below is frozen at build time.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS only (Coolify terminates TLS); never sent in dev over plain http.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
