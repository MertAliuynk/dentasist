import type { Capability } from "@/server/rbac/permissions";

export type IconKey =
  | "Home"
  | "CalendarClock"
  | "IdCard"
  | "Users"
  | "UserPlus"
  | "Upload"
  | "FileSignature"
  | "MessageSquare"
  | "MessageCircle"
  | "PhoneIncoming"
  | "BarChart3"
  | "Settings"
  | "Wallet"
  | "Stethoscope"
  | "Receipt"
  | "LineChart"
  | "ShieldCheck"
  | "Bell"
  | "Briefcase"
  | "LifeBuoy"
  | "Boxes"
  | "FileHeart"
  | "FileText"
  | "ScrollText";

export type NavSection = "Genel" | "Sayfalar" | "Diğer";

export type NavItem = {
  /** Omit (or leave empty) on a group header — it just toggles its children open/closed, it doesn't navigate anywhere itself. */
  href: string;
  label: string;
  icon: IconKey;
  section: NavSection;
  capability?: Capability;
  /** Gated by actual PATRON role membership, not the capability/override system (see requirePatron). */
  patronOnly?: boolean;
  /** Grouped sub-items (e.g. "Hastalar" -> Hasta Ekle/Hasta Listesi/...), rendered as an expandable section instead of a direct link. */
  children?: NavItem[];
};

export type PrimaryAction = {
  href: string;
  label: string;
  icon: IconKey;
};
