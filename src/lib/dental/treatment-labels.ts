export const TREATMENT_SCOPE_OPTIONS = [
  { value: "DIS_BAZLI", label: "Diş bazlı" },
  { value: "CENE_BAZLI", label: "Çene bazlı" },
] as const;

export function scopeLabel(value: string) {
  return TREATMENT_SCOPE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}
