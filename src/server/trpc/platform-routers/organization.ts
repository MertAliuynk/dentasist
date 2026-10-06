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
import { slugify } from "@/lib/utils/slug";

const STATUS = z.enum(["PENDING_PAYMENT", "ACTIVE", "PAST_DUE", "CANCELED", "TRIAL"]);
const MODULE = z.enum(["DENTAL", "MUHASEBE", "LABORATUVAR"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// Readable temporary password — no look-alike characters (0/O, 1/l/I) since
// it'll be read out over the phone to the clinic.
function generateTempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

const DOCTOR_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const password = z.string().min(8, "Şifre en az 8 karakter olmalı.").max(72).optional().or(z.literal(""));

const createAccountInput = z.object({
  organization: z.object({
    name: z.string().trim().min(2, "Klinik adı en az 2 karakter olmalı.").max(120),
    phone: optionalText(30),
    address: optionalText(300),
    taxNumber: optionalText(20),
    taxOffice: optionalText(80),
    billingEmail: z.string().trim().email("Fatura e-postası geçersiz.").optional().or(z.literal("")),
  }),
  planId: z.string().min(1, "Plan seçin."),
  status: z.enum(["TRIAL", "ACTIVE"]),
  currentPeriodEnd: z.string().datetime().nullable(),
  modules: z.array(MODULE).min(1, "En az bir modül seçin."),
  adminNote: optionalText(2000),
  branches: z
    .array(z.object({ name: z.string().trim().min(2, "Şube adı en az 2 karakter olmalı.").max(120), address: optionalText(300), phone: optionalText(30) }))
    .min(1, "En az bir şube ekleyin.")
    .max(30),
  owner: z.object({
    name: z.string().trim().min(2, "Sahibin adı en az 2 karakter olmalı.").max(120),
    email: z.string().trim().email("Sahibin e-postası geçersiz."),
    phone: optionalText(30),
    password,
    isDoctor: z.boolean().default(false),
    title: optionalText(60),
    commissionRate: z.number().min(0).max(100).optional(),
  }),
  staff: z
    .array(
      z.object({
        name: z.string().trim().min(2, "Personel adı en az 2 karakter olmalı.").max(120),
        email: z.string().trim().email("Personel e-postası geçersiz."),
        phone: optionalText(30),
        role: z.enum(["SUBE_YONETICISI", "DOKTOR", "SEKRETER", "TEKNISYEN"]),
        branchIndex: z.number().int().min(0),
        password,
        title: optionalText(60),
        commissionRate: z.number().min(0).max(100).optional(),
      }),
    )
    .max(50),
});

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
                  { ref: input.search.toUpperCase() },
                  { ref: input.search },
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

  // Global "Hata Kayıtları": failures across every clinic, plus the ones
  // with no clinic (server render crashes, logged-out pages).
  errorLog: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(
      z.object({
        search: z.string().trim().max(120).optional(),
        kind: z.enum(["ALL", "api", "page"]).default("ALL"),
        hideUserErrors: z.boolean().default(true),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const s = input.search;
      const logs = await ctx.db.activityLog.findMany({
        where: {
          ok: false,
          kind: input.kind === "api" ? { in: ["mutation", "query"] } : input.kind === "page" ? { in: ["render", "client"] } : { not: "auth" },
          // "User errors" = validation / permission / not-found — expected,
          // not bugs. Hidden by default so real problems stand out.
          ...(input.hideUserErrors
            ? { OR: [{ errorCode: null }, { errorCode: { notIn: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED", "PRECONDITION_FAILED", "CONFLICT", "TOO_MANY_REQUESTS"] } }] }
            : {}),
          ...(s
            ? {
                AND: [
                  {
                    OR: [
                      { ref: s.toUpperCase() },
                      { ref: s },
                      { path: { contains: s, mode: "insensitive" as const } },
                      { errorMessage: { contains: s, mode: "insensitive" as const } },
                      { organization: { name: { contains: s, mode: "insensitive" as const } } },
                    ],
                  },
                ],
              }
            : {}),
        },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 101,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      let nextCursor: string | undefined;
      if (logs.length > 100) nextCursor = logs.pop()!.id;
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

  // ---------------------------------------------------------------------
  // "Yeni Hesap" — the team opens a clinic account (pilot phase: public
  // sign-up is closed). Everything is created in one transaction: clinic,
  // subscription + modules, branches, the owner (PATRON) and optional staff.
  // Generated passwords are returned exactly once so they can be handed to
  // the clinic; only bcrypt hashes are stored.

  checkEmails: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(z.object({ emails: z.array(z.string().trim().toLowerCase()).max(60) }))
    .query(async ({ ctx, input }) => {
      const emails = [...new Set(input.emails.filter((e) => e.includes("@")))];
      if (!emails.length) return { taken: [] as string[] };
      const users = await ctx.db.user.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { email: true },
      });
      return { taken: users.map((u) => u.email.toLowerCase()) };
    }),

  createAccount: platformProcedure
    .use(requirePlatformCapability("platform:org:manage"))
    .input(createAccountInput)
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.plan.findUnique({ where: { id: input.planId } });
      if (!plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Plan bulunamadı." });

      // Every login e-mail must be unique — within this form and globally.
      const people = [{ ...input.owner, label: "Klinik sahibi" }, ...input.staff.map((s, i) => ({ ...s, label: `Personel #${i + 1}` }))];
      const emails = people.map((p) => p.email.toLowerCase());
      const dup = emails.find((e, i) => emails.indexOf(e) !== i);
      if (dup) throw new TRPCError({ code: "BAD_REQUEST", message: `${dup} adresi formda birden fazla kez kullanılmış.` });
      const taken = await ctx.db.user.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { email: true } });
      if (taken.length) {
        throw new TRPCError({ code: "CONFLICT", message: `Bu e-posta zaten kayıtlı: ${taken.map((t) => t.email).join(", ")}` });
      }
      const branchNames = input.branches.map((b) => b.name.toLocaleLowerCase("tr"));
      if (new Set(branchNames).size !== branchNames.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Aynı isimde iki şube var." });
      }
      for (const s of input.staff) {
        if (s.branchIndex >= input.branches.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `${s.name} için seçilen şube bulunamadı.` });
        }
      }

      const baseSlug = slugify(input.organization.name) || "klinik";
      let slug = baseSlug;
      for (let n = 2; await ctx.db.organization.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${baseSlug}-${n}`;

      // Passwords: the one typed in the form, or a generated readable one.
      const withPasswords = people.map((p) => ({ ...p, plainPassword: p.password || generateTempPassword() }));
      const hashes = await Promise.all(withPasswords.map((p) => bcrypt.hash(p.plainPassword, 12)));

      const created = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.organization.name,
            slug,
            phone: input.organization.phone || null,
            address: input.organization.address || null,
            taxNumber: input.organization.taxNumber || null,
            taxOffice: input.organization.taxOffice || null,
            billingEmail: input.organization.billingEmail || null,
          },
        });

        const sub = await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: plan.id,
            status: input.status,
            startedAt: new Date(),
            currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null,
            adminNote: input.adminNote || null,
            paymentStub: { note: "Platform ekibi tarafından açıldı (pilot)." },
          },
        });
        await tx.entitlement.createMany({
          data: input.modules.map((module) => ({ subscriptionId: sub.id, module, active: true })),
        });

        const branches = [];
        for (const b of input.branches) {
          branches.push(
            await tx.branch.create({
              data: { organizationId: org.id, name: b.name, address: b.address || null, phone: b.phone || null },
            }),
          );
        }

        const accounts: { name: string; email: string; role: string; branchName: string | null; password: string; generated: boolean }[] = [];

        const owner = await tx.user.create({
          data: {
            organizationId: org.id,
            name: input.owner.name,
            email: input.owner.email.toLowerCase(),
            phone: input.owner.phone || null,
            passwordHash: hashes[0],
          },
        });
        // PATRON is org-wide (branchId null) — sees every branch.
        await tx.membership.create({ data: { userId: owner.id, organizationId: org.id, branchId: null, role: "PATRON" } });
        if (input.owner.isDoctor) {
          await tx.doctor.create({
            data: {
              userId: owner.id,
              organizationId: org.id,
              branchId: branches[0].id,
              title: input.owner.title || null,
              commissionRate: input.owner.commissionRate ?? 0,
              colorHex: DOCTOR_COLORS[0],
            },
          });
        }
        accounts.push({
          name: owner.name,
          email: owner.email,
          role: input.owner.isDoctor ? "PATRON + DOKTOR" : "PATRON",
          branchName: null,
          password: withPasswords[0].plainPassword,
          generated: !input.owner.password,
        });

        let doctorIdx = input.owner.isDoctor ? 1 : 0;
        for (const [i, s] of input.staff.entries()) {
          const branch = branches[s.branchIndex];
          const user = await tx.user.create({
            data: {
              organizationId: org.id,
              name: s.name,
              email: s.email.toLowerCase(),
              phone: s.phone || null,
              passwordHash: hashes[i + 1],
            },
          });
          await tx.membership.create({ data: { userId: user.id, organizationId: org.id, branchId: branch.id, role: s.role } });
          if (s.role === "DOKTOR") {
            await tx.doctor.create({
              data: {
                userId: user.id,
                organizationId: org.id,
                branchId: branch.id,
                title: s.title || null,
                commissionRate: s.commissionRate ?? 0,
                colorHex: DOCTOR_COLORS[doctorIdx++ % DOCTOR_COLORS.length],
              },
            });
          }
          accounts.push({
            name: user.name,
            email: user.email,
            role: s.role,
            branchName: branch.name,
            password: withPasswords[i + 1].plainPassword,
            generated: !s.password,
          });
        }

        return { org, subId: sub.id, accounts, branchNames: branches.map((b) => b.name) };
        // Large teams mean many inserts; the 5 s default is too tight.
      }, { timeout: 30_000 });

      await logPlatformAction(ctx.db, ctx.platformUser.id, "org.created_by_platform", {
        organizationId: created.org.id,
        entityType: "Organization",
        entityId: created.org.id,
        // Never log passwords.
        diff: {
          name: created.org.name,
          planName: plan.name,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          modules: input.modules,
          branches: created.branchNames,
          users: created.accounts.map((a) => ({ email: a.email, role: a.role, branch: a.branchName })),
        },
      });

      return {
        organizationId: created.org.id,
        organizationName: created.org.name,
        planName: plan.name,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
        modules: input.modules,
        branches: created.branchNames,
        accounts: created.accounts,
      };
    }),
});
