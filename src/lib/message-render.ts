// Shared by the server (actual sends) and the browser (live preview in the
// template editor), so what the clinic sees in the preview is exactly what
// the patient receives.

export type TokenGroup = "Hasta" | "Randevu" | "Klinik";

export const MESSAGE_TOKENS: {
  token: string;
  label: string;
  group: TokenGroup;
  sample: string;
  needs?: "appointment" | "birthDate";
}[] = [
  { token: "{ad}", label: "Hasta Adı Soyadı", group: "Hasta", sample: "Ayşe Yılmaz" },
  { token: "{ad_kisa}", label: "Hasta Adı (sadece ad)", group: "Hasta", sample: "Ayşe" },
  { token: "{yas}", label: "Yaşı", group: "Hasta", sample: "34", needs: "birthDate" },
  { token: "{randevu_tarihi}", label: "Randevu Tarihi", group: "Randevu", sample: "12 Ekim 2026", needs: "appointment" },
  { token: "{randevu_gunu}", label: "Randevu Günü", group: "Randevu", sample: "Pazartesi", needs: "appointment" },
  { token: "{randevu_saati}", label: "Randevu Saati", group: "Randevu", sample: "14:30", needs: "appointment" },
  { token: "{hekim}", label: "Hekim Adı", group: "Randevu", sample: "Dr. Mehmet Demir", needs: "appointment" },
  { token: "{klinik}", label: "Klinik Adı", group: "Klinik", sample: "Gülüş Diş Kliniği" },
  { token: "{sube}", label: "Şube Adı", group: "Klinik", sample: "Kadıköy Şubesi" },
  { token: "{klinik_telefon}", label: "Klinik Telefonu", group: "Klinik", sample: "0216 123 45 67" },
];

export type RenderContext = {
  patient: { fullName: string; birthDate?: Date | string | null };
  clinic: { name: string; phone?: string | null };
  branch?: { name: string; phone?: string | null } | null;
  appointment?: { startsAt: Date | string; doctorName: string } | null;
  now?: Date;
};

const TZ = "Europe/Istanbul";

export function usedTokens(body: string) {
  return MESSAGE_TOKENS.filter((t) => body.includes(t.token));
}

export function needsAppointment(body: string) {
  return usedTokens(body).some((t) => t.needs === "appointment");
}

function age(birth: Date, now: Date) {
  let a = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
  return a;
}

/** Throws with a Turkish message when a token's data is missing. */
export function renderMessage(body: string, ctx: RenderContext): string {
  const a = ctx.appointment;
  if (needsAppointment(body) && !a) {
    throw new Error("Mesajda randevu bilgisi var ama ilgili randevu yok.");
  }
  if (body.includes("{yas}") && !ctx.patient.birthDate) {
    throw new Error("Mesajda {yas} var ama hastanın doğum tarihi kayıtlı değil.");
  }
  const starts = a ? new Date(a.startsAt) : null;
  const values: Record<string, string> = {
    "{ad}": ctx.patient.fullName.trim(),
    "{ad_kisa}": ctx.patient.fullName.trim().split(/\s+/)[0] ?? "",
    "{yas}": ctx.patient.birthDate ? String(age(new Date(ctx.patient.birthDate), ctx.now ?? new Date())) : "",
    "{randevu_tarihi}": starts ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: TZ }).format(starts) : "",
    "{randevu_gunu}": starts ? new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: TZ }).format(starts) : "",
    "{randevu_saati}": starts ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: TZ }).format(starts) : "",
    "{hekim}": a?.doctorName ?? "",
    "{klinik}": ctx.clinic.name,
    "{sube}": ctx.branch?.name ?? ctx.clinic.name,
    "{klinik_telefon}": ctx.branch?.phone || ctx.clinic.phone || "",
  };
  let out = body;
  for (const [token, value] of Object.entries(values)) out = out.replaceAll(token, value);
  return out.replace(/[ \t]+/g, " ").trim();
}

/** Renders with the sample values — for the editor's live preview. */
export function renderSample(body: string, clinicName?: string) {
  let out = body;
  for (const t of MESSAGE_TOKENS) {
    out = out.replaceAll(t.token, t.token === "{klinik}" && clinicName ? clinicName : t.sample);
  }
  return out;
}

// GSM 03.38 basic set (+ extension chars, which count double).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";
const TURKISH = "çğıöşüÇĞİÖŞÜ";

/**
 * Approximate billing: how many SMS one message costs. NetGSM's Turkish
 * encoding fits 155 chars in a single SMS (150 per part when split); plain
 * GSM 160/153; anything else (emoji etc.) falls back to Unicode 70/67.
 */
export function smsSegments(text: string) {
  let gsmLength = 0;
  let encoding: "GSM" | "TR" | "UNICODE" = "GSM";
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLength += 1;
    else if (GSM_EXT.includes(ch)) gsmLength += 2;
    else if (TURKISH.includes(ch)) {
      gsmLength += 1;
      if (encoding === "GSM") encoding = "TR";
    } else {
      encoding = "UNICODE";
    }
  }
  const length = encoding === "UNICODE" ? [...text].length : gsmLength;
  const [single, multi] = encoding === "UNICODE" ? [70, 67] : encoding === "TR" ? [155, 150] : [160, 153];
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi);
  return { length, segments, encoding, perSegment: segments > 1 ? multi : single };
}
