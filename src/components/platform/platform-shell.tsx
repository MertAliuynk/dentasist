"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  ScrollText,
  Tag,
  LogOut,
  ShieldCheck,
  LifeBuoy,
  AlertTriangle,
  PanelLeft,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { platformSignOut } from "@/lib/platform-auth-client";
import { PlatformSupportBell, usePlatformSupportCounts } from "@/components/support/platform-support-bell";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  DEVELOPER: "Developer",
  SUPPORT: "Destek",
};

export function PlatformShell({
  platformUser,
  children,
}: {
  platformUser: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: support } = usePlatformSupportCounts();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
    { href: "/admin/organizasyonlar", label: "Klinikler", icon: Building2 },
    { href: "/admin/destek-talepleri", label: "Destek Talepleri", icon: LifeBuoy, badge: support?.open ?? 0, urgent: (support?.unreadCount ?? 0) > 0 },
    ...(platformUser.role === "OWNER"
      ? [{ href: "/admin/kullanicilar", label: "Ekip Üyeleri", icon: Users }]
      : []),
    { href: "/admin/hatalar", label: "Hata Kayıtları", icon: AlertTriangle },
    ...(platformUser.role !== "SUPPORT"
      ? [{ href: "/admin/denetim-kaydi", label: "Denetim Kaydı", icon: ScrollText }]
      : []),
    ...(platformUser.role === "OWNER" ? [{ href: "/admin/planlar", label: "Planlar", icon: Tag }] : []),
    // İndirim Kodları (/admin/indirim-kodlari) is hidden until payments are
    // wired up — the page and router still exist.
  ];

  const sidebar = (
    <>
        <div className="flex items-center gap-2.5 px-3 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Platform Paneli</p>
            <p className="truncate text-xs text-muted-foreground leading-tight">Dahili ekip</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {"badge" in item && !!item.badge && (
                    <span
                      className={`ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                        item.urgent ? "bg-red-500 text-white" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {platformUser.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">{platformUser.name}</span>
              <span className="block truncate text-xs text-muted-foreground leading-tight">
                {ROLE_LABEL[platformUser.role] ?? platformUser.role}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Çıkış yap"
              onClick={async () => {
                setMobileOpen(false);
                await platformSignOut();
                router.push("/admin/giris");
                router.refresh();
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menüyü aç" className="lg:hidden" />}>
              <PanelLeft className="size-4.5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Platform menüsü</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
          <Badge variant="outline">Platform</Badge>
          <div className="flex-1" />
          <PlatformSupportBell />
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
