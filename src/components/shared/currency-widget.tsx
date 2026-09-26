"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABELS: Record<string, string> = { USD: "Dolar", EUR: "Euro", GBP: "Sterlin" };
type Rate = { code: string; buying: number | null; selling: number | null };
type Payload = { source: "TCMB" | "ECB" | null; date: string | null; rates: Rate[] };

/**
 * Accepts the current shape and the older `{ rates: { USD: 48.8 } }` one
 * (a browser may still hold that cached) — a bad payload must never crash
 * the dashboard.
 */
function normalize(raw: unknown): Payload {
  const d = (raw ?? {}) as { source?: unknown; date?: unknown; rates?: unknown };
  const date = typeof d.date === "string" ? d.date : null;
  const source = d.source === "TCMB" || d.source === "ECB" ? d.source : null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  let rates: Rate[] = [];
  if (Array.isArray(d.rates)) {
    rates = d.rates
      .filter((r): r is Rate => !!r && typeof r === "object" && typeof (r as Rate).code === "string")
      .map((r) => ({ code: r.code, buying: n(r.buying), selling: n(r.selling) }));
  } else if (d.rates && typeof d.rates === "object") {
    rates = Object.entries(d.rates as Record<string, unknown>).map(([code, v]) => ({ code, buying: n(v), selling: n(v) }));
  }
  return { source: source ?? (rates.length ? "ECB" : null), date, rates };
}

const fmt = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v);

export function CurrencyWidget() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/kur", { cache: "no-store" })
        .then((res) => res.json())
        .then((d: unknown) => !cancelled && setData(normalize(d)))
        .catch(() => !cancelled && setData((prev) => prev ?? { source: null, date: null, rates: [] }));
    load();
    // Keep an open dashboard current (TCMB updates once a day ~15:30).
    const t = setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const sameBuySell = data?.source === "ECB";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4" />
          Döviz Kurları
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data === null ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : data.rates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Kurlar şu anda alınamıyor.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {data.rates.map((r) => (
                <div key={r.code} className="rounded-md border border-border p-2 text-center">
                  <p className="text-[11px] text-muted-foreground">{LABELS[r.code] ?? r.code}</p>
                  <p className="text-sm font-semibold tabular-nums">{fmt(r.selling)} ₺</p>
                  {!sameBuySell && <p className="text-[10px] tabular-nums text-muted-foreground">Alış {fmt(r.buying)}</p>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {data.source === "TCMB" ? "TCMB döviz satış kuru" : "Avrupa Merkez Bankası referans kuru (TCMB'ye ulaşılamadı)"}
              {data.date && ` · ${data.date}`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
