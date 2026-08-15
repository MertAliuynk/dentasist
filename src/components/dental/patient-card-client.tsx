"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Printer, Plus, CalendarPlus, StickyNote, Pencil, UserRound, Trash2, ScanLine, ShieldCheck, CheckCheck, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc/client";
import { AppointmentDialog } from "@/components/dental/appointment-dialog";
import { PatientEditDialog } from "@/components/dental/patient-edit-dialog";
import { PhoneInput } from "@/components/shared/phone-input";

const TREATMENT_COLUMNS = [
  { key: "PROPOSED", label: "Önerilen Tedaviler" },
  { key: "APPROVED", label: "Onaylanan Tedaviler" },
  { key: "COMPLETED", label: "Tamamlanan Tedaviler" },
] as const;

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Planlandı",
  ARRIVED: "Geldi",
  NO_SHOW: "Gelmedi",
  POSTPONED: "Ertelendi",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal",
};

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function formatDateOnly(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(date));
}

// The date+time relevant to a treatment's current status — proposedAt for
// something still just proposed, approvedAt once approved, completedAt once
// completed (each falling back to the previous milestone if somehow unset).
function treatmentStatusDate(t: { status: string; proposedAt: string | Date; approvedAt: string | Date | null; completedAt: string | Date | null }) {
  if (t.status === "COMPLETED") return t.completedAt ?? t.approvedAt ?? t.proposedAt;
  if (t.status === "APPROVED") return t.approvedAt ?? t.proposedAt;
  return t.proposedAt;
}

function treatmentLocationLabel(t: { toothNumber: number | null; jaw: string | null }) {
  if (t.toothNumber != null) return `Diş ${t.toothNumber}`;
  if (t.jaw) return t.jaw === "UST" ? "Üst Çene" : "Alt Çene";
  return null;
}

