import { z } from "zod";
import type { Session } from "next-auth";
import { auth } from "@/server/auth";
import { recordActivity } from "@/server/services/activity-log";
import { newErrorRef } from "@/server/trpc/error-format";
import { checkRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/get-client-ip";

// Error screens (error.tsx) report browser-side crashes here so they land in
// the same ActivityLog as server errors, and get a ref the user can quote.
// A plain route (not tRPC) on purpose: it must work even when the thing
// that broke is the tRPC client itself.

const body = z.object({
  message: z.string().max(2000).default(""),
  stack: z.string().max(4000).optional(),
  path: z.string().max(500).default(""),
  digest: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`client-error:${ip}`, 30, 10 * 60 * 1000).allowed) {
    return Response.json({ ref: null }, { status: 429 });
  }
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ref: null }, { status: 400 });
  const { message, stack, path, digest } = parsed.data;

  // Server render errors are already logged (instrumentation onRequestError)
  // under their digest; don't duplicate them.
  if (digest) return Response.json({ ref: digest });

  // Best effort: an error report must never itself fail on auth.
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  const ref = newErrorRef();
  recordActivity({
    organizationId: session?.user?.organizationId || null,
    userId: session?.user?.id ?? null,
    userName: session?.user?.name ?? null,
    ref,
    path: `sayfa ${path}`,
    kind: "client",
    ok: false,
    errorCode: "CLIENT_ERROR",
    errorMessage: [message, stack?.split("\n").slice(0, 6).join("\n")].filter(Boolean).join("\n"),
    ip,
  });
  return Response.json({ ref });
}
