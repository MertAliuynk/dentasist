import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import {
  platformRouter,
  platformProcedure,
  requirePlatformCapability,
  logPlatformAction,
} from "@/server/trpc/platform-trpc";

export const platformStaffRouter = platformRouter({
  list: platformProcedure.use(requirePlatformCapability("platform:staff:manage")).query(({ ctx }) => {
    return ctx.db.platformUser.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }),

  create: platformProcedure
    .use(requirePlatformCapability("platform:staff:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        password: z.string().min(10).max(72),
        role: z.enum(["DEVELOPER", "SUPPORT"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.platformUser.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Bu e-posta zaten kayıtlı." });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const created = await ctx.db.platformUser.create({
        data: { name: input.name, email: input.email, passwordHash, role: input.role },
      });

      await logPlatformAction(ctx.db, ctx.platformUser.id, "staff.created", {
        entityType: "PlatformUser",
        entityId: created.id,
        diff: { name: input.name, email: input.email, role: input.role },
      });

      return created;
    }),

  deactivate: platformProcedure
    .use(requirePlatformCapability("platform:staff:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.platformUser.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kendi hesabınızı devre dışı bırakamazsınız." });
      }
      await ctx.db.platformUser.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "staff.deactivated", {
        entityType: "PlatformUser",
        entityId: input.id,
      });
      return { success: true };
    }),
});
