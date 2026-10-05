"use client";

import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CURRENCIES, CURRENCY_META, decimalInput, formatCurrency, parseDecimal, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Amount field with an optional foreign-currency mode: pick $ / € / £, the
 * day's TCMB rate is filled in automatically and the TL equivalent is
 * computed — both the rate and the TL amount stay editable. Whatever the
 * currency, the TL value is what gets booked.
 */
export type MoneyValue = {
  currency: Currency;
  /** Amount in the selected currency (the TL amount when currency is TRY). */
  amount: string;
  rate: string;
  /** TL equivalent; only meaningful for a foreign currency. */
  tl: string;
  tlEdited: boolean;
};

export const emptyMoney = (amount = ""): MoneyValue => ({ currency: "TRY", amount, rate: "", tl: "", tlEdited: false });

/** Normalised result: TL in kuruş plus the original foreign amount/rate. */
export function moneyResult(v: MoneyValue) {
  if (v.currency === "TRY") {
    const n = parseDecimal(v.amount);
    return { tlKurus: n == null ? null : Math.round(n * 100), currency: v.currency, foreignAmount: undefined, exchangeRate: undefined };
  }
  const amount = parseDecimal(v.amount);
  const rate = parseDecimal(v.rate);
  const tl = parseDecimal(v.tl);
  return {
    tlKurus: tl == null ? null : Math.round(tl * 100),
    currency: v.currency,
    foreignAmount: amount == null ? undefined : Math.round(amount * 100),
    exchangeRate: rate ?? undefined,
  };
}

type Rates = { source: string | null; date: string | null; rates: { code: string; buying: number | null; selling: number | null }[] };

let ratesPromise: Promise<Rates> | null = null;
function loadRates() {
  ratesPromise ??= fetch("/api/kur")
    .then((r) => r.json() as Promise<Rates>)
    .catch(() => {
      ratesPromise = null;
      return { source: null, date: null, rates: [] };
    });
  return ratesPromise;
}

function computeTl(amount: string, rate: string) {
  const a = parseDecimal(amount);
  const r = parseDecimal(rate);
  return a == null || r == null ? "" : decimalInput(a * r);
}

export function MoneyInput({
  value,
  onChange,
  side = "selling",
  id,
  autoFocus,
}: {
  value: MoneyValue;
  onChange: (v: MoneyValue) => void;
  /** Which TCMB rate to prefill: selling for expenses/purchases, buying for income. */
  side?: "buying" | "selling";
  id?: string;
  autoFocus?: boolean;
}) {
  const [rates, setRates] = useState<Rates | null>(null);
  const foreign = value.currency !== "TRY";

  useEffect(() => {
    if (!foreign || rates) return;
    let alive = true;
    loadRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, [foreign, rates]);

  const rateFor = (c: Currency, r: Rates | null) => {
    const row = r?.rates.find((x) => x.code === c);
    const n = row ? (row[side] ?? row.selling ?? row.buying) : null;
    return n ? decimalInput(n, 4) : "";
  };

  // Rates arrive after the currency was picked: fill the blank rate once.
  useEffect(() => {
    if (!foreign || !rates || value.rate) return;
    const rate = rateFor(value.currency, rates);
    if (rate) onChange({ ...value, rate, tl: value.tlEdited ? value.tl : computeTl(value.amount, rate) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, value.currency]);

  function pickCurrency(c: Currency) {
    if (c === value.currency) return;
    if (c === "TRY") {
      // Keep the TL figure the user was looking at.
      onChange({ ...emptyMoney(value.tl || value.amount) });
      return;
    }
    const rate = rateFor(c, rates);
    onChange({ currency: c, amount: value.amount, rate, tl: computeTl(value.amount, rate), tlEdited: false });
  }

  const set = (patch: Partial<MoneyValue>) => {
    const next = { ...value, ...patch };
    if (!next.tlEdited && ("amount" in patch || "rate" in patch)) next.tl = computeTl(next.amount, next.rate);
    onChange(next);
  };

  const sym = CURRENCY_META[value.currency].symbol;
  const result = moneyResult(value);

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-md border border-input bg-muted/40 p-0.5" role="radiogroup" aria-label="Para birimi">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value.currency === c}
            title={CURRENCY_META[c].label}
            onClick={() => pickCurrency(c)}
            className={cn(
              "min-w-11 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              value.currency === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {CURRENCY_META[c].symbol} {c === "TRY" ? "TL" : c}
          </button>
        ))}
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{sym}</span>
        <Input
          id={id}
          autoFocus={autoFocus}
          inputMode="decimal"
          placeholder="0,00"
          className="pl-8 tabular-nums"
          value={value.amount}
          onChange={(e) => set({ amount: e.target.value })}
        />
      </div>

      {foreign && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="space-y-1">
              <span className="block text-[11px] text-muted-foreground">Kur (1 {value.currency} = ₺)</span>
              <Input
                inputMode="decimal"
                className="h-8 tabular-nums"
                placeholder={rates ? "—" : "yükleniyor…"}
                value={value.rate}
                onChange={(e) => set({ rate: e.target.value })}
              />
            </label>
            <ArrowRight className="mb-2 size-4 text-muted-foreground" />
            <label className="space-y-1">
              <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                TL karşılığı
                {value.tlEdited && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    onClick={() => onChange({ ...value, tlEdited: false, tl: computeTl(value.amount, value.rate) })}
                  >
                    <RotateCcw className="size-3" /> kura göre
                  </button>
                )}
              </span>
              <Input
                inputMode="decimal"
                className="h-8 font-medium tabular-nums"
                value={value.tl}
                onChange={(e) => onChange({ ...value, tl: e.target.value, tlEdited: true })}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rates?.source
              ? `${rates.source} ${rates.date ?? ""} ${side === "buying" ? "alış" : "satış"} kuru otomatik getirildi; kuru ya da TL tutarını değiştirebilirsiniz.`
              : rates
                ? "Güncel kur alınamadı; kuru elle girin."
                : "Güncel kur getiriliyor…"}
            {result.tlKurus != null && (
              <>
                {" "}Kayda geçecek: <b className="text-foreground">{formatCurrency(result.tlKurus)}</b>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
