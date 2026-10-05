import { db } from "@/server/db";

// Housekeeping that keeps unbounded tables in check. ActivityLog gets a row
// for every mutation and every failure, so without pruning it becomes the
// largest table in the database within months.

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 5000;

export async function pruneActivityLog(retentionDays = Number(process.env.ACTIVITY_LOG_RETENTION_DAYS) || 90) {
  const cutoff = new Date(Date.now() - retentionDays * DAY);
  let total = 0;
  // Small batches: never one giant DELETE that locks the table / bloats WAL.
  for (;;) {
    const deleted = await db.$executeRaw`
      DELETE FROM "ActivityLog"
      WHERE id IN (SELECT id FROM "ActivityLog" WHERE "createdAt" < ${cutoff} LIMIT ${BATCH})`;
    total += deleted;
    if (deleted < BATCH) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (total > 0) console.log(`[maintenance] ${total} eski işlem kaydı silindi (> ${retentionDays} gün).`);
  return total;
}

let started = false;

export function startMaintenance() {
  if (started) return;
  started = true;
  const run = () => pruneActivityLog().catch((e) => console.error("[maintenance] temizlik başarısız:", e));
  setTimeout(run, 60_000).unref?.();
  setInterval(run, 6 * 60 * 60 * 1000).unref?.();
}
