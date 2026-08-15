import type { db as Db } from "@/server/db";

export async function notifyTeknisyenInBranch(
  db: typeof Db,
  organizationId: string,
  branchId: string,
  labTreatmentId: string,
  message: string,
) {
  const teknisyenler = await db.user.findMany({
    where: {
      organizationId,
      deletedAt: null,
      memberships: { some: { role: "TEKNISYEN", branchId } },
    },
    select: { id: true },
  });
  if (teknisyenler.length === 0) return;
  await db.labNotification.createMany({
    data: teknisyenler.map((t) => ({ organizationId, recipientUserId: t.id, labTreatmentId, message })),
  });
}

export async function notifyUser(
  db: typeof Db,
  organizationId: string,
  recipientUserId: string,
  labTreatmentId: string,
  message: string,
) {
  await db.labNotification.create({
    data: { organizationId, recipientUserId, labTreatmentId, message },
  });
}
