import type { GlobalRole } from "@prisma/client";

export const ROLE_LABELS: Record<GlobalRole, string> = {
  PATRON: "Patron",
  SUBE_YONETICISI: "Şube Yöneticisi",
  DOKTOR: "Doktor",
  SEKRETER: "Sekreter",
  TEKNISYEN: "Teknisyen",
};