function CompanionSection({
  patientId,
  companions,
}: {
  patientId: string;
  companions: { id: string; fullName: string; phone: string | null }[];
}) {
  const [adding, setAdding] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const utils = trpc.useUtils();

  const addCompanion = trpc.patient.addCompanion.useMutation({
    onSuccess: () => {
      toast.success("Refakatçi eklendi.");
      utils.patient.getById.invalidate({ id: patientId });
      setAdding(false);
      setFullName("");
      setPhone("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCompanion = trpc.patient.deleteCompanion.useMutation({
    onSuccess: () => {
      toast.success("Refakatçi silindi.");
      utils.patient.getById.invalidate({ id: patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 print:hidden">
        <CardTitle className="text-sm">Refakatçi</CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" />
            Ekle
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {companions.length === 0 && !adding ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Refakatçi eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {companions.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  {c.fullName}
                  {c.phone && <span className="text-muted-foreground">· {c.phone}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 print:hidden"
                  aria-label="Sil"
                  onClick={() => deleteCompanion.mutate({ id: c.id })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {adding && (
          <div className="space-y-2 print:hidden">
            <Input placeholder="Ad Soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <PhoneInput onChange={setPhone} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Vazgeç
              </Button>
              <Button
                size="sm"
                disabled={!fullName.trim() || addCompanion.isPending}
                onClick={() => addCompanion.mutate({ patientId, fullName: fullName.trim(), phone: phone || undefined })}
              >
                Kaydet
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsentFormsSection({ patientId }: { patientId: string }) {
  const { data: forms } = trpc.patientConsentForm.list.useQuery({ patientId });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 print:hidden">
        <CardTitle className="text-sm">Onam Formları</CardTitle>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/dental/onam-formu?patientId=${patientId}`} />}
        >
          <FileSignature className="size-3.5" />
          Yeni Onam Formu
        </Button>
      </CardHeader>
      <CardContent>
        {!forms || forms.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Henüz onam formu oluşturulmamış.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {forms.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="flex items-center gap-1.5">
                  <FileSignature className="size-3.5 text-muted-foreground" />
                  {f.templateTitle}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(f.createdAt)} · {f.createdBy.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function XrayPlaceholderCard() {
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-sm">Röntgen Görüntüleri</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
          <ScanLine className="size-5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-xs text-muted-foreground">Hastanın röntgen görüntüleri burada listelenecek.</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3" />
            Görüntü yükleme yakında eklenecek — güvenli yükleme, erişim kontrolü ve DICOM/JPEG/PNG desteğiyle.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PatientCardClient({ patientId }: { patientId: string }) {
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [selectedProposedIds, setSelectedProposedIds] = useState<Set<string>>(new Set());
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const { data: patient, isLoading } = trpc.patient.getById.useQuery({ id: patientId });
  const utils = trpc.useUtils();

  const addNote = trpc.patientNote.create.useMutation({
    onSuccess: () => {
      toast.success("Not eklendi.");
      setNoteBody("");
      utils.patient.getById.invalidate({ id: patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTreatmentStatus = trpc.treatment.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Tedavi durumu güncellendi.");
      utils.patient.getById.invalidate({ id: patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTreatment = trpc.treatment.delete.useMutation({
    onSuccess: () => {
      toast.success("Tedavi silindi.");
      utils.patient.getById.invalidate({ id: patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMany = trpc.treatment.approveMany.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} tedavi onaylandı.`);
      setSelectedProposedIds(new Set());
      utils.patient.getById.invalidate({ id: patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  if (!patient) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Hasta bulunamadı.</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={`/dental/hastalar/${patientId}/tedavi-ekle`} />}
        >
          <Plus className="size-4" />
          Tedavi Ekle
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAppointmentOpen(true)}>
          <CalendarPlus className="size-4" />
          Yeni Randevu
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          Yazdır
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => noteRef.current?.focus({ preventScroll: false })}
        >
          <StickyNote className="size-4" />
          Not Ekle
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          Düzenle
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{patient.fullName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>Telefon: {patient.phone}</p>
            {patient.tcKimlikNo && <p>TC Kimlik: {patient.tcKimlikNo}</p>}
            {patient.birthDate && <p>Doğum Tarihi: {formatDateOnly(patient.birthDate)}</p>}
            {patient.primaryDoctor && <p>Doktor: {patient.primaryDoctor.user.name}</p>}
            {patient.anamnesis && <p className="pt-2 text-foreground">{patient.anamnesis}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
          {TREATMENT_COLUMNS.map((col) => {
            const items = patient.treatments.filter((t) => t.status === col.key);
            const isProposedCol = col.key === "PROPOSED";
            const allSelected = isProposedCol && items.length > 0 && items.every((t) => selectedProposedIds.has(t.id));
            return (
              <Card key={col.key}>
                <CardHeader className="flex flex-col items-start gap-2 space-y-0">
                  <CardTitle className="text-sm">
                    {col.label} <span className="font-normal text-muted-foreground">({items.length})</span>
                  </CardTitle>
                  {isProposedCol && items.length > 1 && (
                    <div className="flex w-full items-center justify-between gap-2 print:hidden">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) =>
                            setSelectedProposedIds(v ? new Set(items.map((t) => t.id)) : new Set())
                          }
                        />
                        Tümünü seç
                      </label>
                      {selectedProposedIds.size > 0 && (
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={approveMany.isPending}
                          onClick={() => approveMany.mutate({ ids: [...selectedProposedIds] })}
                        >
                          <CheckCheck className="size-3.5" />
                          {selectedProposedIds.size} tanesini onayla
                        </Button>
                      )}
                    </div>
                  )}
                </CardHeader>
                {/* capped height + internal scroll — a whole-mouth plan can
                    propose dozens of rows, and this keeps the page itself
                    from growing endlessly instead of just this one column. */}
                <CardContent className="max-h-128 space-y-2 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Kayıt yok</p>
                  ) : (
                    items.map((t) => {
                      const location = treatmentLocationLabel(t);
                      return (
                        <div key={t.id} className="flex gap-2 rounded-md border border-border p-2 text-xs">
                          {isProposedCol && (
                            <Checkbox
                              className="mt-0.5 print:hidden"
                              checked={selectedProposedIds.has(t.id)}
                              onCheckedChange={(v) =>
                                setSelectedProposedIds((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(t.id);
                                  else next.delete(t.id);
                                  return next;
                                })
                              }
                            />
                          )}
                          <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {t.name}
                            {location && <span className="font-normal text-muted-foreground"> · {location}</span>}
                          </p>
                          <p className="text-muted-foreground">
                            {t.doctor.user.name} · {formatDate(treatmentStatusDate(t))}
                          </p>
                          {t.price != null && (
                            <p className="text-muted-foreground">
                              {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                                t.price / 100,
                              )}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {t.status === "PROPOSED" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  disabled={updateTreatmentStatus.isPending}
                                  onClick={() => updateTreatmentStatus.mutate({ id: t.id, status: "APPROVED" })}
                                >
                                  Onayla
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs text-destructive"
                                  disabled={deleteTreatment.isPending}
                                  onClick={() => deleteTreatment.mutate({ id: t.id })}
                                >
                                  Sil
                                </Button>
                              </>
                            )}
                            {t.status === "APPROVED" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  disabled={updateTreatmentStatus.isPending}
                                  onClick={() => updateTreatmentStatus.mutate({ id: t.id, status: "COMPLETED" })}
                                >
                                  Tamamla
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  disabled={updateTreatmentStatus.isPending}
                                  onClick={() => updateTreatmentStatus.mutate({ id: t.id, status: "PROPOSED" })}
                                >
                                  Geri Al
                                </Button>
                              </>
                            )}
                            {t.status === "COMPLETED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                disabled={updateTreatmentStatus.isPending}
                                onClick={() => updateTreatmentStatus.mutate({ id: t.id, status: "APPROVED" })}
                              >
                                Geri Al
                              </Button>
                            )}
                          </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CompanionSection patientId={patientId} companions={patient.companions} />
        <ConsentFormsSection patientId={patientId} />
      </div>

      <XrayPlaceholderCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasta Notları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 print:hidden">
            <Textarea
              ref={noteRef}
              placeholder="Not ekleyin…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={2}
            />
            <Button
              disabled={!noteBody.trim() || addNote.isPending}
              onClick={() => addNote.mutate({ patientId, body: noteBody.trim() })}
            >
              Ekle
            </Button>
          </div>
          {patient.notes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz not eklenmemiş.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {patient.notes.map((note) => (
                <div key={note.id} className="text-sm">
                  <p>{note.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.author.name} · {formatDate(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Randevu Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          {patient.appointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Randevu geçmişi bulunmuyor.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {patient.appointments.map((a, idx) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-medium">
                    {/* appointments are ordered newest-first; number them chronologically
                        (oldest = 1, at the bottom) so the most recent is always the highest number, at top */}
                    {patient.appointments.length - idx}. Randevu · {formatDate(a.startsAt)}
                  </span>
                  <span className="text-muted-foreground">{a.doctor.user.name}</span>
                  <span className="text-muted-foreground">
                    {APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {a.completedTreatment && (
                    <span className="w-full text-xs text-emerald-600 dark:text-emerald-400">
                      Tamamlanan tedavi: {a.completedTreatment.name}
                    </span>
                  )}
                  {a.note && <span className="w-full text-xs text-muted-foreground">{a.note}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        presetPatient={{ id: patient.id, fullName: patient.fullName }}
        defaultDoctorId={patient.primaryDoctorId ?? undefined}
      />
      <PatientEditDialog open={editOpen} onOpenChange={setEditOpen} patient={patient} />
    </div>
  );
}
