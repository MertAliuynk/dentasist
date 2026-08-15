"use client";

import { Plus, Check, X, Clock3, CalendarOff } from "lucide-react";

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Planlandı",
  ARRIVED: "Geldi",
  NO_SHOW: "Gelmedi",
  POSTPONED: "Ertelendi",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "ARRIVED" || status === "COMPLETED") return <Check className="size-2.5 shrink-0" />;
  if (status === "NO_SHOW" || status === "CANCELED") return <X className="size-2.5 shrink-0" />;
  if (status === "POSTPONED") return <Clock3 className="size-2.5 shrink-0" />;
  return null;
}

type AppointmentLike = {
  id: string;
  doctorId: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  patient: { fullName: string };
};

type BlockLike = { id: string; doctorId: string | null; startsAt: string | Date; endsAt: string | Date; reason: string | null };
type DoctorLike = { id: string; user: { name: string }; colorHex: string };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

// "Üst kolon hekim, alt kolon haftanın günleri" — each doctor gets its own
// horizontal group spanning the 7 days of the week, so multiple doctors'
// schedules are never visually merged into one shared column. A compact,
// agenda-per-day design (not an hourly grid) since doctor-count × 7 columns
// would otherwise be extremely wide.
export function WeekByDoctorView({
  weekStart,
  doctors,
  appointments,
  blocks,
  onSlotClick,
  onEventClick,
}: {
  weekStart: Date;
  doctors: DoctorLike[];
  appointments: AppointmentLike[];
  blocks: BlockLike[];
  onSlotClick: (doctorId: string, date: Date) => void;
  onEventClick: (appointmentId: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date();

  return (
    <div className="flex flex-col gap-5">
      {doctors.map((doctor) => (
        <div key={doctor.id} className="overflow-x-auto">
          <div className="mb-1.5 flex items-center gap-2 px-0.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: doctor.colorHex }} />
            <span className="text-sm font-medium">{doctor.user.name}</span>
          </div>
          <div className="grid min-w-175 grid-cols-7 gap-1.5">
            {days.map((day, i) => {
              const dayAppointments = appointments
                .filter((a) => a.doctorId === doctor.id && isSameDay(new Date(a.startsAt), day))
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
              const dayBlocks = blocks.filter(
                (b) => (b.doctorId === null || b.doctorId === doctor.id) && isSameDay(new Date(b.startsAt), day),
              );
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`flex min-h-40 flex-col rounded-md border p-1.5 ${isToday ? "border-primary/40 bg-primary/5" : "border-border"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {DAY_LABELS[i]} {day.getDate()}
                    </span>
                    <button
                      type="button"
                      aria-label="Randevu ekle"
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => onSlotClick(doctor.id, day)}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {dayBlocks.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-1 rounded bg-muted-foreground/15 px-1 py-0.5 text-[10px] text-muted-foreground"
                        title={b.reason ?? "Kapalı"}
                      >
                        <CalendarOff className="size-2.5 shrink-0" />
                        <span className="truncate">{b.reason || "Kapalı"}</span>
                      </div>
                    ))}
                    {dayAppointments.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onEventClick(a.id)}
                        className={`flex flex-col rounded px-1 py-0.5 text-left text-[10px] leading-tight text-white ${
                          a.status === "NO_SHOW" || a.status === "CANCELED" ? "opacity-45" : ""
                        }`}
                        style={{ backgroundColor: doctor.colorHex }}
                        title={`${a.patient.fullName} · ${formatTime(new Date(a.startsAt))} · ${STATUS_LABEL[a.status] ?? a.status}`}
                      >
                        <span className="flex items-center gap-0.5 truncate font-medium">
                          <StatusIcon status={a.status} />
                          {formatTime(new Date(a.startsAt))} {a.patient.fullName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
