export const LAB_TREATMENT_STATUS_LABEL: Record<string, string> = {
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
};

export function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}
