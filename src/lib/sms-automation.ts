// Shared (server + browser) definitions for SMS "Otomatik Mesajlar".

export type AutomationTrigger =
  | "APPOINTMENT_BEFORE"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_AFTER"
  | "NO_SHOW"
  | "BIRTHDAY"
  | "RECALL";

export type TimingMode = "RELATIVE" | "FIXED_TIME";

export type AutomationTiming = {
  trigger: AutomationTrigger;
  timingMode: TimingMode;
  offsetMinutes: number;
  dayOffset: number;
  sendTime: string | null;
  recallDays: number | null;
};

export const TRIGGER_META: Record<
  AutomationTrigger,
  { label: string; description: string; modes: TimingMode[]; defaultText: string }
> = {
  APPOINTMENT_BEFORE: {
    label: "Randevudan önce (hatırlatma)",
    description: "Planlanmış randevusu olan hastaya, randevudan belirli bir süre önce gider.",
    modes: ["RELATIVE", "FIXED_TIME"],
    defaultText:
      "Sayın {ad}, {randevu_tarihi} {randevu_gunu} saat {randevu_saati} {klinik} randevunuzu hatırlatırız. Bilgi: {klinik_telefon}",
  },
  APPOINTMENT_CREATED: {
    label: "Randevu oluşturulunca (onay)",
    description: "Hastaya yeni randevu verildiğinde onay mesajı gider.",
    modes: ["RELATIVE"],
    defaultText: "Sayın {ad}, {randevu_tarihi} saat {randevu_saati} için {hekim} ile randevunuz oluşturulmuştur. {klinik}",
  },
  APPOINTMENT_AFTER: {
    label: "Randevudan sonra",
    description: "Randevuya gelen (Geldi / Tamamlandı) hastaya, randevudan sonra gider. Ör. geçmiş olsun, memnuniyet.",
    modes: ["RELATIVE", "FIXED_TIME"],
    defaultText: "Sayın {ad}, bugünkü ziyaretiniz için teşekkür ederiz. Geçmiş olsun dileriz. {klinik}",
  },
  NO_SHOW: {
    label: "Randevuya gelmeyen hastaya",
    description: "Randevusu 'Gelmedi' olarak işaretlenen hastaya gider.",
    modes: ["RELATIVE", "FIXED_TIME"],
    defaultText: "Sayın {ad}, {randevu_tarihi} tarihli randevunuza gelemediğinizi gördük. Yeni randevu için: {klinik_telefon} {klinik}",
  },
  BIRTHDAY: {
    label: "Doğum günü",
    description: "Doğum tarihi kayıtlı hastalara, doğum gününde belirlediğiniz saatte gider.",
    modes: ["FIXED_TIME"],
    defaultText: "Sevgili {ad_kisa}, doğum gününüzü kutlar, sağlıklı ve gülümsemeyle dolu bir yıl dileriz. {klinik}",
  },
  RECALL: {
    label: "Kontrol hatırlatması (uzun süredir gelmeyen)",
    description: "Son ziyaretinin üzerinden belirli gün geçen ve ileri tarihli randevusu olmayan hastaya gider.",
    modes: ["FIXED_TIME"],
    defaultText: "Sayın {ad}, son diş kontrolünüzün üzerinden 6 ay geçti. Kontrol randevusu için: {klinik_telefon} {klinik}",
  },
};

export const TRIGGERS = Object.keys(TRIGGER_META) as AutomationTrigger[];

function duration(min: number) {
  if (min === 0) return "hemen";
  if (min % 1440 === 0) return `${min / 1440} gün`;
  if (min % 60 === 0) return `${min / 60} saat`;
  return `${min} dakika`;
}

