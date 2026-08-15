import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireCapability } from "@/server/trpc/trpc";
import { logAudit } from "@/server/services/audit";

const staffRoleSchema = z.enum(["DOKTOR", "SEKRETER", "SUBE_YONETICISI"]);

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.session.user;
  }),

  listStaff: protectedProcedure.use(requireCapability("org:user:manage")).query(({ ctx }) => {
    return ctx.db.user.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      include: {
        memberships: { include: { branch: true } },
        doctorProfile: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  createStaff: protectedProcedure
    .use(requireCapability("org:user:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        password: z.string().min(8).max(72),
        role: staffRoleSchema,
        branchId: z.string().min(1),
        title: z.string().trim().max(60).optional(),
        commissionRate: z.number().min(0).max(100).optional(),
        colorHex: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, organizationId: ctx.session.user.organizationId },
      });
      if (!branch) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz şube." });

      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Bu e-posta zaten kayıtlı." });

      const passwordHash = await bcrypt.hash(input.password, 12);

      return ctx.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organizationId: ctx.session.user.organizationId,
            name: input.name,
            email: input.email,
            passwordHash,
          },
        });

        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: ctx.session.user.organizationId,
            branchId: input.branchId,
            role: input.role,
          },
        });

        if (input.role === "DOKTOR") {
          await tx.doctor.create({
            data: {
              userId: user.id,
              organizationId: ctx.session.user.organizationId,
              branchId: input.branchId,
              title: input.title || null,
              commissionRate: input.commissionRate ?? 0,
              colorHex: input.colorHex || "#4F46E5",
            },
          });
        }

        return user;
      }).then(async (user) => {
        await logAudit(
          ctx.db,
          ctx.session.user.organizationId,
          ctx.session.user.id,
          "staff.created",
          "User",
          user.id,
          { role: input.role, branchId: input.branchId },
        );
        return user;
      });
    }),
});
