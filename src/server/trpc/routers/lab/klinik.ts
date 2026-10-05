import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, branchSelfWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const labKlinikRouter = router({
  listBranches: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.branch.findMany({
      where: {
        ...branchSelfWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      orderBy: { name: "asc" },
    });
  }),

  createBranch: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:branch:manage"))
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

  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.klinik.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      include: { hekimler: { where: { deletedAt: null }, include: { user: true } } },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:staff:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        branchId: z.string(),
        phone: z.string().trim().max(30).optional(),
        address: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      return ctx.db.klinik.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          branchId: input.branchId,
          name: input.name,
          phone: input.phone || null,
          address: input.address || null,
        },
      });
    }),
});
