export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<Currency, { symbol: string; label: string }> = {
  TRY: { symbol: "₺", label: "Türk Lirası" },
  USD: { symbol: "$", label: "ABD Doları" },
  EUR: { symbol: "€", label: "Euro" },
  GBP: { symbol: "£", label: "İngiliz Sterlini" },
};

/** "1.234,56" / "1234.56" → 1234.56 (null when empty/invalid). */
export function parseDecimal(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const decimalInput = (n: number | null | undefined, digits = 2) =>
  n == null ? "" : n.toFixed(digits).replace(".", ",");

export function formatCurrency(amountMinor: number, currency: Currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amountMinor / 100);
}
