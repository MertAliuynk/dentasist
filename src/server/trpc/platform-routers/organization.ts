import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  platformRouter,
  platformProcedure,
  requirePlatformCapability,
  assertSensitiveOrgAccess,
  logPlatformAction,
} from "@/server/trpc/platform-trpc";

export const platformOrganizationRouter = platformRouter({
  list: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(z.object({ search: z.string().trim().max(120).optional() }))
    .query(({ ctx, input }) => {
      return ctx.db.organization.findMany({
        where: input.search
          ? { name: { contains: input.search, mode: "insensitive" as const } }
          : undefined,
        include: {
          subscription: { include: { plan: true, entitlements: true } },
          _count: { select: { branches: true, users: true, patients: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }),

  summary: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: input.id },
        include: {
          subscription: { include: { plan: true, entitlements: true, discountCode: true } },
          branches: { where: { deletedAt: null } },
          _count: { select: { branches: true, users: true, patients: true, doctors: true } },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const activeGrant = await ctx.db.supportAccessGrant.findFirst({
        where: {
          organizationId: input.id,
          grantedToId: ctx.platformUser.id,
          expiresAt: { gt: new Date() },
        },
      });

      return {
        organization: org,
        hasSensitiveAccess:
          ctx.platformUser.role === "OWNER" || ctx.platformUser.role === "DEVELOPER" || !!activeGrant,
      };
    }),

  sensitivePeek: platformProcedure
    .input(z.object({ id: z.string(), search: z.string().trim().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      await assertSensitiveOrgAccess(ctx, input.id);
      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.sensitive_peek", {
        organizationId: input.id,
        entityType: "Organization",
        entityId: input.id,
      });

      const [patients, doctors, totalPatients] = await Promise.all([
        ctx.db.patient.findMany({
          where: {
            organizationId: input.id,
            deletedAt: null,
            ...(input.search
              ? {
                  OR: [
                    { fullName: { contains: input.search, mode: "insensitive" as const } },
                    { phone: { contains: input.search } },
                  ],
                }
              : {}),
          },
          select: { id: true, fullName: true, phone: true, branch: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        ctx.db.doctor.findMany({
          where: { organizationId: input.id, deletedAt: null },
          include: { user: true, branch: true },
        }),
        ctx.db.patient.count({ where: { organizationId: input.id, deletedAt: null } }),
      ]);

      return { patients, doctors, totalPatients };
    }),

  updateSubscription: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(
      z.object({
        organizationId: z.string(),
        status: z.enum(["PENDING_PAYMENT", "ACTIVE", "PAST_DUE", "CANCELED", "TRIAL"]).optional(),
        modules: z.array(z.enum(["DENTAL", "MUHASEBE"])).optional(),
        planId: z.string().optional(),
        currentPeriodEnd: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.db.subscription.findUnique({
        where: { organizationId: input.organizationId },
      });
      if (!subscription) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.status || input.planId || input.currentPeriodEnd) {
        await ctx.db.subscription.update({
          where: { id: subscription.id },
          data: {
            ...(input.status ? { status: input.status } : {}),
            ...(input.planId ? { planId: input.planId } : {}),
            ...(input.currentPeriodEnd ? { currentPeriodEnd: new Date(input.currentPeriodEnd) } : {}),
          },
        });
      }

      if (input.modules) {
        await ctx.db.entitlement.updateMany({
          where: { subscriptionId: subscription.id },
          data: { active: false },
        });
        for (const mod of input.modules) {
          await ctx.db.entitlement.upsert({
            where: { subscriptionId_module: { subscriptionId: subscription.id, module: mod } },
            update: { active: true },
            create: { subscriptionId: subscription.id, module: mod, active: true },
          });
        }
      }

      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.subscription_updated", {
        organizationId: input.organizationId,
        entityType: "Subscription",
        entityId: subscription.id,
        diff: input,
      });

      return { success: true };
    }),

  // "Hesap bilgilerine/işlemlerine erişim" — a professional support panel
  // needs to see and act on the clinic's own staff accounts, not just
  // aggregate counts. Staff records aren't patient PHI, so this doesn't go
  // through assertSensitiveOrgAccess like sensitivePeek does — any platform
  // role with platform:org:read can view; deactivating requires org:manage.
  staffList: platformProcedure.use(requirePlatformCapability("platform:org:read")).input(z.object({ organizationId: z.string() })).query(({ ctx, input }) => {
    return ctx.db.user.findMany({
      where: { organizationId: input.organizationId },
      include: { memberships: { include: { branch: true } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  staffSetActive: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(z.object({ userId: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data: { deletedAt: input.active ? null : new Date() },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.staff_account_toggled", {
        organizationId: user.organizationId,
        entityType: "User",
        entityId: user.id,
        diff: { active: input.active },
      });
      return { success: true };
    }),
});
