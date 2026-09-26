"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export default function LabNewPatientPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [note, setNote] = useState("");
  const [treatmentTypeId, setTreatmentTypeId] = useState("");
  const [toothColorId, setToothColorId] = useState("");
  const [price, setPrice] = useState("");
  const [stageCatalogId, setStageCatalogId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stageNote, setStageNote] = useState("");

  const { data: treatmentTypes } = trpc.lab.treatmentType.list.useQuery();
  const { data: toothColors } = trpc.lab.toothColor.list.useQuery();
  const { data: stageCatalog } = trpc.lab.stageCatalog.list.useQuery();

  const createPatient = trpc.lab.patient.create.useMutation();
  const createTreatment = trpc.lab.treatment.create.useMutation();

  const isSubmitting = createPatient.isPending || createTreatment.isPending;
  const canSubmit = fullName.trim().length >= 2 && treatmentTypeId && stageCatalogId && dueDate;

  async function handleSubmit() {
    try {
      const patient = await createPatient.mutateAsync({ fullName: fullName.trim(), note: note || undefined });
      await createTreatment.mutateAsync({
        labPatientId: patient.id,
        labTreatmentTypeId: treatmentTypeId,
        toothColorId: toothColorId || undefined,
        price: price ? Math.round(Number(price) * 100) : undefined,
        firstStage: { stageCatalogId, dueDate, note: stageNote || undefined },
      });
      toast.success("Hasta ve iş oluşturuldu.");
      router.push(`/laboratuvar/hastalarim/${patient.id}`);
    } catch (error) {
      toastError(error);
    }
  }

  return (
    <div className="mx-auto w-full flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hasta Ekle</h1>
        <p className="text-sm text-muted-foreground">Yeni bir protez işi için hasta ve ilk aşama bilgilerini girin.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasta Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Hasta Adı</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İş Bilgileri</CardTitle>
          <CardDescription>Protez türü, diş rengi ve ilk aşama.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Protez / Tedavi Türü</Label>
            <Select value={treatmentTypeId} onValueChange={(v) => setTreatmentTypeId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tür seçin">
                  {(value: string) => treatmentTypes?.find((t) => t.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {treatmentTypes?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Diş Rengi (opsiyonel)</Label>
              <Select value={toothColorId} onValueChange={(v) => setToothColorId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Renk seçin">
                    {(value: string) => toothColors?.find((c) => c.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {toothColors?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tutar (₺, opsiyonel — boşsa katalog fiyatı kullanılır)</Label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>İlk Aşama</Label>
              <Select value={stageCatalogId} onValueChange={(v) => setStageCatalogId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aşama seçin">
                    {(value: string) => stageCatalog?.find((s) => s.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stageCatalog?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Teslim Tarihi</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aşama Notu (opsiyonel)</Label>
            <Textarea value={stageNote} onChange={(e) => setStageNote(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
