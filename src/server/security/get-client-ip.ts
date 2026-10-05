// Coolify/Traefik sits in front of the app, so the socket address is the
// proxy's. Traefik overwrites X-Real-IP with the address it actually saw
// and *appends* that address to X-Forwarded-For — so only X-Real-IP or the
// LAST X-Forwarded-For entry can be trusted. The first entry is whatever
// the client chose to send; using it would let anyone dodge the login and
// signup rate limits by sending a fresh fake IP on every request.
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const last = forwardedFor.split(",").pop()?.trim();
    if (last) return last;
  }

  return "unknown";
}
