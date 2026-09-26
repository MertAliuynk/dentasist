"use client";

import { useEffect, useState } from "react";
import "./globals.css";

// Last line of defence: the root layout itself crashed, so no providers,
// theme or shell are available — plain markup only.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [ref, setRef] = useState<string | null>(error.digest ?? null);

  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, stack: error.stack, path: window.location.pathname, digest: error.digest }),
    })
      .then((r) => r.json())
      .then((d: { ref?: string | null }) => d.ref && setRef(d.ref))
      .catch(() => undefined);
  }, [error]);

  return (
    <html lang="tr">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground antialiased">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Uygulama şu an yüklenemedi</h1>
          <p className="text-sm text-muted-foreground">
            Beklenmedik bir sorun oluştu. Verileriniz güvende. Lütfen sayfayı yeniden deneyin; sorun sürerse destek ekibimize
            aşağıdaki referans koduyla ulaşın.
          </p>
          {ref && <p className="font-mono text-xs text-muted-foreground">Referans: {ref}</p>}
          <div className="flex justify-center gap-2">
            <button type="button" onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Tekrar Dene
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- router may be what crashed */}
            <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">
              Ana Sayfa
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
