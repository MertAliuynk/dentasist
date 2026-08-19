"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  Home,
  CalendarClock,
  IdCard,
  Users,
  UserPlus,
  Upload,
  FileSignature,
  MessageSquare,
  MessageCircle,
  PhoneIncoming,
  BarChart3,
  Settings,
  Wallet,
  Stethoscope,
  Receipt,
  LineChart,
  PanelLeft,
  LogOut,
  ArrowLeftRight,
  ChevronsUpDown,
  Search,
  Sun,
  Moon,
  Building2,
  ShieldCheck,
  Bell,
  Briefcase,
  LifeBuoy,
  Boxes,
  FileHeart,
  FileText,
  ScrollText,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavItem, NavSection, IconKey, PrimaryAction } from "@/lib/nav/types";

const ICONS: Record<IconKey, LucideIcon> = {
  Home,
  CalendarClock,
  IdCard,
  Users,
  UserPlus,
  Upload,
  FileSignature,
  MessageSquare,
  MessageCircle,
  PhoneIncoming,
  BarChart3,
  Settings,
  Wallet,
  Stethoscope,
  Receipt,
  LineChart,
  ShieldCheck,
  Bell,
  Briefcase,
  LifeBuoy,
  Boxes,
  FileHeart,
  FileText,
  ScrollText,
};

const SECTION_ORDER: NavSection[] = ["Genel", "Sayfalar", "Diğer"];

type OtherModule = { href: string; label: string };

type AppShellProps = {
  moduleLabel: string;
  navItems: NavItem[];
  primaryAction?: PrimaryAction;
  organizationName: string;
  branchLabel: string;
  userName: string;
  roleLabel: string;
  otherModules?: OtherModule[];
  children: React.ReactNode;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isItemActive(href: string, pathname: string) {
  return href === "/dental" || href === "/muhasebe" || href === "/laboratuvar"
    ? pathname === href
    : pathname.startsWith(href);
}

function containsActiveChild(item: NavItem, pathname: string): boolean {
  if (!item.children) return isItemActive(item.href, pathname);
  return item.children.some((child) => containsActiveChild(child, pathname));
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon];
  const active = isItemActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroup({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const Icon = ICONS[item.icon];
  const [open, setOpen] = useState(() => containsActiveChild(item, pathname));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border pl-2.5 pt-0.5">
          {item.children!.map((child) => (
            <NavLink key={child.href} item={child} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavList({ navItems, pathname, onNavigate }: { navItems: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-4">
      {SECTION_ORDER.map((section) => {
        const items = navItems.filter((item) => item.section === section);
        if (items.length === 0) return null;
        return (
          <div key={section}>
            <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{section}</p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) =>
                item.children ? (
                  <NavGroup key={item.label} item={item} pathname={pathname} onNavigate={onNavigate} />
                ) : (
                  <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
                ),
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  moduleLabel,
  navItems,
  primaryAction,
  organizationName,
  branchLabel,
  userName,
  roleLabel,
  otherModules,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const PrimaryIcon = primaryAction ? ICONS[primaryAction.icon] : null;

  const sidebarHeader = (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Building2 className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{organizationName}</p>
        <p className="truncate text-xs text-muted-foreground leading-tight">{branchLabel}</p>
      </div>
    </div>
  );

  const sidebarBody = (
    <>
      {sidebarHeader}
      {primaryAction && PrimaryIcon && (
        <div className="px-2 pb-3">
          <Button
            className="w-full justify-center"
            nativeButton={false}
            render={<Link href={primaryAction.href} onClick={() => setMobileOpen(false)} />}
          >
            <PrimaryIcon className="size-4" />
            {primaryAction.label}
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2">
        <NavList navItems={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        {otherModules?.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeftRight className="size-4 shrink-0" />
            <span>{mod.label} moduluna geç</span>
          </Link>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              />
            }
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight">{userName}</span>
              <span className="block truncate text-xs text-muted-foreground leading-tight">{roleLabel}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              render={<button type="button" onClick={() => signOut({ callbackUrl: "/" })} />}
            >
              <LogOut className="size-4" />
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Pinned to the viewport (sticky + fixed h-screen) instead of
          stretching to match main's content height — otherwise a long page
          drags the sidebar's bottom (incl. the logout menu) down with it,
          requiring a page-scroll just to sign out. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex print:hidden">
        {sidebarBody}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 print:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" aria-label="Menüyü aç" className="lg:hidden" />}
            >
              <PanelLeft className="size-4.5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">{moduleLabel} Gezinme Menüsü</SheetTitle>
              {sidebarBody}
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1" />

          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Hasta Ara..."
              className="h-8 w-56 rounded-md border border-input bg-muted/50 pl-8 pr-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Temayı değiştir"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
