import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth as tenantAuth } from "@/server/auth-edge";
import { auth as platformAuth } from "@/server/platform-auth-edge";
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
  if (!hasEntitlement) {
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

export default function proxy(req: NextRequest, event: Parameters<typeof tenantMiddleware>[1]) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    return platformMiddleware(req, event);
  }
  return tenantMiddleware(req, event);
}

export const config = {
  matcher: ["/dental/:path*", "/muhasebe/:path*", "/laboratuvar/:path*", "/admin/:path*"],
};
