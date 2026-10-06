import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_STATUS_LABEL, type SubscriptionStatusKey } from "@/lib/subscription-access";

const DAY_MS = 24 * 60 * 60 * 1000;

export function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(d));
}

export function fmtDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(d));
}

export function fmtRelative(d: string | Date | null | undefined) {
  if (!d) return "hiç";
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat önce`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} gün önce`;
  return fmtDate(d);
}

/** Whole days until `end` (negative once past); null for open-ended. */
export function daysLeft(end: string | Date | null | undefined) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / DAY_MS);
}

type SubLike = { status: string; currentPeriodEnd: string | Date | null } | null | undefined;

/** Status as the clinic actually experiences it — an ACTIVE sub whose end date passed is locked out. */
export function SubscriptionBadge({ sub }: { sub: SubLike }) {
  if (!sub) return <Badge variant="outline">Abonelik yok</Badge>;
  const left = daysLeft(sub.currentPeriodEnd);
  const usableStatus = sub.status === "ACTIVE" || sub.status === "TRIAL" || sub.status === "PAST_DUE";
  if (usableStatus && left !== null && left <= 0) return <Badge variant="destructive">Süresi doldu</Badge>;

  const label = SUBSCRIPTION_STATUS_LABEL[sub.status as SubscriptionStatusKey] ?? sub.status;
  if (sub.status === "CANCELED" || sub.status === "PAST_DUE") return <Badge variant="destructive">{label}</Badge>;
  if (sub.status === "TRIAL") return <Badge variant="outline" className="border-sky-500/50 text-sky-600 dark:text-sky-400">{label}</Badge>;
  if (sub.status === "PENDING_PAYMENT") return <Badge variant="outline">{label}</Badge>;
  return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{label}</Badge>;
}

export function DaysLeftText({ end }: { end: string | Date | null | undefined }) {
  const left = daysLeft(end);
  if (left === null) return <span className="text-muted-foreground">Süresiz</span>;
  if (left <= 0) return <span className="text-destructive">{Math.abs(left)} gün önce bitti</span>;
  return <span className={left <= 7 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>{left} gün kaldı</span>;
}

export const MODULE_LABEL: Record<string, string> = {
  DENTAL: "Dental",
  MUHASEBE: "Muhasebe",
  LABORATUVAR: "Laboratuvar",
};

export const PLATFORM_ACTION_LABEL: Record<string, string> = {
  "org.sensitive_peek": "Hasta verisi görüntülendi",
  "org.subscription_updated": "Abonelik güncellendi",
  "org.created_by_platform": "Hesap ekip tarafından açıldı",
  "org.subscription_assigned": "Üyelik atandı / düzenlendi",
  "org.subscription_extended": "Üyelik uzatıldı",
  "org.subscription_shortened": "Üyelik kısaltıldı",
  "org.subscription_status_changed": "Üyelik durumu değişti",
  "org.note_updated": "Not güncellendi",
  "org.staff_account_toggled": "Kullanıcı hesabı açıldı/kapatıldı",
  "org.staff_password_reset": "Kullanıcı şifresi sıfırlandı",
  "staff.created": "Ekip üyesi eklendi",
  "staff.deactivated": "Ekip üyesi devre dışı bırakıldı",
  "grant.issued": "Geçici erişim verildi",
  "grant.revoked": "Geçici erişim iptal edildi",
  "plan.updated": "Plan güncellendi",
};
