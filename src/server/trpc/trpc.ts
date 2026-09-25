import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "@/server/trpc/context";
import { hasCapability, type Capability } from "@/server/rbac/permissions";
import { resolveAccessibleBranchIds } from "@/server/rbac/scope";
import { checkRateLimit } from "@/server/security/rate-limit";
import { recordActivity } from "@/server/services/activity-log";
import { isSubscriptionUsable } from "@/lib/subscription-access";
import type { ModuleKey } from "@prisma/client";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Every authenticated write goes through here, not just login/signup —
// generous enough (2/sec sustained) to never bother normal UI usage, but
// bounds a runaway client bug or a scripted abuse attempt against any
// mutation in the app, not just the auth ones.
const MUTATION_RATE_LIMIT = 120;
const MUTATION_RATE_WINDOW_MS = 60 * 1000;

// Feeds the platform admin's per-clinic "İşlem Kayıtları": every mutation
// (success or failure) and every failed query, with the redacted input, so
// a "şunu yaparken hata aldım" report can be traced to the exact call.
// Successful queries are skipped — they're the bulk of traffic and say
// nothing about what the user changed.
const activityLogger = t.middleware(async ({ ctx, type, path, getRawInput, next }) => {
  const startedAt = Date.now();
  const result = await next();
  const user = ctx.session?.user;
  if (user?.organizationId && (type === "mutation" || !result.ok)) {
    const input = await getRawInput().catch(() => undefined);
    recordActivity({
      organizationId: user.organizationId,
      userId: user.id,
      userName: user.name,
      path,
      kind: type === "mutation" ? "mutation" : "query",
      input,
      ok: result.ok,
      errorCode: result.ok ? null : result.error.code,
      errorMessage: result.ok ? null : result.error.message,
      durationMs: Date.now() - startedAt,
      ip: ctx.clientIp,
    });
  }
  return result;
});

export const protectedProcedure = t.procedure.use(activityLogger).use(({ ctx, type, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (type === "mutation") {
    const { allowed, retryAfterMs } = checkRateLimit(
      `mutation:${ctx.session.user.id}`,
      MUTATION_RATE_LIMIT,
      MUTATION_RATE_WINDOW_MS,
    );
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Çok fazla istek gönderildi. Lütfen ${Math.ceil(retryAfterMs / 1000)} saniye sonra tekrar deneyin.`,
      });
    }
  }
  const accessibleBranchIds = resolveAccessibleBranchIds(ctx.session.user.memberships);
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
      accessibleBranchIds,
    },
  });
});

export function requireEntitlement(module: ModuleKey) {
  return t.middleware(({ ctx, next }) => {
    const session = ctx.session as NonNullable<TRPCContext["session"]>;
    // Entitlements are already zeroed out for unusable subscriptions when
    // the token is refreshed; re-checking the expiry here closes the up-to-
    // 5-minute gap between the period ending and the next token refresh.
    const sub = session.user.subscription;
    if (sub && !isSubscriptionUsable(sub.status, sub.endsAt)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Aboneliğiniz aktif değil veya süresi doldu. Lütfen bizimle iletişime geçin.",
      });
    }
    const active = session.user.entitlements.some((e) => e.module === module && e.active);
    if (!active) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Bu özelliğe erişmek için ${module} modülü aboneliğiniz aktif olmalı.`,
      });
    }
    return next({ ctx: { ...ctx, session } });
  });
}

export function requireCapability(capability: Capability) {
  return t.middleware(({ ctx, next }) => {
    const session = ctx.session as NonNullable<TRPCContext["session"]>;
    const roles = session.user.memberships.map((m) => m.role);
    if (!hasCapability(roles, capability, session.user.capabilityOverrides)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { ...ctx, session } });
  });
}

/**
 * Gates the org-level admin surface (cross-branch staff/permission
 * management) to the PATRON role directly, bypassing the capability
 * override system entirely — this procedure is what *edits* overrides, so
 * it must not itself be grantable through them.
 */
export function requirePatron() {
  return t.middleware(({ ctx, next }) => {
    const session = ctx.session as NonNullable<TRPCContext["session"]>;
    const isPatron = session.user.memberships.some((m) => m.role === "PATRON");
    if (!isPatron) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem yalnızca Patron rolüne açıktır." });
    }
    return next({ ctx: { ...ctx, session } });
  });
}
