"use client";

import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourcePlugin from "@fullcalendar/resource";
import resourceDayGridPlugin from "@fullcalendar/resource-daygrid";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
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

const DOCTORS_PER_PAGE = 6;

// Ay/Hafta/Gün — all three now use FullCalendar's Scheduler plugins
// (resourceDayGridMonth / resourceTimeGridWeek / resourceTimeGridDay) for
// non-doctor roles, giving every view the same native per-doctor-column
// drag/resize. Scheduler requires a paid commercial license for production/
// commercial use. This key is FullCalendar's own documented non-commercial/
// evaluation key: it is NOT valid for a commercially-deployed product.
// Before this app is sold/deployed to real clinics, buy a Scheduler license
// (fullcalendar.io/pricing) and swap this key for the purchased one — the
// free custom per-doctor-column views this replaced (DoctorDayView /
// WeekByDoctorView) were deleted as dead code, so reverting to the free
// plugins means rebuilding those, not just swapping a render branch back.
// Do not ship this key as-is.
const SCHEDULER_LICENSE_KEY = "CC-Attribution-NonCommercial-NoDerivatives";

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

function defaultSlotFor(date: Date) {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  return { start, end };
}

function isDoctorOnlyClient(roles: string[]) {
  const set = new Set(roles);
  return set.size === 1 && set.has("DOKTOR");
}

type ViewKey = "dayGridMonth" | "timeGridWeek" | "doctorDay";

// Internal view keys stay stable across roles (drives Select state); the
// actual FullCalendar view name differs — non-doctor roles get the
// resource-grouped variant of each.
function resolveFcView(view: ViewKey, doctorOnly: boolean): string {
  if (doctorOnly) return view;
  if (view === "dayGridMonth") return "resourceDayGridMonth";
  if (view === "timeGridWeek") return "resourceTimeGridWeek";
  return "resourceTimeGridDay";
}

