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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

export function LabCashEntryDialog({
  open,
  onOpenChange,
  type,
  date,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "GELIR" | "GIDER";
  date: string;
  branchId: string;
}) {
  const [entryDate, setEntryDate] = useState(date);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  const { data: categories } = trpc.lab.expenseCategory.list.useQuery(undefined, { enabled: type === "GIDER" });
  const utils = trpc.useUtils();

  const create = trpc.lab.cash.create.useMutation({
    onSuccess: () => {
      toast.success(type === "GELIR" ? "Gelir eklendi." : "Gider eklendi.");
      utils.lab.cash.listByDate.invalidate();
      onOpenChange(false);
      setAmount("");
      setCategoryId("");
      setDescription("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{type === "GELIR" ? "Yeni Gelir Ekle" : "Yeni Gider Ekle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tarih</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>

          {type === "GIDER" && (
            <div className="space-y-2">
              <Label>Gider Kalemi</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kalem seçin">
                    {(value: string) => categories?.find((c) => c.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Miktar (₺)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!amount || Number(amount) <= 0 || (type === "GIDER" && !categoryId) || create.isPending}
            onClick={() =>
              create.mutate({
                branchId,
                type,
                amount: Math.round(Number(amount) * 100),
                categoryId: type === "GIDER" ? categoryId : undefined,
                description: description || undefined,
                entryDate: new Date(entryDate).toISOString(),
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
