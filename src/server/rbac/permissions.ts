import type { GlobalRole } from "@prisma/client";

export const ALL_CAPABILITIES = [
  "dental:patient:read",
  "dental:patient:write",
  "dental:appointment:read:own",
  "dental:appointment:read:branch",
  "dental:appointment:write",
  "dental:treatment:write",
  "dental:reports:branch",
  "dental:reports:org",
  "dental:stock:read",
  "dental:stock:write",
  "dental:stock:manage",
  "dental:messaging:manage",
  "dental:messaging:send",
  "dental:messaging:settings",
  "muhasebe:cash:read",
  "muhasebe:cash:write",
  "muhasebe:cash:delete",
  "muhasebe:paymentplan:write",
  "muhasebe:paymentplan:activate",
  "muhasebe:reports:branch",
  "muhasebe:reports:org",
  "lab:patient:read",
  "lab:patient:write",
  "lab:stage:write",
  "lab:stage:finish",
  "lab:feedback:write",
  "lab:cash:read",
  "lab:cash:write",
  "lab:reports:branch",
  "lab:reports:org",
  "lab:branch:manage",
  "lab:staff:manage",
  "lab:catalog:manage",
  "org:branch:manage",
  "org:user:manage",
  "org:expensecategory:manage",
] as const;

export type Capability = (typeof ALL_CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "dental:patient:read": "Hasta kayıtlarını görüntüleme",
  "dental:patient:write": "Hasta kaydı oluşturma / düzenleme",
  "dental:appointment:read:own": "Yalnızca kendi randevularını görüntüleme",
  "dental:appointment:read:branch": "Şubedeki tüm randevuları görüntüleme",
  "dental:appointment:write": "Randevu oluşturma / düzenleme",
  "dental:treatment:write": "Tedavi ekleme / durumunu değiştirme",
  "dental:reports:branch": "Şube raporlarını görüntüleme",
  "dental:reports:org": "Tüm şubelerin raporlarını görüntüleme",
  "dental:stock:read": "Stok takibini görüntüleme",
  "dental:stock:write": "Stok hareketi / ürün kullanımı ekleme",
  "dental:stock:manage": "Ürün, kategori ve tedarikçi ekleme / düzenleme",
  "dental:messaging:manage": "SMS / WhatsApp mesaj şablonu ekleme / düzenleme",
  "dental:messaging:send": "Hastalara SMS / WhatsApp mesajı gönderme",
  "dental:messaging:settings": "SMS sağlayıcı hesabını (NetGSM) bağlama ve otomatik hatırlatma ayarları",
  "muhasebe:cash:read": "Günlük kasayı görüntüleme",
  "muhasebe:cash:write": "Kasaya gelir / gider girişi yapma",
  "muhasebe:cash:delete": "Kasa kaydı (gelir / gider) silme",
  "muhasebe:paymentplan:write": "Ödeme planı oluşturma / düzenleme",
  "muhasebe:paymentplan:activate": "Ödeme planını işleme alma",
  "muhasebe:reports:branch": "Şube muhasebe raporlarını görüntüleme",
  "muhasebe:reports:org": "Tüm şubelerin muhasebe raporlarını görüntüleme",
  "lab:patient:read": "Laboratuvar hastalarını / işlerini görüntüleme",
  "lab:patient:write": "Laboratuvar hastası ve tedavisi oluşturma",
  "lab:stage:write": "Aşama ekleme",
  "lab:stage:finish": "Tedaviyi bitim yapma",
  "lab:feedback:write": "Tamamlanan tedaviye geri bildirim verme",
  "lab:cash:read": "Laboratuvar kasasını / hekim borcunu görüntüleme",
  "lab:cash:write": "Laboratuvar kasasına gelir / gider girişi yapma",
  "lab:reports:branch": "Şube laboratuvar raporlarını görüntüleme",
  "lab:reports:org": "Tüm şubelerin laboratuvar raporlarını görüntüleme",
  "lab:branch:manage": "Laboratuvar şubesi ekleme / yönetme",
  "lab:staff:manage": "Hekim / teknisyen hesabı ekleme / yönetme",
  "lab:catalog:manage": "Protez türü, aşama, diş rengi ve gider türü kataloglarını yönetme",
  "org:branch:manage": "Şube ekleme / yönetme",
  "org:user:manage": "Personel ekleme / yönetme",
  "org:expensecategory:manage": "Gider kalemlerini yönetme",
};

