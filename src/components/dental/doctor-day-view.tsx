"use client";

import { useRef } from "react";
import { Check, X, Clock3, CalendarOff } from "lucide-react";

const HOUR_HEIGHT = 56; // px per hour row

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Planlandı",
  ARRIVED: "Geldi",
  NO_SHOW: "Gelmedi",
  POSTPONED: "Ertelendi",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "ARRIVED" || status === "COMPLETED") return <Check className="size-3 shrink-0" />;
  if (status === "NO_SHOW" || status === "CANCELED") return <X className="size-3 shrink-0" />;
  if (status === "POSTPONED") return <Clock3 className="size-3 shrink-0" />;
  return null;
}

type AppointmentLike = {
  id: string;
  doctorId: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  note: string | null;
  patient: { fullName: string };
  room?: { name: string } | null;
};

type BlockLike = {
  id: string;
  doctorId: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  reason: string | null;
};

type DoctorLike = { id: string; user: { name: string }; colorHex: string };

// A free, self-built alternative to FullCalendar's paid Scheduler plugin
// (the `resourceTimeGridDay` view previously used here requires a
// commercial license for production/commercial use — see the discussion
// that led to this replacement). Only this single-day, per-doctor-column
// view is custom; Month/Week still use FullCalendar's free plugins.
// Drag-to-reschedule (including across doctor columns) is implemented with
// the native HTML5 Drag and Drop API — no paid plugin, no extra dependency.
export function DoctorDayView({
  date,
  doctors,
  appointments,
  blocks,
  slotMinHour = 8,
  slotMaxHour = 20,
  onSlotClick,
  onEventClick,
  onEventDrop,
}: {
  date: Date;
  doctors: DoctorLike[];
  appointments: AppointmentLike[];
  blocks: BlockLike[];
  slotMinHour?: number;
  slotMaxHour?: number;
  onSlotClick: (doctorId: string, start: Date, end: Date) => void;
  onEventClick: (appointmentId: string) => void;
  onEventDrop?: (appointmentId: string, doctorId: string, start: Date, end: Date) => void;
}) {
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hours = Array.from({ length: slotMaxHour - slotMinHour }, (_, i) => slotMinHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  function isSameDay(d: Date) {
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
  }

  function minutesFromStart(d: Date) {
    return (d.getHours() - slotMinHour) * 60 + d.getMinutes();
  }

  function topFor(d: Date) {
    return (minutesFromStart(d) / 60) * HOUR_HEIGHT;
  }

  function handleColumnClick(doctorId: string, e: React.MouseEvent<HTMLDivElement>) {
    const el = columnRefs.current[doctorId];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snapped = Math.max(0, Math.round(rawMinutes / 15) * 15);
    const start = new Date(date);
    start.setHours(slotMinHour, 0, 0, 0);
    start.setMinutes(start.getMinutes() + snapped);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    onSlotClick(doctorId, start, end);
  }

  function snappedStartFromOffset(doctorId: string, clientY: number) {
    const el = columnRefs.current[doctorId];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const offsetY = clientY - rect.top;
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snapped = Math.max(0, Math.round(rawMinutes / 15) * 15);
    const start = new Date(date);
    start.setHours(slotMinHour, 0, 0, 0);
    start.setMinutes(start.getMinutes() + snapped);
    return start;
  }

  function handleColumnDrop(doctorId: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    let payload: { id: string; durationMs: number };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const start = snappedStartFromOffset(doctorId, e.clientY);
    if (!start) return;
    const end = new Date(start.getTime() + payload.durationMs);
    onEventDrop?.(payload.id, doctorId, start, end);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-140">
        {/* time gutter */}
        <div className="w-12 shrink-0 pt-8">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
              <span className="absolute -top-2 right-1 text-xs text-muted-foreground">{h}:00</span>
            </div>
          ))}
        </div>

        {doctors.map((doctor) => {
          const dayAppointments = appointments.filter(
            (a) => a.doctorId === doctor.id && isSameDay(new Date(a.startsAt)),
          );
          const dayBlocks = blocks.filter(
            (b) => (b.doctorId === null || b.doctorId === doctor.id) && isSameDay(new Date(b.startsAt)),
          );

          return (
            <div key={doctor.id} className="min-w-36 flex-1 border-l border-border">
              <div className="flex h-8 items-center justify-center truncate px-1 text-xs font-medium" style={{ color: doctor.colorHex }}>
                {doctor.user.name}
              </div>
              <div
                ref={(el) => {
                  columnRefs.current[doctor.id] = el;
                }}
                className="relative cursor-crosshair border-t border-border"
                style={{ height: totalHeight }}
                onClick={(e) => handleColumnClick(doctor.id, e)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleColumnDrop(doctor.id, e)}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={`absolute inset-x-0 border-b border-dashed border-border/60 ${i === 0 ? "" : ""}`}
                    style={{ top: (i + 1) * HOUR_HEIGHT - 1 }}
                  />
                ))}

                {dayBlocks.map((b) => {
                  const start = new Date(b.startsAt);
                  const end = new Date(b.endsAt);
                  const top = Math.max(0, topFor(start));
                  const height = Math.max(16, topFor(end) - top);
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-0.5 z-0 flex items-center gap-1 overflow-hidden rounded-sm bg-muted-foreground/20 px-1 text-[10px] text-muted-foreground"
                      style={{ top, height }}
                      title={["Saat kapalı", b.reason].filter(Boolean).join(" · ")}
                    >
                      <CalendarOff className="size-3 shrink-0" />
                      <span className="truncate">{b.reason || "Kapalı"}</span>
                    </div>
                  );
                })}

                {dayAppointments.map((a) => {
                  const start = new Date(a.startsAt);
                  const end = new Date(a.endsAt);
                  const top = Math.max(0, topFor(start));
                  const height = Math.max(22, topFor(end) - top);
                  const dimmed = a.status === "NO_SHOW" || a.status === "CANCELED";
                  return (
                    <button
                      key={a.id}
                      type="button"
                      draggable={!!onEventDrop}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(
                          "text/plain",
                          JSON.stringify({ id: a.id, durationMs: end.getTime() - start.getTime() }),
                        );
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(a.id);
                      }}
                      className={`absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-md px-1 py-0.5 text-left text-[11px] leading-tight text-white shadow-sm ${onEventDrop ? "cursor-grab active:cursor-grabbing" : ""} ${dimmed ? "opacity-45" : ""} ${a.status === "POSTPONED" ? "border border-dashed border-white/70" : ""}`}
                      style={{ top, height, backgroundColor: doctor.colorHex }}
                      title={[a.patient.fullName, `Durum: ${STATUS_LABEL[a.status] ?? a.status}`, a.note].filter(Boolean).join("\n")}
                    >
                      <span className="flex items-center gap-1 truncate font-medium">
                        <StatusIcon status={a.status} />
                        {a.patient.fullName}
                        {a.room && ` · ${a.room.name}`}
                      </span>
                      {a.note && height > 34 && <span className="truncate text-white/80">{a.note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
