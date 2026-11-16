// Static, illustrative previews of the product used on the landing page.
// Plain markup on theme tokens so they follow light/dark; the appointment
// blocks reuse the app's real `.appt-*` status classes from globals.css.
import type { CSSProperties, ReactNode } from "react";

function apptStyle(color: string): CSSProperties {
  return { "--appt-color": color } as CSSProperties;
}

export function MockFrame({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="truncate text-xs font-medium">{title}</p>
        {meta && <div className="shrink-0 text-[11px] text-muted-foreground">{meta}</div>}
      </div>
      {children}
    </div>
  );
}

const DOCTORS = [
  { name: "Dt. Selin Aras", color: "#0ea5e9" },
  { name: "Dt. Kerem Yıldız", color: "#8b5cf6" },
  { name: "Dt. Ece Demir", color: "#f59e0b" },
];

// start / duration in half-hour slots from 09:00
const APPOINTMENTS: {
  doc: number;
  start: number;
  dur: number;
  patient: string;
  what: string;
  status: "upcoming" | "done" | "noshow";
}[] = [
  { doc: 0, start: 0, dur: 2, patient: "Ayşe K.", what: "Kanal tedavisi", status: "done" },
  { doc: 0, start: 3, dur: 1, patient: "Murat T.", what: "Kontrol", status: "upcoming" },
  { doc: 0, start: 5, dur: 2, patient: "Zeynep A.", what: "Dolgu · 36", status: "upcoming" },
  { doc: 1, start: 1, dur: 1, patient: "Can Ö.", what: "Muayene", status: "noshow" },
  { doc: 1, start: 2, dur: 3, patient: "Elif S.", what: "İmplant", status: "upcoming" },
  { doc: 1, start: 6, dur: 1, patient: "Burak D.", what: "Kontrol", status: "upcoming" },
  { doc: 2, start: 0, dur: 1, patient: "Deniz Y.", what: "Diş taşı", status: "done" },
  { doc: 2, start: 2, dur: 2, patient: "Selma G.", what: "Kron prova", status: "upcoming" },
  { doc: 2, start: 5, dur: 1, patient: "Ali R.", what: "Çekim · 48", status: "upcoming" },
];

const SLOT = 30; // px per half hour
const HOURS = ["09:00", "10:00", "11:00", "12:00"];

export function CalendarMock() {
  return (
    <MockFrame
      title="Randevular · Merkez Şube"
      meta={
        <span className="inline-flex rounded-md border border-border p-0.5">
          <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-background">Gün</span>
          <span className="px-1.5 py-0.5">Hafta</span>
        </span>
      }
    >
      <div className="grid grid-cols-[44px_1fr_1fr] sm:grid-cols-[44px_1fr_1fr_1fr]">
        <div className="border-b border-border" />
        {DOCTORS.map((d, i) => (
          <div
            key={d.name}
            className={`flex items-center gap-1.5 border-b border-l border-border px-2 py-2 text-[11px] font-medium ${
              i === 2 ? "hidden sm:flex" : ""
            }`}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="truncate">{d.name}</span>
          </div>
        ))}

        <div className="relative" style={{ height: SLOT * 8 }}>
          {HOURS.map((h, i) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: i * SLOT * 2 + 8 }}
            >
              {h}
            </span>
          ))}
        </div>
        {DOCTORS.map((d, di) => (
          <div
            key={d.name}
            className={`relative border-l border-border ${di === 2 ? "hidden sm:block" : ""}`}
            style={{
              height: SLOT * 8,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${SLOT * 2 - 1}px, var(--border) ${SLOT * 2 - 1}px ${SLOT * 2}px)`,
            }}
          >
            {APPOINTMENTS.filter((a) => a.doc === di).map((a) => (
              <div
                key={a.patient}
                className={`appt appt-${a.status} absolute inset-x-1 overflow-hidden px-1.5 py-1 text-[10.5px] leading-tight`}
                style={{ ...apptStyle(d.color), top: a.start * SLOT + 2, height: a.dur * SLOT - 4 }}
              >
                <p className="appt-title truncate font-medium">{a.patient}</p>
                {a.dur > 1 && <p className="truncate opacity-80">{a.what}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

const STATUS_STYLE = {
  Önerilen: "bg-muted text-muted-foreground",
  Onaylandı: "bg-brand-soft text-brand",
  Tamamlandı: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
} as const;

export function PatientCardMock() {
  const rows: { tooth: string; name: string; status: keyof typeof STATUS_STYLE; price: string }[] = [
    { tooth: "36", name: "Kanal tedavisi", status: "Önerilen", price: "₺4.500" },
    { tooth: "37", name: "Kompozit dolgu", status: "Onaylandı", price: "₺2.200" },
    { tooth: "Üst çene", name: "Diş taşı temizliği", status: "Tamamlandı", price: "₺1.500" },
  ];
  return (
    <MockFrame title="Hasta Kartı · Ayşe Kaya" meta="Dt. Selin Aras">
      <div className="divide-y divide-border text-xs">
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">{r.tooth}</span>
            <span className="truncate">
              {r.name}
              <span className="ml-2 text-muted-foreground tabular-nums">{r.price}</span>
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${STATUS_STYLE[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

export function CashMock() {
  const lines = [
    { label: "Nakit", value: "₺12.400" },
    { label: "Kredi kartı", value: "₺18.750" },
    { label: "Havale / EFT", value: "₺6.200" },
    { label: "Giderler", value: "−₺2.150", muted: true },
  ];
  return (
    <MockFrame title="Günlük Kasa · 18 Kasım" meta="Merkez Şube">
      <div className="px-4 py-3 text-xs">
        <dl className="divide-y divide-dashed divide-border">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between py-1.5">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className={`tabular-nums ${l.muted ? "text-muted-foreground" : ""}`}>{l.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2.5">
          <span className="font-medium">Gün sonu net</span>
          <span className="text-base font-semibold tabular-nums">₺35.200</span>
        </div>
      </div>
      <div className="border-t border-border bg-muted/40 px-4 py-3 text-xs">
        <div className="flex justify-between">
          <span>Elif S. · İmplant ödeme planı</span>
          <span className="text-muted-foreground tabular-nums">2 / 6 taksit</span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full ${i < 2 ? "bg-brand" : "bg-border"}`} />
          ))}
        </div>
      </div>
    </MockFrame>
  );
}

export function LabMock() {
  const jobs = [
    { clinic: "Merkez Şube", job: "Zirkonyum kron · 3 üye", amount: "₺9.000" },
    { clinic: "Kadıköy Kliniği", job: "Gece plağı", amount: "₺1.800" },
    { clinic: "Merkez Şube", job: "Metal destekli köprü", amount: "₺6.400" },
  ];
  return (
    <MockFrame title="Laboratuvar · İşlemlerim" meta="Bu hafta">
      <div className="divide-y divide-border text-xs">
        {jobs.map((j) => (
          <div key={j.job} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate">{j.job}</p>
              <p className="truncate text-[11px] text-muted-foreground">{j.clinic}</p>
            </div>
            <span className="tabular-nums">{j.amount}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