/** "Randevudan 1 gün önce saat 18:00" — shown on rule cards. */
export function describeTiming(t: AutomationTiming): string {
  const at = t.sendTime ?? "09:00";
  switch (t.trigger) {
    case "APPOINTMENT_BEFORE":
      if (t.timingMode === "FIXED_TIME") {
        return t.dayOffset === 0 ? `Randevu günü saat ${at}'de` : `Randevudan ${t.dayOffset} gün önce saat ${at}'de`;
      }
      return `Randevudan ${duration(t.offsetMinutes)} önce`;
    case "APPOINTMENT_CREATED":
      return t.offsetMinutes === 0 ? "Randevu oluşturulur oluşturulmaz" : `Randevu oluşturulduktan ${duration(t.offsetMinutes)} sonra`;
    case "APPOINTMENT_AFTER":
    case "NO_SHOW": {
      const what = t.trigger === "NO_SHOW" ? "Gelinmeyen randevudan" : "Randevu bitiminden";
      if (t.timingMode === "FIXED_TIME") {
        return t.dayOffset === 0 ? `Randevu günü saat ${at}'de` : `${what} ${t.dayOffset} gün sonra saat ${at}'de`;
      }
      return `${what} ${duration(t.offsetMinutes)} sonra`;
    }
    case "BIRTHDAY":
      return `Doğum gününde saat ${at}'de`;
    case "RECALL":
      return `Son ziyaretten ${t.recallDays ?? 180} gün sonra, saat ${at}'de (ileri randevusu yoksa)`;
  }
}

export type AutomationPreset = AutomationTiming & { key: string; name: string; hint: string };

// One-click starters on the "Otomatik Mesajlar" tab.
export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    key: "reminder_day_before",
    name: "Randevu Hatırlatma (1 gün önce)",
    hint: "Randevudan bir gün önce akşam 18:00'de",
    trigger: "APPOINTMENT_BEFORE",
    timingMode: "FIXED_TIME",
    offsetMinutes: 0,
    dayOffset: 1,
    sendTime: "18:00",
    recallDays: null,
  },
  {
    key: "reminder_2h",
    name: "Randevu Hatırlatma (2 saat önce)",
    hint: "Randevudan 2 saat önce, son hatırlatma",
    trigger: "APPOINTMENT_BEFORE",
    timingMode: "RELATIVE",
    offsetMinutes: 120,
    dayOffset: 0,
    sendTime: null,
    recallDays: null,
  },
  {
    key: "confirmation",
    name: "Randevu Onayı",
    hint: "Randevu verilir verilmez",
    trigger: "APPOINTMENT_CREATED",
    timingMode: "RELATIVE",
    offsetMinutes: 0,
    dayOffset: 0,
    sendTime: null,
    recallDays: null,
  },
  {
    key: "after_visit",
    name: "Geçmiş Olsun",
    hint: "Tedaviden 2 saat sonra",
    trigger: "APPOINTMENT_AFTER",
    timingMode: "RELATIVE",
    offsetMinutes: 120,
    dayOffset: 0,
    sendTime: null,
    recallDays: null,
  },
  {
    key: "no_show",
    name: "Gelmeyen Hastaya Yeni Randevu Daveti",
    hint: "Kaçırılan randevudan 1 saat sonra",
    trigger: "NO_SHOW",
    timingMode: "RELATIVE",
    offsetMinutes: 60,
    dayOffset: 0,
    sendTime: null,
    recallDays: null,
  },
  {
    key: "birthday",
    name: "Doğum Günü Kutlaması",
    hint: "Doğum gününde saat 10:00'da",
    trigger: "BIRTHDAY",
    timingMode: "FIXED_TIME",
    offsetMinutes: 0,
    dayOffset: 0,
    sendTime: "10:00",
    recallDays: null,
  },
  {
    key: "recall_6m",
    name: "6 Aylık Kontrol Hatırlatması",
    hint: "Son ziyaretten 180 gün sonra saat 11:00'de",
    trigger: "RECALL",
    timingMode: "FIXED_TIME",
    offsetMinutes: 0,
    dayOffset: 0,
    sendTime: "11:00",
    recallDays: 180,
  },
];
