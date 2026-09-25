// Plain module (not "use client") so the server page can read the values.
export const DETAIL_TABS = ["genel", "uyelik", "kullanicilar", "kayitlar", "gecmis", "hastalar"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];
