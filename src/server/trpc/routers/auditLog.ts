import { z } from "zod";
import { router, protectedProcedure, requirePatron } from "@/server/trpc/trpc";

// "Sistem Kayıtları" — a Patron-only view of every logged action taken by
// the organization's own staff (see logAudit callers across the other
// routers). Platform-side staff actions have a separate, entirely
// independent log (PlatformAuditLog) — this one never crosses that boundary.
export const auditLogRouter = router({
  list: protectedProcedure
    .use(requirePatron())
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.auditLog.findMany({
        where: { organizationId: ctx.session.user.organizationId },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (logs.length > input.limit) {
        const next = logs.pop();
        nextCursor = next!.id;
      }

      return { logs, nextCursor };
    }),
});
