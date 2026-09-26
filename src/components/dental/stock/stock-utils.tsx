import { Badge } from "@/components/ui/badge";

export const money = (kurus: number | null | undefined) =>
  kurus == null ? "—" : new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);

/** "12,50" / "12.5" / "1.250,00" → kuruş; empty → null. */
export function parseMoney(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const moneyInput = (kurus: number | null | undefined) => (kurus == null ? "" : (kurus / 100).toFixed(2).replace(".", ","));

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(d)) : "—";
export const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
export const toDateInput = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export type Reason = "SATIN_ALMA" | "ACILIS" | "KULLANIM" | "HASTA_KULLANIMI" | "SAYIM" | "FIRE" | "SKT_IMHA" | "IADE";

export const REASON_META: Record<Reason, { label: string; tone: string }> = {
  SATIN_ALMA: { label: "Satın Alma", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  ACILIS: { label: "Açılış Stoğu", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  KULLANIM: { label: "Klinik Kullanımı", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  HASTA_KULLANIMI: { label: "Hasta Kullanımı", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  SAYIM: { label: "Sayım Düzeltme", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  FIRE: { label: "Fire / Hasar", tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
  SKT_IMHA: { label: "SKT İmha", tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
  IADE: { label: "Tedarikçiye İade", tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

export function ReasonBadge({ reason, type }: { reason: Reason | null; type: "GIRIS" | "CIKIS" }) {
  const meta = reason ? REASON_META[reason] : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${meta?.tone ?? "bg-muted"}`}>
      {type === "GIRIS" ? "↓" : "↑"} {meta?.label ?? (type === "GIRIS" ? "Giriş" : "Çıkış")}
    </span>
  );
}

const DAY = 86_400_000;
export function daysUntil(d: string | Date) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / DAY);
}

/** Expiry with urgency colour: past = red, ≤60 days = amber. */
export function ExpiryBadge({ date }: { date: string | Date | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const left = daysUntil(date);
  if (left <= 0) return <Badge variant="destructive">SKT geçti · {fmtDate(date)}</Badge>;
  if (left <= 60)
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
        {left} gün · {fmtDate(date)}
      </Badge>
    );
  return <span className="text-sm text-muted-foreground">{fmtDate(date)}</span>;
}

/** Stock level vs. critical/target as a small bar. */
export function StockBar({ quantity, critical, target }: { quantity: number; critical: number; target: number | null }) {
  const max = Math.max(target ?? critical * 2, critical + 1, quantity, 1);
  const pct = Math.min(100, Math.round((quantity / max) * 100));
  const tone = quantity === 0 ? "bg-red-500" : quantity <= critical ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" title={`Kritik: ${critical}${target ? ` · Hedef: ${target}` : ""}`}>
      <div className={`h-full ${tone}`} style={{ width: `${Math.max(pct, quantity > 0 ? 4 : 0)}%` }} />
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Semicolon + BOM: opens correctly in Turkish-locale Excel.
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
