import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "@/server/trpc/context";
import { hasCapability, type Capability } from "@/server/rbac/permissions";
import { resolveAccessibleBranchIds } from "@/server/rbac/scope";
import { checkRateLimit } from "@/server/security/rate-limit";
import { recordActivity } from "@/server/services/activity-log";
import { attachRef, formatError, newErrorRef } from "@/server/trpc/error-format";
import { isSubscriptionUsable } from "@/lib/subscription-access";
import type { ModuleKey } from "@prisma/client";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter: formatError,
});

export const router = t.router;

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
  // Every failure gets a short ref the user sees (error toast / screen)
  // and support can search for in the logs.
  const ref = result.ok ? null : newErrorRef();
  if (!result.ok) {
    attachRef(result.error, ref!);
    if (result.error.code === "INTERNAL_SERVER_ERROR") {
      console.error(`[trpc] ${ref} ${path}:`, result.error.cause ?? result.error);
    }
  }
  const worthLogging = user ? type === "mutation" || !result.ok : !result.ok && result.error.code !== "UNAUTHORIZED";
  if (worthLogging) {
    const input = await getRawInput().catch(() => undefined);
    recordActivity({
      organizationId: user?.organizationId ?? null,
      ref,
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      path,
      kind: type === "mutation" ? "mutation" : "query",
      input,
      ok: result.ok,
      errorCode: result.ok ? null : result.error.code,
      // The raw (internal) message — only ever shown in the admin panel.
      errorMessage: result.ok ? null : describeCause(result.error),
      durationMs: Date.now() - startedAt,
      ip: ctx.clientIp,
    });
  }
  return result;
});

// Public procedures (signup…) are logged too — failures there are exactly
// the ones a would-be customer can't report any other way.
export const publicProcedure = t.procedure.use(activityLogger);

function describeCause(error: TRPCError) {
  const cause = error.cause;
  if (cause && cause !== error && cause instanceof Error && cause.message !== error.message) {
    return `${error.message}\n→ ${cause.name}: ${cause.message}`;
  }
  return error.message;
}

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
