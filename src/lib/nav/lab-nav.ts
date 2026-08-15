import type { NavItem, PrimaryAction } from "@/lib/nav/types";

export const labPrimaryAction: PrimaryAction = {
  href: "/laboratuvar/hastalarim/yeni",
  label: "Hasta Ekle",
  icon: "UserPlus",
};

export const labNav: NavItem[] = [
  { href: "/laboratuvar", label: "Ana Sayfa", icon: "Home", section: "Genel" },
  {
    href: "/laboratuvar/hastalarim",
    label: "Hastalarım",
    icon: "Users",
    section: "Sayfalar",
    capability: "lab:patient:read",
  },
  {
    href: "/laboratuvar/islemlerim",
    label: "İşlemlerim",
    icon: "Briefcase",
    section: "Sayfalar",
    capability: "lab:patient:write",
  },
  { href: "/laboratuvar/bildirimler", label: "Bildirimler", icon: "Bell", section: "Sayfalar" },
  {
    href: "/laboratuvar/feedback",
    label: "Feedback",
    icon: "MessageSquare",
    section: "Sayfalar",
    capability: "lab:patient:read",
  },
  {
    href: "/laboratuvar/odemeler",
    label: "Ödemeler",
    icon: "Receipt",
    section: "Diğer",
    capability: "lab:cash:read",
  },
  {
    href: "/laboratuvar/kasa",
    label: "Kasa",
    icon: "Wallet",
    section: "Diğer",
    capability: "lab:cash:read",
  },
  {
    href: "/laboratuvar/raporlar",
    label: "Raporlar",
    icon: "BarChart3",
    section: "Diğer",
    capability: "lab:reports:branch",
  },
  {
    href: "/laboratuvar/ayarlar",
    label: "Ayarlar",
    icon: "Settings",
    section: "Diğer",
    capability: "lab:staff:manage",
  },
];
