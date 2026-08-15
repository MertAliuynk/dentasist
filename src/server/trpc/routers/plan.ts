import { router, publicProcedure } from "@/server/trpc/trpc";

export const planRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    return ctx.db.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
    });
  }),
});
