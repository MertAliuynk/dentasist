import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Liveness/readiness probe for the Docker healthcheck and uptime monitors.
// 200 only when the app can actually reach Postgres; deliberately reveals
// nothing beyond up/down.
export async function GET() {
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), 3000)),
    ]);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
