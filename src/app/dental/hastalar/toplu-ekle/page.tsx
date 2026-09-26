"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { PhoneInput } from "@/components/shared/phone-input";

type Row = { id: string; fullName: string; phone: string; tcKimlikNo: string };

const MAX_ROWS = 50;

let rowIdCounter = 0;
function makeRow(): Row {
  rowIdCounter += 1;
  return { id: `row-${rowIdCounter}`, fullName: "", phone: "", tcKimlikNo: "" };
}

export default function BulkPatientImportPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [makeRow(), makeRow(), makeRow()]);

  const { data: branches } = trpc.branch.list.useQuery();

  const bulkCreate = trpc.patient.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} hasta eklendi.`);
      router.push("/dental/hasta-listesi");
    },
    onError: (e) => toastError(e),
  });

  function updateRow(id: string, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  const validRows = rows.filter((r) => r.fullName.trim() && r.phone.trim());
  // Single-branch organizations have nothing to choose — auto-assign and
  // skip showing the selector at all, same as the single-patient form.
  const effectiveBranchId = branches && branches.length === 1 ? branches[0].id : branchId;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toplu Hasta Ekleme</CardTitle>
          <CardDescription>Tek seferde en fazla {MAX_ROWS} hasta ekleyebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {branches && branches.length > 1 && (
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Şube seçin">
                    {(value: string) => branches?.find((b) => b.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap gap-2 sm:flex-nowrap">
                <Input
                  placeholder="Ad Soyad"
                  value={row.fullName}
                  onChange={(e) => updateRow(row.id, "fullName", e.target.value)}
                />
                <div className="w-full sm:w-72">
                  <PhoneInput defaultValue={row.phone} onChange={(value) => updateRow(row.id, "phone", value)} />
                </div>
                <Input
                  placeholder="TC Kimlik (opsiyonel)"
                  value={row.tcKimlikNo}
                  onChange={(e) => updateRow(row.id, "tcKimlikNo", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Satırı sil"
                  onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length >= MAX_ROWS}
              onClick={() => setRows((prev) => [...prev, makeRow()])}
            >
              <Plus className="size-4" />
              Satır Ekle
            </Button>
            <p className="text-xs text-muted-foreground">
              {validRows.length} / {MAX_ROWS} geçerli satır
            </p>
          </div>

          <Button
            className="w-full"
            disabled={bulkCreate.isPending || !effectiveBranchId || validRows.length === 0}
            onClick={() => bulkCreate.mutate({ branchId: effectiveBranchId, patients: validRows })}
          >
            {bulkCreate.isPending ? "Ekleniyor…" : "Hastaları Ekle"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
