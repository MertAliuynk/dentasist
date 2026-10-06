import Link from "next/link";
import { brand } from "@/lib/brand";
import { SIGNUP_OPEN } from "@/lib/signup";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand.name}. Tüm hakları saklıdır.
        </p>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/fiyatlandirma" className="hover:text-foreground">
            Fiyatlandırma
          </Link>
          <Link href="/sss" className="hover:text-foreground">
            SSS
          </Link>
          <Link href="/giris" className="hover:text-foreground">
            Giriş Yap
          </Link>
          {SIGNUP_OPEN && (
            <Link href="/kayit" className="hover:text-foreground">
              Ücretsiz Başla
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
