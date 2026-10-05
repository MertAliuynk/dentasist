import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth as tenantAuth } from "@/server/auth-edge";
import { auth as platformAuth } from "@/server/platform-auth-edge";
import { isSubscriptionUsable } from "@/lib/subscription-access";
import { contentSecurityPolicy } from "@/server/security/csp";
import type { ModuleKey } from "@prisma/client";

const MODULE_BY_PREFIX: Record<string, ModuleKey> = {
  "/dental": "DENTAL",
  "/muhasebe": "MUHASEBE",
  "/laboratuvar": "LABORATUVAR",
};

const tenantMiddleware = tenantAuth((req) => {
  const { pathname } = req.nextUrl;
  const matchedPrefix = Object.keys(MODULE_BY_PREFIX).find((prefix) =>
    pathname.startsWith(prefix),
  );
  if (!matchedPrefix) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const loginUrl = new URL("/giris", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredModule = MODULE_BY_PREFIX[matchedPrefix];
  const hasEntitlement = user.entitlements?.some(
    (e) => e.module === requiredModule && e.active,
  );
  const sub = user.subscription;
  const subscriptionUsable = !sub || isSubscriptionUsable(sub.status, sub.endsAt);
  if (!hasEntitlement || !subscriptionUsable) {
    return NextResponse.redirect(new URL("/abonelik", req.nextUrl.origin));
  }

  return NextResponse.next();
});

// Fully separate from the tenant check above: reads the platform-only
// cookie via platform-auth-edge, never the tenant one. A compromised
// clinic session can never satisfy this check.
const platformMiddleware = platformAuth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/giris") return NextResponse.next();

  const platformUser = req.auth?.platformUser;
  if (!platformUser) {
    const loginUrl = new URL("/admin/giris", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

const PROTECTED = /^\/(dental|muhasebe|laboratuvar|admin)(\/|$)/;

export default async function proxy(req: NextRequest, event: Parameters<typeof tenantMiddleware>[1]) {
  const { pathname } = req.nextUrl;
  // Auth only runs for app sections; every other page just gets the CSP.
  const res = !PROTECTED.test(pathname)
    ? NextResponse.next()
    : ((pathname.startsWith("/admin") ? await platformMiddleware(req, event) : await tenantMiddleware(req, event)) ??
      NextResponse.next());
  res.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return res;
}

export const config = {
  // Pages only — API routes return JSON (CSP is meaningless there) and are
  // left untouched; static assets and images are skipped too.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|woff2?)$).*)"],
};
