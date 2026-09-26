"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Copy, FileQuestion, Home, LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supportLink } from "@/lib/error-report";

/**
 * Body of every error.tsx: friendly text, a reference code the user can
 * quote, and one-click "Destek talebi aç" with the details prefilled.
 * Client-side crashes are reported to /api/client-error to get their ref;
 * server ones already carry Next's `digest`, logged by onRequestError.
 */
export function ErrorScreen({
  error,
  reset,
  homeHref = "/",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  homeHref?: string;
}) {
  const pathname = usePathname();
  const [ref, setRef] = useState<string | null>(error.digest ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, path: pathname, digest: error.digest }),
    })
      .then((r) => r.json())
      .then((d: { ref?: string | null }) => !cancelled && d.ref && setRef(d.ref))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [error, pathname]);

  const support = supportLink(
    { ref, code: error.digest ? "SAYFA_HATASI" : "ISTEMCI_HATASI", technical: error.digest ? undefined : error.message },
    pathname,
  );

  return (
    <div className="mx-auto w-full flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="size-7 text-red-500" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Bir şeyler ters gitti</h1>
        <p className="text-sm text-muted-foreground">
          Bu sayfa beklenmedik bir hatayla karşılaştı. Verileriniz güvende. Tekrar denemek çoğu zaman sorunu çözer; devam ederse
          aşağıdan bize tek tıkla bildirebilirsiniz.
        </p>
      </div>
      {ref && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(ref);
            setCopied(true);
          }}
          className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
          title="Kopyala"
        >
          Referans: {ref} <Copy className="size-3" /> {copied && <span className="font-sans">kopyalandı</span>}
        </button>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {reset && (
          <Button onClick={reset}>
            <RotateCcw className="size-4" /> Tekrar Dene
          </Button>
        )}
        <Button variant="outline" nativeButton={false} render={<Link href={homeHref} />}>
          <Home className="size-4" /> Ana Sayfa
        </Button>
        {support && (
          <Button variant="outline" nativeButton={false} render={<Link href={support} />}>
            <LifeBuoy className="size-4" /> Destek Talebi Aç
          </Button>
        )}
      </div>
    </div>
  );
}

export function NotFoundScreen({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <div className="mx-auto w-full flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-7 text-muted-foreground" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Sayfa bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          Aradığınız sayfa taşınmış, kaldırılmış ya da henüz kullanıma açılmamış olabilir.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href={homeHref} />}>
        <Home className="size-4" /> Ana Sayfaya Dön
      </Button>
    </div>
  );
}
