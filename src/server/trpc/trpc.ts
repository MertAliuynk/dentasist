import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "@/server/trpc/context";
import { hasCapability, type Capability } from "@/server/rbac/permissions";
import { resolveAccessibleBranchIds } from "@/server/rbac/scope";
import type { ModuleKey } from "@prisma/client";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
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
