"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarOff, Check, X, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { AppointmentDialog } from "@/components/dental/appointment-dialog";
import { CloseSlotDialog } from "@/components/dental/close-slot-dialog";
import { DoctorDayView } from "@/components/dental/doctor-day-view";
import { WeekByDoctorView } from "@/components/dental/week-by-doctor-view";

const DOCTORS_PER_PAGE = 6;

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

function isoDay(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function weekRangeIso(weekStart: Date) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

function defaultSlotFor(date: Date) {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  return { start, end };
}

function formatDayTitle(d: Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(d);
}

function formatWeekTitle(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sameMonth = weekStart.getMonth() === end.getMonth() && weekStart.getFullYear() === end.getFullYear();
  const startFmt = new Intl.DateTimeFormat("tr-TR", sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
  const endFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  return `${startFmt.format(weekStart)} – ${endFmt.format(end)}`;
}

function isDoctorOnlyClient(roles: string[]) {
  const set = new Set(roles);
  return set.size === 1 && set.has("DOKTOR");
}

export default function AppointmentCalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [viewType, setViewType] = useState<string>("timeGridWeek");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [title, setTitle] = useState("");
  const [doctorPage, setDoctorPage] = useState(0);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date; doctorId?: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [closeSlotOpen, setCloseSlotOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: me } = trpc.user.me.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();

  const doctorOnly = me ? isDoctorOnlyClient(me.memberships.map((m) => m.role)) : undefined;
  const myDoctor = useMemo(() => doctors?.find((d) => d.user.id === me?.id), [doctors, me]);

  const isDoctorDay = viewType === "doctorDay" && !doctorOnly;
  const isDoctorWeek = viewType === "timeGridWeek" && doctorOnly === false;
  // A manually-managed (non-FullCalendar) view: our own custom grid/day
  // component drives its own date range instead of FullCalendar's datesSet.
  const isManagedView = isDoctorDay || isDoctorWeek;

  // Managed views (day/week-by-doctor) don't go through FullCalendar's
  // datesSet callback, so their range/title are derived straight from
  // anchorDate + the active view instead of a FullCalendar-driven state.
  const managedRange = useMemo(() => {
    if (viewType === "doctorDay" && !doctorOnly) return isoDay(anchorDate);
    if (viewType === "timeGridWeek" && doctorOnly === false) return weekRangeIso(startOfWeek(anchorDate));
    return null;
  }, [viewType, anchorDate, doctorOnly]);

  const managedTitle = useMemo(() => {
    if (viewType === "doctorDay" && !doctorOnly) return formatDayTitle(anchorDate);
    if (viewType === "timeGridWeek" && doctorOnly === false) return formatWeekTitle(startOfWeek(anchorDate));
    return null;
  }, [viewType, anchorDate, doctorOnly]);

  const effectiveRange = managedRange ?? range;
  const effectiveTitle = managedTitle ?? title;

  const { data: appointments } = trpc.appointment.listRange.useQuery(
    { start: effectiveRange?.start ?? "", end: effectiveRange?.end ?? "" },
    { enabled: !!effectiveRange },
  );
  const { data: blocks } = trpc.appointmentBlock.listRange.useQuery(
    { start: effectiveRange?.start ?? "", end: effectiveRange?.end ?? "" },
    { enabled: !!effectiveRange },
  );

  const reschedule = trpc.appointment.reschedule.useMutation({
    onSuccess: () => {
      toast.success("Randevu güncellendi.");
      utils.appointment.listRange.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      utils.appointment.listRange.invalidate();
    },
  });

  const VIEW_OPTIONS = useMemo(
    () =>
      doctorOnly
        ? ([
            { value: "dayGridMonth", label: "Ay" },
            { value: "timeGridWeek", label: "Hafta" },
          ] as const)
        : ([
            { value: "dayGridMonth", label: "Ay" },
            { value: "timeGridWeek", label: "Hafta" },
            { value: "doctorDay", label: "Gün (Hekimler)" },
          ] as const),
    [doctorOnly],
  );

  const pageCount = doctors ? Math.ceil(doctors.length / DOCTORS_PER_PAGE) : 0;
  const pagedDoctors = useMemo(
    () => (doctors ?? []).slice(doctorPage * DOCTORS_PER_PAGE, (doctorPage + 1) * DOCTORS_PER_PAGE),
    [doctors, doctorPage],
  );

  const events = useMemo(
    () =>
      (appointments ?? []).map((a) => ({
        id: a.id,
        title: a.room ? `${a.patient.fullName} · ${a.room.name}` : a.patient.fullName,
        start: a.startsAt,
        end: a.endsAt,
        backgroundColor: a.doctor.colorHex,
        borderColor: a.doctor.colorHex,
        classNames: [
          a.status === "NO_SHOW" || a.status === "CANCELED" ? "opacity-45" : "",
          a.status === "POSTPONED" ? "border-dashed" : "",
        ].filter(Boolean),
        extendedProps: { status: a.status, note: a.note, doctorName: a.doctor.user.name, patientName: a.patient.fullName },
      })),
    [appointments],
  );

  const selectedAppointment = appointments?.find((a) => a.id === selectedAppointmentId);

  function handleEventChange(arg: { event: { id: string; start: Date | null; end: Date | null } }) {
    reschedule.mutate({
      id: arg.event.id,
      startsAt: arg.event.start!.toISOString(),
      endsAt: (arg.event.end ?? arg.event.start!).toISOString(),
    });
  }

  function handleEventClick(arg: EventClickArg) {
    setSelectedAppointmentId(arg.event.id);
  }

  function handleSelect(arg: DateSelectArg) {
    setCreateSlot({ start: arg.start, end: arg.end, doctorId: myDoctor?.id });
    calendarRef.current?.getApi().unselect();
  }

  function handleDatesSet(arg: DatesSetArg) {
    setRange({ start: arg.startStr, end: arg.endStr });
    setTitle(arg.view.title);
    setAnchorDate(new Date(arg.view.currentStart));
  }

  function renderEventContent(arg: EventContentArg) {
    const { status, note } = arg.event.extendedProps as { status: string; note: string | null };
    return (
      <div className="flex flex-col gap-0.5 overflow-hidden px-0.5 text-[11px] leading-tight">
        <div className="flex items-center gap-1">
          <StatusIcon status={status} />
          <span className="truncate font-medium">{arg.event.title}</span>
        </div>
        {note && <span className="truncate text-white/80">{note}</span>}
      </div>
    );
  }

  function handleEventDidMount(arg: { event: { extendedProps: Record<string, unknown>; start: Date | null }; el: HTMLElement }) {
    const status = arg.event.extendedProps.status as string;
    const note = arg.event.extendedProps.note as string | null;
    const doctorName = arg.event.extendedProps.doctorName as string;
    const patientName = arg.event.extendedProps.patientName as string;
    const time = arg.event.start
      ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(arg.event.start)
      : "";
    arg.el.title = [patientName, doctorName, time, `Durum: ${STATUS_LABEL[status] ?? status}`, note ? `Not: ${note}` : null]
      .filter(Boolean)
      .join("\n");
  }

  function goPrev() {
    if (isManagedView) {
      const d = new Date(anchorDate);
      d.setDate(d.getDate() - (isDoctorDay ? 1 : 7));
      setAnchorDate(d);
    } else {
      calendarRef.current?.getApi().prev();
    }
  }

  function goNext() {
    if (isManagedView) {
      const d = new Date(anchorDate);
      d.setDate(d.getDate() + (isDoctorDay ? 1 : 7));
      setAnchorDate(d);
    } else {
      calendarRef.current?.getApi().next();
    }
  }

  function goToday() {
    setAnchorDate(new Date());
    if (!isManagedView) {
      calendarRef.current?.getApi().today();
    }
  }

  function handleViewChange(v: string) {
    setViewType(v);
    setDoctorPage(0);
    if (v === "dayGridMonth" || (v === "timeGridWeek" && doctorOnly)) {
      // Give FullCalendar a tick to mount before switching its view.
      setTimeout(() => calendarRef.current?.getApi().changeView(v), 0);
    }
  }

  if (!me || doctorOnly === undefined) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
        <Button variant="outline" size="sm" onClick={() => setCloseSlotOpen(true)}>
          <CalendarOff className="size-4" />
          Saat Kapat
        </Button>

        {(isDoctorDay || isDoctorWeek) && doctors && doctors.length > DOCTORS_PER_PAGE && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Önceki hekimler"
              disabled={doctorPage === 0}
              onClick={() => setDoctorPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {doctorPage * DOCTORS_PER_PAGE + 1}-{Math.min((doctorPage + 1) * DOCTORS_PER_PAGE, doctors.length)} / {doctors.length} hekim
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sonraki hekimler"
              disabled={doctorPage >= pageCount - 1}
              onClick={() => setDoctorPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" aria-label="Önceki" onClick={goPrev}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Bugün
              </Button>
              <Button variant="outline" size="icon" aria-label="Sonraki" onClick={goNext}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <p className="order-first w-full text-center text-sm font-medium sm:order-0 sm:w-auto sm:flex-1">{effectiveTitle}</p>
            <Select value={viewType} onValueChange={(v) => v && handleViewChange(v)}>
              <SelectTrigger className="w-40">
                <SelectValue>{(value: string) => VIEW_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isDoctorDay ? (
            pagedDoctors.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Bu görünüm için önce Yönetim&apos;den bir hekim ekleyin.
              </p>
            ) : (
              <DoctorDayView
                date={anchorDate}
                doctors={pagedDoctors}
                appointments={appointments ?? []}
                blocks={blocks ?? []}
                onSlotClick={(doctorId, start, end) => setCreateSlot({ start, end, doctorId })}
                onEventClick={(id) => setSelectedAppointmentId(id)}
              />
            )
          ) : isDoctorWeek ? (
            pagedDoctors.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Bu görünüm için önce Yönetim&apos;den bir hekim ekleyin.
              </p>
            ) : (
              <WeekByDoctorView
                weekStart={startOfWeek(anchorDate)}
                doctors={pagedDoctors}
                appointments={appointments ?? []}
                blocks={blocks ?? []}
                onSlotClick={(doctorId, date) => setCreateSlot({ ...defaultSlotFor(date), doctorId })}
                onEventClick={(id) => setSelectedAppointmentId(id)}
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-140">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="timeGridWeek"
                  headerToolbar={false}
                  locale="tr"
                  firstDay={1}
                  editable
                  selectable={!!doctorOnly}
                  select={doctorOnly ? handleSelect : undefined}
                  events={events}
                  eventContent={renderEventContent}
                  eventDidMount={handleEventDidMount}
                  eventDrop={handleEventChange}
                  eventResize={handleEventChange}
                  eventClick={handleEventClick}
                  datesSet={handleDatesSet}
                  height="auto"
                  allDaySlot={false}
                  slotMinTime="08:00:00"
                  slotMaxTime="20:00:00"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentDialog
        open={!!createSlot}
        onOpenChange={(open) => !open && setCreateSlot(null)}
        initial={createSlot ?? undefined}
        defaultDoctorId={createSlot?.doctorId}
      />

      {selectedAppointment && (
        <AppointmentDialog
          open={!!selectedAppointmentId}
          onOpenChange={(open) => !open && setSelectedAppointmentId(null)}
          appointment={selectedAppointment}
        />
      )}

      <CloseSlotDialog open={closeSlotOpen} onOpenChange={setCloseSlotOpen} />
    </div>
  );
}
