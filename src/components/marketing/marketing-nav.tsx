"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { brand } from "@/lib/brand";
import { SIGNUP_OPEN } from "@/lib/signup";

const links = [
  { href: "/#dental", label: "Dental" },
  { href: "/#muhasebe", label: "Muhasebe" },
  { href: "/fiyatlandirma", label: "Fiyatlandırma" },
  { href: "/sss", label: "SSS" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="size-4.5" />
          </span>
          <span className="text-sm sm:text-base">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant={SIGNUP_OPEN ? "ghost" : "default"} nativeButton={false} render={<Link href="/giris" />}>
            Giriş Yap
          </Button>
          {SIGNUP_OPEN && (
            <Button nativeButton={false} render={<Link href="/kayit" />}>
              Ücretsiz Başla
            </Button>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Menüyü aç" className="md:hidden" />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="px-4 pt-4">{brand.name}</SheetTitle>
            <nav className="mt-4 flex flex-col gap-1 px-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/giris" onClick={() => setOpen(false)} />}
                >
                  Giriş Yap
                </Button>
                {SIGNUP_OPEN && (
                  <Button
                    nativeButton={false}
                    render={<Link href="/kayit" onClick={() => setOpen(false)} />}
                  >
                    Ücretsiz Başla
                  </Button>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
