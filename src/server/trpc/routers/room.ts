import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const roomRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).query(({ ctx }) => {
    return ctx.db.room.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:branch:manage"))
    .input(z.object({ name: z.string().trim().min(1).max(60), branchId: z.string() }))
    .mutation(({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      return ctx.db.room.create({
        data: { organizationId: ctx.session.user.organizationId, branchId: input.branchId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:branch:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.room.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
