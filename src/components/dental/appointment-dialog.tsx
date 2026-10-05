"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Planlandı" },
  { value: "ARRIVED", label: "Geldi" },
  { value: "NO_SHOW", label: "Gelmedi" },
  { value: "POSTPONED", label: "Ertelendi" },
  { value: "COMPLETED", label: "Tamamlandı" },
  { value: "CANCELED", label: "İptal" },
] as const;

type AppointmentLike = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  note: string | null;
  patient: { id: string; fullName: string };
  doctor: { user: { name: string }; branchId?: string };
  room?: { id: string; name: string } | null;
};

// Rendered only while the dialog is open, so state always initializes
// fresh from props on mount — no reset-on-open effect needed.
function AppointmentForm({
  onOpenChange,
  initial,
  appointment,
  defaultDoctorId,
  presetPatient,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: { start: Date; end: Date };
  appointment?: AppointmentLike;
  defaultDoctorId?: string;
  presetPatient?: { id: string; fullName: string };
  onSaved?: () => void;
}) {
  const isEdit = !!appointment;
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(presetPatient?.id ?? null);
  const [patientLabel, setPatientLabel] = useState(presetPatient?.fullName ?? "");
  const [doctorId, setDoctorId] = useState(defaultDoctorId ?? "");
  const [startsAt, setStartsAt] = useState(() => {
    if (appointment) return toLocalInputValue(new Date(appointment.startsAt));
    if (initial) return toLocalInputValue(initial.start);
    return toLocalInputValue(new Date());
  });
  const [endsAt, setEndsAt] = useState(() => {
    if (appointment) return toLocalInputValue(new Date(appointment.endsAt));
    if (initial) return toLocalInputValue(initial.end);
    return toLocalInputValue(new Date(Date.now() + 30 * 60 * 1000));
  });
  const [note, setNote] = useState(appointment?.note ?? "");
  const [status, setStatus] = useState<string>(appointment?.status ?? "SCHEDULED");
  const [roomId, setRoomId] = useState<string>(appointment?.room?.id ?? "");
  const [completeTreatmentId, setCompleteTreatmentId] = useState("");

  const { data: doctors } = trpc.doctor.bookable.useQuery(undefined, { enabled: !isEdit });
  const { data: rooms } = trpc.room.list.useQuery();
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: !isEdit && patientSearch.trim().length > 0 },
  );

  // Closing a visit as Tamamlandı requires picking the treatment done in it.
  const closing = isEdit && (status === "COMPLETED" || status === "ARRIVED") && appointment!.status !== status;
  const needsTreatment = isEdit && status === "COMPLETED" && appointment!.status !== "COMPLETED";
  const { data: approvedTreatments } = trpc.treatment.listApprovedForPatient.useQuery(
    { patientId: appointment?.patient.id ?? "" },
    { enabled: closing },
  );

  const utils = trpc.useUtils();

  const create = trpc.appointment.create.useMutation({
    onSuccess: () => {
      toast.success("Randevu oluşturuldu.");
      utils.appointment.listRange.invalidate();
      utils.appointment.nextUpcoming.invalidate();
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toastError(e),
  });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Randevu güncellendi.");
      utils.appointment.listRange.invalidate();
      utils.appointment.nextUpcoming.invalidate();
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e) => toastError(e),
  });

  // A doctor-only account can only book for themselves — preselect it.
  const effectiveDoctorId = doctorId || (doctors?.length === 1 ? doctors[0].id : "");
  const selectedDoctor = doctors?.find((d) => d.id === effectiveDoctorId);
  const activeBranchId = isEdit ? appointment!.doctor.branchId : selectedDoctor?.branchId;
  const branchRooms = rooms?.filter((r) => r.branchId === activeBranchId) ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Randevu Detayı" : "Yeni Randevu"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {isEdit ? (
          <div className="text-sm">
            <Link
              href={`/dental/hastalar/${appointment!.patient.id}`}
              className="font-medium hover:underline"
              target="_blank"
            >
              {appointment!.patient.fullName}
            </Link>
            <p className="text-muted-foreground">{appointment!.doctor.user.name}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Hasta</Label>
            {patientId ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span>{patientLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setPatientId(null)}>
                  Değiştir
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Hasta ara…"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patientResults && patientResults.patients.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-md border border-input">
                    {patientResults.patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientLabel(p.fullName);
                        }}
                      >
                        <span>{p.fullName}</span>
                        <span className="text-muted-foreground">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isEdit && (
          <div className="space-y-2">
            <Label>Doktor</Label>
            <Select value={effectiveDoctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Doktor seçin">
                  {(value: string) => doctors?.find((d) => d.id === value)?.user.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Başlangıç</Label>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Bitiş</Label>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={isEdit}
            />
          </div>
        </div>

        {activeBranchId && branchRooms.length > 0 && (
          <div className="space-y-2">
            <Label>Oda (opsiyonel)</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Oda seçin">
                  {(value: string) => branchRooms.find((r) => r.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {branchRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isEdit && (
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "SCHEDULED")}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) => STATUS_OPTIONS.find((s) => s.value === value)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {closing && (
          <div className="space-y-2">
            <Label>
              Yapılan Tedavi {needsTreatment ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(opsiyonel)</span>}
            </Label>
            {approvedTreatments && approvedTreatments.length === 0 ? (
              <p className="rounded-md border border-dashed border-input p-2.5 text-xs text-muted-foreground">
                Hastanın onaylı tedavisi yok.{" "}
                <Link href={`/dental/hastalar/${appointment!.patient.id}/tedavi-ekle`} className="underline" target="_blank">
                  Önce tedavi ekleyin
                </Link>
                {needsTreatment && ", sonra randevuyu tamamlayın."}
              </p>
            ) : (
              <Select value={completeTreatmentId} onValueChange={(v) => setCompleteTreatmentId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Bu ziyarette yapılan tedaviyi seçin">
                    {(value: string) => {
                      const t = approvedTreatments?.find((x) => x.id === value);
                      return t ? `${t.name}${t.toothNumber != null ? ` · Diş ${t.toothNumber}` : ""}` : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {approvedTreatments?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.toothNumber != null ? ` · Diş ${t.toothNumber}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Not</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Vazgeç
        </Button>
        {isEdit ? (
          <Button
            disabled={updateStatus.isPending || (needsTreatment && !completeTreatmentId)}
            onClick={() =>
              updateStatus.mutate({
                id: appointment!.id,
                status: status as never,
                note,
                roomId: roomId || null,
                completeTreatmentId: closing && completeTreatmentId ? completeTreatmentId : undefined,
              })
            }
          >
            Kaydet
          </Button>
        ) : (
          <Button
            disabled={create.isPending || !patientId || !effectiveDoctorId || !startsAt || !endsAt}
            onClick={() => {
              if (!patientId || !effectiveDoctorId) return;
              create.mutate({
                patientId,
                doctorId: effectiveDoctorId,
                branchId: selectedDoctor?.branchId ?? "",
                roomId: roomId || undefined,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                note: note || undefined,
              });
            }}
          >
            Oluştur
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

export function AppointmentDialog({
  open,
  onOpenChange,
  initial,
  appointment,
  defaultDoctorId,
  presetPatient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { start: Date; end: Date };
  appointment?: AppointmentLike;
  defaultDoctorId?: string;
  presetPatient?: { id: string; fullName: string };
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AppointmentForm
            onOpenChange={onOpenChange}
            initial={initial}
            appointment={appointment}
            defaultDoctorId={defaultDoctorId}
            presetPatient={presetPatient}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
