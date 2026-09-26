// One visual language for appointment status, shared by the calendar and
// the dashboard: the state reads from the block's *styling* (fill, border,
// stripes) rather than tick/cross icons. The doctor's colour always carries
// through, so "whose patient" stays obvious too. Styles: globals.css `.appt-*`.

export type ApptVisual = "upcoming" | "overdue" | "done" | "noshow" | "postponed" | "canceled";

export function apptVisual(status: string, startsAt: string | Date, now = new Date()): ApptVisual {
  switch (status) {
    case "ARRIVED":
    case "COMPLETED":
      return "done";
    case "NO_SHOW":
      return "noshow";
    case "POSTPONED":
      return "postponed";
    case "CANCELED":
      return "canceled";
    default:
      // Still SCHEDULED after its start time → someone needs to mark it.
      return new Date(startsAt) <= now ? "overdue" : "upcoming";
  }
}

export const APPT_VISUAL_LABEL: Record<ApptVisual, string> = {
  upcoming: "Bekleniyor",
  overdue: "Saati geçti · işaretlenmedi",
  done: "Geldi",
  noshow: "Gelmedi",
  postponed: "Ertelendi",
  canceled: "İptal",
};

export const APPT_VISUAL_ORDER: ApptVisual[] = ["upcoming", "overdue", "done", "noshow", "postponed", "canceled"];
