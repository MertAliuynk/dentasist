"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { PhoneInput } from "@/components/shared/phone-input";
import { AnamnesisForm } from "@/components/dental/anamnesis-form";
import type { AnamnesisAnswers } from "@/lib/dental/anamnesis-questions";

type PatientLike = {
  id: string;
  fullName: string;
  phone: string;
  branchId: string;
  tcKimlikNo: string | null;
  birthDate: string | Date | null;
  anamnesis: string | null;
  anamnesisAnswers: unknown;
  primaryDoctorId: string | null;
};

// Rendered only while the dialog is open (see PatientEditDialog below), so
// each open gets a fresh mount with state initialized straight from
// `patient` — no reset-on-open effect needed.
function PatientEditForm({
  patient,
  onOpenChange,
}: {
  patient: PatientLike;
  onOpenChange: (open: boolean) => void;
}) {
  const [fullName, setFullName] = useState(patient.fullName);
  const [phone, setPhone] = useState(patient.phone);
  const [branchId, setBranchId] = useState(patient.branchId);
  const [tcKimlikNo, setTcKimlikNo] = useState(patient.tcKimlikNo ?? "");
  const [birthDate, setBirthDate] = useState(
    patient.birthDate ? new Date(patient.birthDate).toISOString().slice(0, 10) : "",
  );
  const [anamnesis, setAnamnesis] = useState(patient.anamnesis ?? "");
  const [anamnesisAnswers, setAnamnesisAnswers] = useState<AnamnesisAnswers>(
    (patient.anamnesisAnswers as AnamnesisAnswers | null) ?? {},
  );
  const [primaryDoctorId, setPrimaryDoctorId] = useState(patient.primaryDoctorId ?? "");

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const utils = trpc.useUtils();

  const update = trpc.patient.update.useMutation({
    onSuccess: () => {
      toast.success("Hasta bilgileri güncellendi.");
      utils.patient.getById.invalidate({ id: patient.id });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Hasta Bilgilerini Düzenle</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>Ad Soyad</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Telefon</Label>
          <PhoneInput defaultValue={phone} onChange={setPhone} />
        </div>
        {branches && branches.length > 1 && (
          <div className="space-y-2">
            <Label>Şube</Label>
            <Select value={branchId} onValueChange={(v) => v && setBranchId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Şube seçin">
                  {(value: string) => branches?.find((b) => b.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>İlgili Doktor</Label>
          <Select value={primaryDoctorId} onValueChange={(v) => setPrimaryDoctorId(v ?? "")}>
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
        <div className="space-y-2">
          <Label>TC Kimlik No</Label>
          <Input value={tcKimlikNo} onChange={(e) => setTcKimlikNo(e.target.value)} maxLength={11} />
        </div>
        <div className="space-y-2">
          <Label>Doğum Tarihi</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Eski Not (serbest metin, opsiyonel)</Label>
          <Textarea value={anamnesis} onChange={(e) => setAnamnesis(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Anamnez</Label>
          <AnamnesisForm answers={anamnesisAnswers} onChange={setAnamnesisAnswers} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Vazgeç
        </Button>
        <Button
          disabled={update.isPending || !fullName.trim() || !phone.trim()}
          onClick={() =>
            update.mutate({
              id: patient.id,
              fullName: fullName.trim(),
              phone: phone.trim(),
              branchId: branchId !== patient.branchId ? branchId : undefined,
              primaryDoctorId: primaryDoctorId || null,
              tcKimlikNo: tcKimlikNo || undefined,
              birthDate: birthDate || null,
              anamnesis: anamnesis || null,
              anamnesisAnswers,
            })
          }
        >
          Kaydet
        </Button>
      </DialogFooter>
    </>
  );
}

export function PatientEditDialog({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientLike;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <PatientEditForm patient={patient} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}
