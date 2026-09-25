import type { NavItem } from "@/lib/nav/types";

export const muhasebeNav: NavItem[] = [
  { href: "/muhasebe", label: "Günlük Kasa", icon: "Wallet", section: "Genel" },
  {
    href: "/muhasebe/raporlar",
    label: "Raporlar",
    icon: "BarChart3",
    section: "Genel",
    capability: "muhasebe:reports:branch",
  },
  { href: "/muhasebe/hastalar", label: "Hastalar", icon: "Users", section: "Sayfalar" },
  { href: "/muhasebe/hekimler", label: "Hekimler", icon: "Stethoscope", section: "Sayfalar" },
  { href: "/muhasebe/odeme-listeleri", label: "Ödeme Listeleri", icon: "Receipt", section: "Sayfalar" },
  { href: "/muhasebe/destek", label: "Destek", icon: "LifeBuoy", section: "Sayfalar" },
  {
    href: "/muhasebe/incele",
    label: "İncele",
    icon: "LineChart",
    section: "Diğer",
    capability: "muhasebe:reports:org",
  },
  {
    href: "/muhasebe/ayarlar",
    label: "Ayarlar",
    icon: "Settings",
    section: "Diğer",
    capability: "org:branch:manage",
  },
  { href: "/muhasebe/yonetim", label: "Yönetim", icon: "ShieldCheck", section: "Diğer", patronOnly: true },
  { href: "/muhasebe/sistem-kayitlari", label: "Sistem Kayıtları", icon: "ScrollText", section: "Diğer", patronOnly: true },
];
