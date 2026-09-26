// Runs once per server process at startup (Next.js instrumentation hook).
// Hosts the SMS automation loop — the app is deployed as a single
// long-lived container, so an in-process interval is enough; the
// SmsDelivery claim keeps it safe even if more instances are ever added.
// Set SMS_REMINDER_WORKER=off to disable (e.g. on a secondary instance).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SMS_REMINDER_WORKER === "off") return;
  const { startAutomationWorker } = await import("@/server/sms/automations");
  startAutomationWorker();
}

/**
 * Server-side render/route crashes. The user's error screen shows the same
 * `digest` as its reference code, so it's the ActivityLog `ref` here.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = err as Error & { digest?: string };
  // notFound()/redirect() are control flow, not errors.
  if (e?.digest?.startsWith("NEXT_")) return;
  const { recordActivity } = await import("@/server/services/activity-log");
  recordActivity({
    organizationId: null,
    ref: e?.digest ?? null,
    path: `${context.routeType} ${request.path}`,
    kind: "render",
    ok: false,
    errorCode: "RENDER_ERROR",
    errorMessage: [e?.message, e?.stack?.split("\n").slice(1, 6).join("\n")].filter(Boolean).join("\n"),
  });
}
