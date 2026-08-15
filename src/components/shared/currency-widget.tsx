"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABELS: Record<string, string> = { USD: "Dolar", EUR: "Euro", GBP: "Sterlin" };

export function CurrencyWidget() {
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kur")
      .then((res) => res.json())
      .then((data: { rates: Record<string, number> }) => {
        if (!cancelled) setRates(data.rates);
      })
      .catch(() => {
        if (!cancelled) setRates({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = Object.entries(rates ?? {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4" />
          Döviz Kurları
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rates === null ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Kurlar şu anda alınamıyor.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {entries.map(([code, value]) => (
              <div key={code} className="rounded-md border border-border p-2 text-center">
                <p className="text-[11px] text-muted-foreground">{LABELS[code] ?? code}</p>
                <p className="text-sm font-semibold">{value.toFixed(2)} ₺</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
