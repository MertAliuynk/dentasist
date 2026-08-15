// Coolify/Traefik sits in front of the app, so the real client IP arrives
// via X-Forwarded-For (first entry) rather than a direct socket address.
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