export const CAPABILITY_GROUPS: { label: string; capabilities: Capability[] }[] = [
  { label: "Dental", capabilities: ALL_CAPABILITIES.filter((c) => c.startsWith("dental:")) },
  { label: "Muhasebe", capabilities: ALL_CAPABILITIES.filter((c) => c.startsWith("muhasebe:")) },
  { label: "Laboratuvar", capabilities: ALL_CAPABILITIES.filter((c) => c.startsWith("lab:")) },
  { label: "Organizasyon", capabilities: ALL_CAPABILITIES.filter((c) => c.startsWith("org:")) },
];

const PATRON: Capability[] = [
  "dental:patient:read",
  "dental:patient:write",
  "dental:appointment:read:branch",
  "dental:appointment:write",
  "dental:treatment:write",
  "dental:reports:branch",
  "dental:reports:org",
  "dental:stock:read",
  "dental:stock:write",
  "dental:stock:manage",
  "dental:messaging:manage",
  "dental:messaging:send",
  "dental:messaging:settings",
  "muhasebe:cash:read",
  "muhasebe:cash:write",
  "muhasebe:cash:delete",
  "muhasebe:paymentplan:write",
  "muhasebe:paymentplan:activate",
  "muhasebe:reports:branch",
  "muhasebe:reports:org",
  "lab:patient:read",
  "lab:patient:write",
  "lab:stage:write",
  "lab:stage:finish",
  "lab:feedback:write",
  "lab:cash:read",
  "lab:cash:write",
  "lab:reports:branch",
  "lab:reports:org",
  "lab:branch:manage",
  "lab:staff:manage",
  "lab:catalog:manage",
  "org:branch:manage",
  "org:user:manage",
  "org:expensecategory:manage",
];

const SUBE_YONETICISI: Capability[] = [
  "dental:patient:read",
  "dental:patient:write",
  "dental:appointment:read:branch",
  "dental:appointment:write",
  "dental:treatment:write",
  "dental:reports:branch",
  "dental:stock:read",
  "dental:stock:write",
  "dental:stock:manage",
  "dental:messaging:manage",
  "dental:messaging:send",
  "dental:messaging:settings",
  "muhasebe:cash:read",
  "muhasebe:cash:write",
  "muhasebe:paymentplan:write",
  "muhasebe:paymentplan:activate",
  "muhasebe:reports:branch",
  "lab:patient:read",
  "lab:cash:read",
  "lab:reports:branch",
  "lab:branch:manage",
  "lab:staff:manage",
];

const SEKRETER: Capability[] = [
  "dental:patient:read",
  "dental:patient:write",
  "dental:appointment:read:branch",
  "dental:appointment:write",
  "dental:treatment:write",
  "dental:stock:read",
  "dental:stock:write",
  "dental:stock:manage",
  "dental:messaging:manage",
  "dental:messaging:send",
  "muhasebe:cash:read",
  "muhasebe:cash:write",
  "muhasebe:paymentplan:write",
];

const DOKTOR: Capability[] = [
  "dental:patient:read",
  "dental:patient:write",
  "dental:appointment:read:own",
  "dental:appointment:write",
  "dental:treatment:write",
  "dental:stock:read",
  "dental:stock:write",
  "dental:messaging:send",
  "lab:patient:read",
  "lab:patient:write",
  "lab:stage:write",
  "lab:feedback:write",
];

const TEKNISYEN: Capability[] = ["lab:patient:read", "lab:stage:write", "lab:stage:finish"];

export const ROLE_CAPABILITIES: Record<GlobalRole, Capability[]> = {
  PATRON,
  SUBE_YONETICISI,
  SEKRETER,
  DOKTOR,
  TEKNISYEN,
};

export type PermissionEffect = "GRANT" | "REVOKE";
export type CapabilityOverride = { capability: string; effect: PermissionEffect };

/**
 * Role-derived capabilities are the baseline; a per-user override (see
 * UserCapabilityOverride) takes precedence in either direction — granting a
 * capability the role wouldn't otherwise have, or revoking one it would.
 */
export function hasCapability(
  roles: GlobalRole[],
  capability: Capability,
  overrides: CapabilityOverride[] = [],
): boolean {
  const override = overrides.find((o) => o.capability === capability);
  if (override) return override.effect === "GRANT";
  return roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}
