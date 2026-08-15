import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { assertAccessibleBranch } from "@/server/rbac/scope";
import { logAudit } from "@/server/services/audit";

const labStaffRoleSchema = z.enum(["DOKTOR", "TEKNISYEN"]);

// Kept separate from the generic user.createStaff (org:user:manage, Patron-only)
// since Laboratuvar explicitly grants Şube Müdürü staff-creation power here —
// that must not leak into Dental/Muhasebe's own staff management.
export const labStaffRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:staff:manage"))
    .query(({ ctx }) => {
      return ctx.db.user.findMany({
        where: {
          organizationId: ctx.session.user.organizationId,
          deletedAt: null,
          memberships: { some: { role: { in: ["DOKTOR", "TEKNISYEN"] } } },
        },
        include: {
          memberships: { include: { branch: true } },
          doctorProfile: { include: { klinik: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:staff:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        password: z.string().min(8).max(72),
        role: labStaffRoleSchema,
        branchId: z.string().min(1),
        klinikId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);

      if (input.role === "DOKTOR" && !input.klinikId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Hekim için bir klinik seçilmelidir." });
      }

      const branch = await ctx.db.branch.findFirst({
        where: { id: input.branchId, organizationId: ctx.session.user.organizationId },
      });
      if (!branch) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz şube." });

      if (input.klinikId) {
        const klinik = await ctx.db.klinik.findFirst({
          where: { id: input.klinikId, organizationId: ctx.session.user.organizationId, branchId: input.branchId },
        });
        if (!klinik) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz klinik." });
      }

      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Bu e-posta zaten kayıtlı." });

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await ctx.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            organizationId: ctx.session.user.organizationId,
            name: input.name,
            email: input.email,
            passwordHash,
          },
        });

        await tx.membership.create({
          data: {
            userId: created.id,
            organizationId: ctx.session.user.organizationId,
            branchId: input.branchId,
            role: input.role,
          },
        });

        if (input.role === "DOKTOR") {
          await tx.doctor.create({
            data: {
              userId: created.id,
              organizationId: ctx.session.user.organizationId,
              branchId: input.branchId,
              klinikId: input.klinikId,
            },
          });
        }

        return created;
      });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "lab.staff_created",
        "User",
        user.id,
        { role: input.role, branchId: input.branchId, klinikId: input.klinikId },
      );

      return user;
    }),
});