export default function AppointmentCalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  // null until the user explicitly switches views — lets the default view
  // depend on role (resolved async via `me`) without an effect: see
  // `viewType` below.
  const [explicitViewType, setExplicitViewType] = useState<ViewKey | null>(null);
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

  // Non-doctor roles default to "Gün (Hekimler)" — the per-doctor-column
  // hourly grid — since that's the view they actually want to see first;
  // doctor-only accounts default to their own creatable week calendar.
  const viewType: ViewKey = explicitViewType ?? (doctorOnly ? "timeGridWeek" : "doctorDay");

  const { data: appointments } = trpc.appointment.listRange.useQuery(
    { start: range?.start ?? "", end: range?.end ?? "" },
    { enabled: !!range },
  );
  const { data: blocks } = trpc.appointmentBlock.listRange.useQuery(
    { start: range?.start ?? "", end: range?.end ?? "" },
    { enabled: !!range },
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
        resourceId: a.doctorId,
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

  // "Saat Kapat" blocks, rendered as FullCalendar background events (tinted,
  // non-interactive, non-draggable) rather than real appointments. A block
  // with no specific doctorId applies org/branch-wide, so on a resource view
  // it needs to be duplicated across every currently-visible doctor column;
  // on the doctor-only calendar there's only ever one implicit column.
  const blockEvents = useMemo(() => {
    return (blocks ?? []).flatMap((b) => {
      const base = {
        title: b.reason || "Kapalı",
        start: b.startsAt,
        end: b.endsAt,
        display: "background" as const,
        backgroundColor: "var(--color-muted-foreground)",
        editable: false,
      };
      if (doctorOnly || b.doctorId) {
        return [{ ...base, id: `block-${b.id}`, resourceId: b.doctorId ?? undefined }];
      }
      return pagedDoctors.map((d) => ({ ...base, id: `block-${b.id}-${d.id}`, resourceId: d.id }));
    });
  }, [blocks, doctorOnly, pagedDoctors]);

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

  // A day-cell click in Month view selects the whole day (`allDay`), which
  // isn't a usable appointment slot — normalize it to a default 09:00 start
  // instead of passing a 24h range through.
  function normalizeSelection(arg: DateSelectArg) {
    return arg.allDay ? defaultSlotFor(arg.start) : { start: arg.start, end: arg.end };
  }

  function handleSelect(arg: DateSelectArg) {
    const { start, end } = normalizeSelection(arg);
    setCreateSlot({ start, end, doctorId: myDoctor?.id });
    calendarRef.current?.getApi().unselect();
  }

  // Resource views' select/eventDrop args carry a `resource` (the
  // clicked-on column) — not part of the base FullCalendar types, so read
  // it defensively rather than importing the Scheduler-specific type.
  function handleResourceSelect(arg: DateSelectArg) {
    const resourceId = (arg as unknown as { resource?: { id: string } }).resource?.id;
    const { start, end } = normalizeSelection(arg);
    setCreateSlot({ start, end, doctorId: resourceId });
    calendarRef.current?.getApi().unselect();
  }

  function handleResourceEventChange(arg: {
    event: { id: string; start: Date | null; end: Date | null };
    newResource?: { id: string } | null;
  }) {
    reschedule.mutate({
      id: arg.event.id,
      startsAt: arg.event.start!.toISOString(),
      endsAt: (arg.event.end ?? arg.event.start!).toISOString(),
      doctorId: arg.newResource?.id,
    });
  }

  function handleDatesSet(arg: DatesSetArg) {
    setRange({ start: arg.startStr, end: arg.endStr });
    setTitle(arg.view.title);
  }

  function renderEventContent(arg: EventContentArg) {
    // Background events ("Saat Kapat" blocks) just tint the slot — no card
    // content, let FullCalendar render its default (empty) background.
    if (arg.event.display === "background") return undefined;
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

  function handleEventDidMount(arg: {
    event: { display?: string; title: string; extendedProps: Record<string, unknown>; start: Date | null };
    el: HTMLElement;
  }) {
    if (arg.event.display === "background") {
      arg.el.title = arg.event.title || "Kapalı";
      return;
    }
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
    calendarRef.current?.getApi().prev();
  }

  function goNext() {
    calendarRef.current?.getApi().next();
  }

  function goToday() {
    calendarRef.current?.getApi().today();
  }

  function handleViewChange(v: string) {
    const next = v as ViewKey;
    setExplicitViewType(next);
    setDoctorPage(0);
    calendarRef.current?.getApi().changeView(resolveFcView(next, !!doctorOnly));
  }

  if (!me || doctorOnly === undefined) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  const noDoctors = !doctorOnly && pagedDoctors.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
        <Button variant="outline" size="sm" onClick={() => setCloseSlotOpen(true)}>
          <CalendarOff className="size-4" />
          Saat Kapat
        </Button>

        {!doctorOnly && doctors && doctors.length > DOCTORS_PER_PAGE && (
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
            <p className="order-first w-full text-center text-sm font-medium sm:order-0 sm:w-auto sm:flex-1">{title}</p>
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

          {noDoctors ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Bu görünüm için önce Yönetim&apos;den bir hekim ekleyin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div style={doctorOnly ? { minWidth: "35rem" } : { minWidth: `${Math.max(pagedDoctors.length * 11, 35)}rem` }}>
                <FullCalendar
                  ref={calendarRef}
                  schedulerLicenseKey={doctorOnly ? undefined : SCHEDULER_LICENSE_KEY}
                  plugins={
                    doctorOnly
                      ? [dayGridPlugin, timeGridPlugin, interactionPlugin]
                      : [resourcePlugin, resourceDayGridPlugin, resourceTimeGridPlugin, interactionPlugin]
                  }
                  initialView={resolveFcView(viewType, !!doctorOnly)}
                  resources={doctorOnly ? undefined : pagedDoctors.map((d) => ({ id: d.id, title: d.user.name }))}
                  headerToolbar={false}
                  locale="tr"
                  firstDay={1}
                  editable
                  selectable
                  select={doctorOnly ? handleSelect : handleResourceSelect}
                  events={[...events, ...blockEvents]}
                  eventContent={renderEventContent}
                  eventDidMount={handleEventDidMount}
                  eventDrop={doctorOnly ? handleEventChange : handleResourceEventChange}
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
