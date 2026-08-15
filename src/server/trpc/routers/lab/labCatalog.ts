import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const labTreatmentTypeRouter = router({
  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.labTreatmentType.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ name: z.string().trim().min(2).max(120), price: z.number().int().min(0) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labTreatmentType.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name, price: input.price },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labTreatmentType.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});

export const labStageCatalogRouter = router({
  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.labStageCatalog.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labStageCatalog.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labStageCatalog.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});

export const toothColorRouter = router({
  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.toothColor.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ name: z.string().trim().min(1).max(30) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.toothColor.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.toothColor.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});

export const labExpenseCategoryRouter = router({
  list: protectedProcedure.use(requireEntitlement("LABORATUVAR")).query(({ ctx }) => {
    return ctx.db.labExpenseCategory.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labExpenseCategory.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:catalog:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.labExpenseCategory.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
