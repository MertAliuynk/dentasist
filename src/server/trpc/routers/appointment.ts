import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";
import { logAudit } from "@/server/services/audit";
import { addDays, trAt, trDay } from "@/lib/tr-time";

async function resolveDoctorId(db: typeof import("@/server/db").db, userId: string) {
  const doctor = await db.doctor.findUnique({ where: { userId } });
  return doctor?.id;
}

async function assertNotBlocked(
  db: typeof import("@/server/db").db,
  organizationId: string,
  doctorId: string,
  roomId: string | null,
  startsAt: Date,
  endsAt: Date,
) {
  const block = await db.appointmentBlock.findFirst({
    where: {
      organizationId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      OR: [{ doctorId }, ...(roomId ? [{ roomId }] : [])],
    },
  });
  if (block) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: block.reason ? `Bu saat aralığı kapatılmış: ${block.reason}` : "Bu saat aralığı kapatılmış.",
    });
  }
}

/** Today's bounds in Turkey time — the server runs in UTC, so setHours(0) would be 03:00 TR. */
function trTodayBounds() {
  const today = trDay(new Date());
  return { start: trAt(today, "00:00"), end: new Date(trAt(addDays(today, 1), "00:00").getTime() - 1) };
}

function isDoctorOnly(roles: string[]) {
  const set = new Set(roles);
  return set.size === 1 && set.has("DOKTOR");
}

