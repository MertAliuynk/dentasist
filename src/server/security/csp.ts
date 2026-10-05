// Content-Security-Policy, built at runtime so it can allow the object
// storage origin: X-ray / support images are uploaded (PUT) and shown
// straight from S3_PUBLIC_ENDPOINT via presigned URLs, which a plain
// 'self' policy would block.
//
// 'unsafe-inline' on script-src is required for next-themes' flash-prevention
// snippet and Next.js's own hydration bootstrap; a nonce-based CSP would
// remove it. Everything else is genuinely restrictive. 'unsafe-eval' is
// development-only (React dev tooling rebuilds stack traces with eval()).

function storageOrigins(): string {
  const origins = [process.env.S3_PUBLIC_ENDPOINT, process.env.S3_ENDPOINT]
    .map((u) => {
      try {
        return u ? new URL(u).origin : null;
      } catch {
        return null;
      }
    })
    // The internal docker hostname is useless to a browser.
    .filter((o): o is string => !!o && !o.includes("://storage:"));
  return [...new Set(origins)].join(" ");
}

let cached: string | null = null;

export function contentSecurityPolicy(): string {
  if (cached) return cached;
  const storage = storageOrigins();
  const extra = storage ? ` ${storage}` : "";
  cached = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extra}`,
    "font-src 'self' data:",
    `connect-src 'self'${extra}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
  return cached;
}
