import { randomInt } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import {
  platformRouter,
  platformProcedure,
  requirePlatformCapability,
  assertSensitiveOrgAccess,
  logPlatformAction,
} from "@/server/trpc/platform-trpc";

const STATUS = z.enum(["PENDING_PAYMENT", "ACTIVE", "PAST_DUE", "CANCELED", "TRIAL"]);
const MODULE = z.enum(["DENTAL", "MUHASEBE", "LABORATUVAR"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// Readable temporary password — no look-alike characters (0/O, 1/l/I) since
// it'll be read out over the phone to the clinic.
function generateTempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

async function getSubscriptionOrThrow(db: Prisma.TransactionClient, organizationId: string) {
  const sub = await db.subscription.findUnique({
    where: { organizationId },
    include: { entitlements: true },
  });
  if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Bu kliniğin aboneliği yok. Önce plan atayın." });
  return sub;
}

function snapshot(sub: { status: string; planId: string; currentPeriodEnd: Date | null; entitlements?: { module: string; active: boolean }[] }) {
  return {
    status: sub.status,
    planId: sub.planId,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    modules: sub.entitlements?.filter((e) => e.active).map((e) => e.module),
  };
}

export const platformOrganizationRouter = platformRouter({
  list: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(
      z.object({
        search: z.string().trim().max(120).optional(),
        filter: z.enum(["ALL", "ACTIVE", "TRIAL", "EXPIRING", "EXPIRED", "CANCELED", "PAST_DUE", "PENDING_PAYMENT"]).default("ALL"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const in7 = new Date(now.getTime() + 7 * DAY_MS);

      const filterWhere: Prisma.OrganizationWhereInput = (() => {
        switch (input.filter) {
          case "ACTIVE":
          case "TRIAL":
          case "CANCELED":
          case "PAST_DUE":
          case "PENDING_PAYMENT":
            return { subscription: { status: input.filter } };
          case "EXPIRING":
            return {
              subscription: {
                status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] },
                currentPeriodEnd: { gt: now, lte: in7 },
              },
            };
          case "EXPIRED":
            return {
              subscription: {
                status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] },
                currentPeriodEnd: { lte: now },
              },
            };
          default:
            return {};
        }
      })();

      const searchWhere: Prisma.OrganizationWhereInput = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { phone: { contains: input.search } },
              { users: { some: { email: { contains: input.search, mode: "insensitive" } } } },
              { users: { some: { phone: { contains: input.search } } } },
            ],
          }
        : {};

      const orgs = await ctx.db.organization.findMany({
        where: { AND: [filterWhere, searchWhere] },
        include: {
          subscription: { include: { plan: true, entitlements: true } },
          users: {
            where: { memberships: { some: { role: "PATRON" } } },
            select: { name: true, email: true, phone: true },
            take: 1,
          },
          _count: { select: { branches: true, users: true, patients: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      });

      const lastActivity = orgs.length
        ? await ctx.db.activityLog.groupBy({
            by: ["organizationId"],
            where: { organizationId: { in: orgs.map((o) => o.id) } },
            _max: { createdAt: true },
          })
        : [];
      const lastByOrg = new Map(lastActivity.map((a) => [a.organizationId, a._max.createdAt]));

      return orgs.map((o) => ({ ...o, owner: o.users[0] ?? null, lastActivityAt: lastByOrg.get(o.id) ?? null }));
    }),

  stats: platformProcedure.use(requirePlatformCapability("platform:org:read")).query(async ({ ctx }) => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * DAY_MS);
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const usable = { in: ["ACTIVE", "TRIAL", "PAST_DUE"] as ("ACTIVE" | "TRIAL" | "PAST_DUE")[] };

    const [total, byStatus, expiring, expired, errors24h, recentErrors, openTickets] = await Promise.all([
      ctx.db.organization.count(),
      ctx.db.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      ctx.db.organization.findMany({
        where: { subscription: { status: usable, currentPeriodEnd: { gt: now, lte: in7 } } },
        include: { subscription: { include: { plan: true } } },
        orderBy: { subscription: { currentPeriodEnd: "asc" } },
      }),
      ctx.db.subscription.count({ where: { status: usable, currentPeriodEnd: { lte: now } } }),
      ctx.db.activityLog.count({ where: { ok: false, kind: { not: "auth" }, createdAt: { gte: dayAgo } } }),
      ctx.db.activityLog.findMany({
        where: { ok: false, kind: { not: "auth" } },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      ctx.db.supportTicket.count({ where: { status: "OPEN" } }),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
    return { total, statusCounts, expiring, expired, errors24h, recentErrors, openTickets };
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
          users: {
            where: { memberships: { some: { role: "PATRON" } } },
            select: { id: true, name: true, email: true, phone: true },
          },
          _count: { select: { branches: true, users: true, patients: true, doctors: true, appointments: true } },
        },
      });
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const [activeGrant, lastActivity, lastLogin, errors7d] = await Promise.all([
        ctx.db.supportAccessGrant.findFirst({
          where: { organizationId: input.id, grantedToId: ctx.platformUser.id, expiresAt: { gt: new Date() } },
        }),
        ctx.db.activityLog.findFirst({ where: { organizationId: input.id }, orderBy: { createdAt: "desc" } }),
        ctx.db.activityLog.findFirst({
          where: { organizationId: input.id, path: "auth.login", ok: true },
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.activityLog.count({
          where: { organizationId: input.id, ok: false, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } },
        }),
      ]);

      return {
        organization: org,
        owners: org.users,
        lastActivityAt: lastActivity?.createdAt ?? null,
        lastLogin: lastLogin ? { at: lastLogin.createdAt, userName: lastLogin.userName } : null,
        errors7d,
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

  // "Üyelik atama" — sets plan/status/end date/modules in one go, creating
  // the subscription if the clinic doesn't have one yet.
  assignSubscription: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(
      z.object({
        organizationId: z.string(),
        planId: z.string(),
        status: STATUS,
        // ISO date string, or null for "süresiz".
        currentPeriodEnd: z.string().datetime().nullable(),
        modules: z.array(MODULE).min(1, "En az bir modül seçin."),
        adminNote: z.string().trim().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.plan.findUnique({ where: { id: input.planId } });
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Plan bulunamadı." });

      const result = await ctx.db.$transaction(async (tx) => {
        const before = await tx.subscription.findUnique({
          where: { organizationId: input.organizationId },
          include: { entitlements: true },
        });

        const data = {
          planId: input.planId,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null,
          ...(input.adminNote !== undefined ? { adminNote: input.adminNote || null } : {}),
        };
        const sub = before
          ? await tx.subscription.update({ where: { id: before.id }, data })
          : await tx.subscription.create({
              data: { ...data, organizationId: input.organizationId, startedAt: new Date() },
            });

        await tx.entitlement.updateMany({ where: { subscriptionId: sub.id }, data: { active: false } });
        for (const mod of input.modules) {
          await tx.entitlement.upsert({
            where: { subscriptionId_module: { subscriptionId: sub.id, module: mod } },
            update: { active: true },
            create: { subscriptionId: sub.id, module: mod, active: true },
          });
        }
        return { before: before ? snapshot(before) : null, subId: sub.id };
      });

      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.subscription_assigned", {
        organizationId: input.organizationId,
        entityType: "Subscription",
        entityId: result.subId,
        diff: {
          before: result.before,
          after: {
            status: input.status,
            planId: input.planId,
            planName: plan.name,
            currentPeriodEnd: input.currentPeriodEnd,
            modules: input.modules,
          },
        },
      });
      return { success: true };
    }),

  // "Uzat / kısalt" — shifts the end date by N days. Extending an already
  // expired (or open-ended) subscription counts from today, so "30 gün
  // uzat" always yields 30 usable days; shortening counts from the current
  // end date.
  adjustPeriod: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(
      z.object({
        organizationId: z.string(),
        days: z.number().int().min(-3650).max(3650).refine((d) => d !== 0, "Gün sayısı 0 olamaz."),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriptionOrThrow(ctx.db, input.organizationId);
      const now = new Date();
      const current = sub.currentPeriodEnd;
      const base = input.days > 0 ? (current && current > now ? current : now) : (current ?? now);
      const newEnd = new Date(base.getTime() + input.days * DAY_MS);

      // Extending an expired/closed membership re-opens it — otherwise the
      // new date would have no effect and the clinic would stay locked out.
      const reopen = input.days > 0 && (sub.status === "CANCELED" || sub.status === "PENDING_PAYMENT");

      await ctx.db.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: newEnd, ...(reopen ? { status: "ACTIVE" } : {}) },
      });

      await logPlatformAction(ctx.db, ctx.platformUser.id, input.days > 0 ? "org.subscription_extended" : "org.subscription_shortened", {
        organizationId: input.organizationId,
        entityType: "Subscription",
        entityId: sub.id,
        diff: {
          days: input.days,
          reason: input.reason,
          before: current?.toISOString() ?? null,
          after: newEnd.toISOString(),
          ...(reopen ? { statusBefore: sub.status, statusAfter: "ACTIVE" } : {}),
        },
      });
      return { currentPeriodEnd: newEnd };
    }),

  // "Kapat / Aç" — quick toggle without touching plan or dates.
  setStatus: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(z.object({ organizationId: z.string(), status: STATUS, reason: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriptionOrThrow(ctx.db, input.organizationId);
      await ctx.db.subscription.update({ where: { id: sub.id }, data: { status: input.status } });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.subscription_status_changed", {
        organizationId: input.organizationId,
        entityType: "Subscription",
        entityId: sub.id,
        diff: { before: sub.status, after: input.status, reason: input.reason },
      });
      return { success: true };
    }),

  updateNote: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(z.object({ organizationId: z.string(), adminNote: z.string().trim().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriptionOrThrow(ctx.db, input.organizationId);
      await ctx.db.subscription.update({ where: { id: sub.id }, data: { adminNote: input.adminNote || null } });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.note_updated", {
        organizationId: input.organizationId,
        entityType: "Subscription",
        entityId: sub.id,
      });
      return { success: true };
    }),

  // Everything the clinic's users did — the main debugging view.
  activity: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(
      z.object({
        organizationId: z.string(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        userId: z.string().optional(),
        onlyErrors: z.boolean().default(false),
        search: z.string().trim().max(120).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.activityLog.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.onlyErrors ? { ok: false } : {}),
          ...(input.from || input.to
            ? {
                createdAt: {
                  ...(input.from ? { gte: new Date(input.from) } : {}),
                  ...(input.to ? { lte: new Date(input.to) } : {}),
                },
              }
            : {}),
          ...(input.search
            ? {
                OR: [
                  { path: { contains: input.search, mode: "insensitive" as const } },
                  { errorMessage: { contains: input.search, mode: "insensitive" as const } },
                  { userName: { contains: input.search, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (logs.length > input.limit) nextCursor = logs.pop()!.id;
      return { logs, nextCursor };
    }),

  // Platform-team actions taken on this clinic (plan changes, extensions…).
  history: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.platformAuditLog.findMany({
        where: { organizationId: input.organizationId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }),

  // Staff records aren't patient PHI, so this doesn't go through
  // assertSensitiveOrgAccess like sensitivePeek does.
  staffList: platformProcedure.use(requirePlatformCapability("platform:org:read")).input(z.object({ organizationId: z.string() })).query(({ ctx, input }) => {
    return ctx.db.user.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        deletedAt: true,
        createdAt: true,
        memberships: { include: { branch: true } },
      },
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
        diff: { active: input.active, email: user.email },
      });
      return { success: true };
    }),

  // "Şifremi unuttum" support flow: we set a one-off password and read it
  // to the user; it's returned once and never stored in plain text.
  staffResetPassword: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const password = generateTempPassword();
      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.staff_password_reset", {
        organizationId: user.organizationId,
        entityType: "User",
        entityId: user.id,
        diff: { email: user.email },
      });
      return { password, email: user.email };
    }),
});
