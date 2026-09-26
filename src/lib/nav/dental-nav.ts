import type { NavItem, PrimaryAction } from "@/lib/nav/types";

export const dentalPrimaryAction: PrimaryAction = {
  href: "/dental/hastalar/yeni",
  label: "Yeni Hasta Ekle",
  icon: "UserPlus",
};

export const dentalNav: NavItem[] = [
  { href: "/dental", label: "Ana Sayfa", icon: "Home", section: "Genel" },
  {
    href: "",
    label: "Randevu",
    icon: "CalendarClock",
    section: "Genel",
    children: [
      { href: "/dental/randevu-olustur", label: "Randevu Oluştur", icon: "CalendarClock", section: "Genel" },
      { href: "/dental/randevu-takvimi", label: "Randevu Takvimi", icon: "CalendarClock", section: "Genel" },
    ],
  },
  {
    href: "",
    label: "Hastalar",
    icon: "Users",
    section: "Sayfalar",
    children: [
      { href: "/dental/hastalar/yeni", label: "Hasta Ekle", icon: "UserPlus", section: "Sayfalar" },
      { href: "/dental/hastalar", label: "Hasta Kartı Görüntüle", icon: "IdCard", section: "Sayfalar" },
      { href: "/dental/hasta-listesi", label: "Hasta Listesi", icon: "Users", section: "Sayfalar" },
      { href: "/dental/hastalar/toplu-ekle", label: "Toplu Hasta Ekleme", icon: "Upload", section: "Sayfalar" },
      { href: "/dental/onam-formu", label: "Onam Formları", icon: "FileSignature", section: "Sayfalar" },
      { href: "/dental/anamnez-formlari", label: "Anamnez Formları", icon: "FileHeart", section: "Sayfalar" },
    ],
  },
  { href: "/dental/stok-takibi", label: "Stok Takibi", icon: "Boxes", section: "Sayfalar" },
  { href: "/dental/hizmetler", label: "Hizmetler", icon: "Briefcase", section: "Sayfalar" },
  { href: "/dental/sms-hizmetleri", label: "SMS Hizmetleri", icon: "MessageSquare", section: "Sayfalar" },
  { href: "/dental/whatsapp-hizmetleri", label: "WhatsApp Hizmetleri", icon: "MessageCircle", section: "Sayfalar" },
  { href: "/dental/destek", label: "Destek", icon: "LifeBuoy", section: "Sayfalar" },
  {
    href: "/dental/raporlar",
    label: "Raporlar",
    icon: "BarChart3",
    section: "Diğer",
    capability: "dental:reports:branch",
  },
  {
    href: "/dental/ayarlar",
    label: "Ayarlar",
    icon: "Settings",
    section: "Diğer",
    capability: "org:user:manage",
  },
  { href: "/dental/yonetim", label: "Yönetim", icon: "ShieldCheck", section: "Diğer", patronOnly: true },
  { href: "/dental/sistem-kayitlari", label: "Sistem Kayıtları", icon: "ScrollText", section: "Diğer", patronOnly: true },
];
