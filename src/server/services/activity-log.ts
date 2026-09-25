import { db } from "@/server/db";

// Keys whose values must never reach the log, matched case-insensitively
// against every nested object key.
const SECRET_KEY = /pass(word)?|sifre|şifre|token|secret|apikey|api_key/i;
const MAX_STRING = 500;
const MAX_INPUT_BYTES = 8_000;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[…]";
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map((v) => redact(v, depth + 1));
    return value.length > 50 ? [...items, `… +${value.length - 50}`] : items;
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[gizli]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeInput(input: unknown) {
  if (input === undefined) return undefined;
  try {
    const cleaned = JSON.parse(JSON.stringify(redact(input)));
    const size = JSON.stringify(cleaned).length;
    return size > MAX_INPUT_BYTES ? { _truncated: true, _bytes: size } : cleaned;
  } catch {
    return { _unserializable: true };
  }
}

export type ActivityEntry = {
  organizationId: string;
  userId?: string | null;
  userName?: string | null;
  path: string;
  kind: "mutation" | "query" | "auth";
  input?: unknown;
  ok: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number;
  ip?: string | null;
};

/**
 * Fire-and-forget: logging must never slow down or break the request it
 * describes, so failures here are swallowed (and printed server-side).
 */
export function recordActivity(entry: ActivityEntry) {
  db.activityLog
    .create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        path: entry.path,
        kind: entry.kind,
        input: sanitizeInput(entry.input) as never,
        ok: entry.ok,
        errorCode: entry.errorCode ?? null,
        errorMessage: entry.errorMessage?.slice(0, 4000) ?? null,
        durationMs: entry.durationMs,
        ip: entry.ip ?? null,
      },
    })
    .catch((err) => console.error("[activity-log] yazılamadı:", err));
}
