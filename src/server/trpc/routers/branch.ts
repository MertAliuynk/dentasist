import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";

export const branchRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.db.branch.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireCapability("org:branch:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        address: z.string().trim().max(300).optional(),
        phone: z.string().trim().max(30).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.branch.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          name: input.name,
          address: input.address || null,
          phone: input.phone || null,
        },
      });
    }),
});
