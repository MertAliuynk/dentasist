// Edge-safe (no Prisma import) — shared by the Node auth callback, the tRPC
// entitlement middleware and the Edge proxy so all three agree on when a
// clinic's subscription actually lets them in.

export type SubscriptionStatusKey = "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIAL";

// PAST_DUE still gets in (grace period — the platform team decides when to
// cut off by setting CANCELED); PENDING_PAYMENT and CANCELED don't.
const USABLE: SubscriptionStatusKey[] = ["ACTIVE", "TRIAL", "PAST_DUE"];

/** `endsAt` null means open-ended (no expiry set). */
export function isSubscriptionUsable(
  status: string | null | undefined,
  endsAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!status || !USABLE.includes(status as SubscriptionStatusKey)) return false;
  if (endsAt && new Date(endsAt) <= now) return false;
  return true;
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatusKey, string> = {
  PENDING_PAYMENT: "Ödeme Bekliyor",
  ACTIVE: "Aktif",
  PAST_DUE: "Ödemesi Gecikmiş",
  CANCELED: "Kapatıldı",
  TRIAL: "Deneme",
};
