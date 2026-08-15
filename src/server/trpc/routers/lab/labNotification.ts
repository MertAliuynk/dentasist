import { z } from "zod";
import { router, protectedProcedure, requireEntitlement } from "@/server/trpc/trpc";

export const labNotificationRouter = router({
  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.labNotification.findMany({
      where: { recipientUserId: ctx.session.user.id },
      include: { labTreatment: { include: { labPatient: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  unreadCount: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.labNotification.count({
      where: { recipientUserId: ctx.session.user.id, readAt: null },
    });
  }),

  markRead: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labNotification.updateMany({
        where: { id: input.id, recipientUserId: ctx.session.user.id },
        data: { readAt: new Date() },
      });
    }),

  markAllRead: protectedProcedure.use(requireEntitlement("LABORATUVAR")).mutation(({ ctx }) => {
    return ctx.db.labNotification.updateMany({
      where: { recipientUserId: ctx.session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }),
});
