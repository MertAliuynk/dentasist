import type { db as Db } from "@/server/db";

export async function logAudit(
  db: typeof Db,
  organizationId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  diff?: object,
) {
  await db.auditLog.create({
    data: {
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      diff: diff ? JSON.parse(JSON.stringify(diff)) : undefined,
    },
  });
}
