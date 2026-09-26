"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

export function AddTreatmentDialog({
  labPatientId,
  open,
  onOpenChange,
}: {
  labPatientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [treatmentTypeId, setTreatmentTypeId] = useState("");
  const [toothColorId, setToothColorId] = useState("");
  const [price, setPrice] = useState("");
  const [stageCatalogId, setStageCatalogId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [stageNote, setStageNote] = useState("");

  const { data: treatmentTypes } = trpc.lab.treatmentType.list.useQuery();
  const { data: toothColors } = trpc.lab.toothColor.list.useQuery();
  const { data: stageCatalog } = trpc.lab.stageCatalog.list.useQuery();
  const utils = trpc.useUtils();

  const createTreatment = trpc.lab.treatment.create.useMutation({
    onSuccess: () => {
      toast.success("Yeni iş eklendi.");
      utils.lab.patient.getById.invalidate();
      utils.lab.treatment.list.invalidate();
      onOpenChange(false);
      setTreatmentTypeId("");
      setToothColorId("");
      setPrice("");
      setStageCatalogId("");
      setDueDate("");
      setStageNote("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni İş Ekle</DialogTitle>
          <DialogDescription>Bu hasta için yeni bir protez/tedavi işi oluşturun.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
              <Label>Tutar (₺, opsiyonel)</Label>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!treatmentTypeId || !stageCatalogId || !dueDate || createTreatment.isPending}
            onClick={() =>
              createTreatment.mutate({
                labPatientId,
                labTreatmentTypeId: treatmentTypeId,
                toothColorId: toothColorId || undefined,
                price: price ? Math.round(Number(price) * 100) : undefined,
                firstStage: { stageCatalogId, dueDate, note: stageNote || undefined },
              })
            }
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
