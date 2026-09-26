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

export function AddStageDialog({
  labTreatmentId,
  open,
  onOpenChange,
}: {
  labTreatmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [stageCatalogId, setStageCatalogId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

  const { data: stageCatalog } = trpc.lab.stageCatalog.list.useQuery();
  const utils = trpc.useUtils();

  const addStage = trpc.lab.treatment.addStage.useMutation({
    onSuccess: () => {
      toast.success("Aşama eklendi.");
      utils.lab.patient.getById.invalidate();
      utils.lab.treatment.list.invalidate();
      onOpenChange(false);
      setStageCatalogId("");
      setDueDate("");
      setNote("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aşama Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Aşama</Label>
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
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!stageCatalogId || !dueDate || addStage.isPending}
            onClick={() => addStage.mutate({ labTreatmentId, stageCatalogId, dueDate, note: note || undefined })}
          >
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
