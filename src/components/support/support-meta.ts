import { Bug, CreditCard, Lightbulb, MessageCircleQuestion, type LucideIcon } from "lucide-react";

export type TicketStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type TicketPriority = "DUSUK" | "NORMAL" | "YUKSEK" | "ACIL";
export type TicketCategory = "TEKNIK" | "FATURALAMA" | "OZELLIK_TALEBI" | "DIGER";

// Wording differs by viewer: "Açık" means *we* owe a reply (staff), while
// the clinic sees that as "Yanıt bekleniyor".
export const STATUS_META: Record<TicketStatus, { staff: string; customer: string; dot: string; chip: string }> = {
  OPEN: {
    staff: "Yanıt Bekliyor",
    customer: "İnceleniyor",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  ANSWERED: {
    staff: "Yanıtlandı",
    customer: "Yanıtlandı",
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  CLOSED: {
    staff: "Kapalı",
    customer: "Kapalı",
    dot: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
  },
};

export const PRIORITY_META: Record<TicketPriority, { label: string; bar: string; chip: string }> = {
  ACIL: { label: "Acil", bar: "bg-red-500", chip: "bg-red-500/15 text-red-700 dark:text-red-300" },
  YUKSEK: { label: "Yüksek", bar: "bg-orange-500", chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  NORMAL: { label: "Normal", bar: "bg-sky-500/60", chip: "bg-muted text-muted-foreground" },
  DUSUK: { label: "Düşük", bar: "bg-muted-foreground/25", chip: "bg-muted text-muted-foreground" },
};

export const CATEGORY_META: Record<TicketCategory, { label: string; icon: LucideIcon; color: string }> = {
  TEKNIK: { label: "Teknik", icon: Bug, color: "text-violet-600 dark:text-violet-400" },
  FATURALAMA: { label: "Faturalama", icon: CreditCard, color: "text-emerald-600 dark:text-emerald-400" },
  OZELLIK_TALEBI: { label: "Özellik Talebi", icon: Lightbulb, color: "text-amber-600 dark:text-amber-400" },
  DIGER: { label: "Diğer", icon: MessageCircleQuestion, color: "text-muted-foreground" },
};

export function relativeTime(d: string | Date) {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} gün`;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short" }).format(new Date(d));
}

export const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