export const appointmentRouter = router({
  listRange: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ start: z.string(), end: z.string(), doctorId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const roles = ctx.session.user.memberships.map((m) => m.role);
      const doctorOnly = isDoctorOnly(roles);
      const scopedDoctorId = doctorOnly
        ? await resolveDoctorId(ctx.db, ctx.session.user.id)
        : input.doctorId;

      return ctx.db.appointment.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          // Overlap, not containment — an appointment spanning across the
          // range boundary (e.g. crossing midnight) must still show up.
          startsAt: { lt: new Date(input.end) },
          endsAt: { gt: new Date(input.start) },
          ...(scopedDoctorId ? { doctorId: scopedDoctorId } : {}),
          // A deleted patient's future appointments shouldn't keep haunting
          // the calendar.
          patient: { deletedAt: null },
        },
        include: {
          patient: true,
          doctor: { include: { user: true } },
          room: true,
        },
        orderBy: { startsAt: "asc" },
      });
    }),

  // "Sıradaki Randevu" — for every doctor who still has an unhandled
  // (SCHEDULED) appointment today, their earliest one plus how many more
  // are waiting. Doctors with nothing left today don't appear at all.
  // ARRIVED/NO_SHOW/… are "handled", so a doctor's card moves on to their
  // next patient as soon as the current one is marked.
  nextUpcoming: protectedProcedure.use(requireEntitlement("DENTAL")).query(async ({ ctx }) => {
    const roles = ctx.session.user.memberships.map((m) => m.role);
    const doctorOnly = isDoctorOnly(roles);
    const scopedDoctorId = doctorOnly ? await resolveDoctorId(ctx.db, ctx.session.user.id) : undefined;
    if (doctorOnly && !scopedDoctorId) return [];

    const { start, end } = trTodayBounds();
    const pending = await ctx.db.appointment.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        startsAt: { gte: start, lte: end },
        status: "SCHEDULED",
        ...(scopedDoctorId ? { doctorId: scopedDoctorId } : {}),
        patient: { deletedAt: null },
      },
      include: { patient: true, doctor: { include: { user: true } }, room: true },
      orderBy: { startsAt: "asc" },
    });

    const byDoctor = new Map<string, { appointment: (typeof pending)[number]; remaining: number }>();
    for (const a of pending) {
      const cur = byDoctor.get(a.doctorId);
      if (cur) cur.remaining++;
      else byDoctor.set(a.doctorId, { appointment: a, remaining: 0 });
    }
    return [...byDoctor.values()].map(({ appointment, remaining }) => ({ ...appointment, remainingAfter: remaining }));
  }),

  // "Randevu Takvimim — Bugünün özeti": every one of today's appointments
  // (all statuses) with its doctor, so the list shows whose patient it is.
  todaySummary: protectedProcedure.use(requireEntitlement("DENTAL")).query(async ({ ctx }) => {
    const roles = ctx.session.user.memberships.map((m) => m.role);
    const doctorOnly = isDoctorOnly(roles);
    const scopedDoctorId = doctorOnly ? await resolveDoctorId(ctx.db, ctx.session.user.id) : undefined;
    if (doctorOnly && !scopedDoctorId) return [];

    const { start, end } = trTodayBounds();
    return ctx.db.appointment.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        startsAt: { gte: start, lte: end },
        ...(scopedDoctorId ? { doctorId: scopedDoctorId } : {}),
        patient: { deletedAt: null },
      },
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
      take: 200,
    });
  }),
  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:appointment:write"))
    .input(
      z.object({
        patientId: z.string(),
        doctorId: z.string(),
        branchId: z.string(),
        roomId: z.string().optional(),
        startsAt: z.string(),
        endsAt: z.string(),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);

      const [patient, doctor, room] = await Promise.all([
        ctx.db.patient.findFirst({
          where: { id: input.patientId, organizationId: ctx.session.user.organizationId, deletedAt: null },
          select: { id: true },
        }),
        ctx.db.doctor.findFirst({
          where: { id: input.doctorId, organizationId: ctx.session.user.organizationId, deletedAt: null },
          select: { id: true },
        }),
        input.roomId
          ? ctx.db.room.findFirst({
              where: { id: input.roomId, organizationId: ctx.session.user.organizationId, branchId: input.branchId, deletedAt: null },
              select: { id: true },
            })
          : null,
      ]);
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });
      if (!doctor) throw new TRPCError({ code: "NOT_FOUND", message: "Doktor bulunamadı." });
      if (input.roomId && !room) throw new TRPCError({ code: "NOT_FOUND", message: "Oda bulunamadı." });

      await assertNotBlocked(
        ctx.db,
        ctx.session.user.organizationId,
        input.doctorId,
        input.roomId ?? null,
        new Date(input.startsAt),
        new Date(input.endsAt),
      );

      return ctx.db.appointment.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          branchId: input.branchId,
          patientId: input.patientId,
          doctorId: input.doctorId,
          roomId: input.roomId || null,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          note: input.note || null,
        },
      });
    }),

  reschedule: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:appointment:write"))
    .input(z.object({ id: z.string(), startsAt: z.string(), endsAt: z.string(), doctorId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const existing = await ctx.db.appointment.findFirst({
        where: { id: input.id, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
        select: { doctorId: true, roomId: true, branchId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      // Dragging an appointment onto a different doctor's column/row
      // reassigns it — only within the same branch the appointment (and the
      // dragged-to doctor) already belong to.
      let nextDoctorId = existing.doctorId;
      if (input.doctorId && input.doctorId !== existing.doctorId) {
        const doctor = await ctx.db.doctor.findFirst({
          where: { id: input.doctorId, organizationId, branchId: existing.branchId, deletedAt: null },
        });
        if (!doctor) throw new TRPCError({ code: "NOT_FOUND", message: "Hekim bulunamadı." });
        nextDoctorId = doctor.id;
      }

      await assertNotBlocked(
        ctx.db,
        organizationId,
        nextDoctorId,
        existing.roomId,
        new Date(input.startsAt),
        new Date(input.endsAt),
      );

      const { count } = await ctx.db.appointment.updateMany({
        where: {
          id: input.id,
          ...branchScopeWhere(organizationId, ctx.accessibleBranchIds),
        },
        data: {
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          doctorId: nextDoctorId,
        },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:appointment:write"))
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["SCHEDULED", "ARRIVED", "NO_SHOW", "POSTPONED", "COMPLETED", "CANCELED"]),
        note: z.string().trim().max(2000).optional(),
        roomId: z.string().optional().nullable(),
        // When marking a visit ARRIVED, optionally also mark one of the
        // patient's approved treatments COMPLETED in the same action — the
        // dashboard's "Sıradaki Randevu" card offers a treatment picker
        // instead of a separate, context-free "Tedavi Bitti" button.
        completeTreatmentId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const appointment = await ctx.db.appointment.findFirst({
        where: { id: input.id, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
        select: { branchId: true, patientId: true },
      });
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.roomId) {
        const room = await ctx.db.room.findFirst({
          where: { id: input.roomId, organizationId, branchId: appointment.branchId, deletedAt: null },
        });
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "Oda bulunamadı." });
      }

      let treatment: { id: string } | null = null;
      if (input.completeTreatmentId) {
        if (input.status !== "ARRIVED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tedavi tamamlama yalnızca 'Geldi' durumuyla birlikte yapılabilir." });
        }
        treatment = await ctx.db.treatment.findFirst({
          where: {
            id: input.completeTreatmentId,
            organizationId,
            patientId: appointment.patientId,
            status: "APPROVED",
          },
          select: { id: true },
        });
        if (!treatment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Seçilen tedavi bulunamadı veya onaylı durumda değil." });
        }
      }

      await ctx.db.$transaction(async (tx) => {
        const { count } = await tx.appointment.updateMany({
          where: { id: input.id, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
          data: {
            status: input.status,
            ...(input.note !== undefined ? { note: input.note } : {}),
            ...(input.roomId !== undefined ? { roomId: input.roomId || null } : {}),
            ...(treatment ? { completedTreatmentId: treatment.id } : {}),
          },
        });
        if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });

        if (treatment) {
          await tx.treatment.update({
            where: { id: treatment.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }
      });

      if (input.status !== "SCHEDULED") {
        await logAudit(
          ctx.db,
          organizationId,
          ctx.session.user.id,
          "appointment.status_changed",
          "Appointment",
          input.id,
          { status: input.status, completedTreatmentId: treatment?.id },
        );
      }

      return { success: true };
    }),
});
