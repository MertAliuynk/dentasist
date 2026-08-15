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
import { trpc } from "@/lib/trpc/client";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Rendered only while the dialog is open, so state always initializes fresh
// from props on mount — no reset-on-open effect needed (same convention as
// AppointmentDialog/PatientEditDialog elsewhere in this codebase).
function PaymentPlanCreateForm({
  onOpenChange,
  patientId,
  branchId,
  prefillAmount,
  treatmentIds,
}: {
  onOpenChange: (open: boolean) => void;
  patientId: string;
  branchId: string;
  prefillAmount?: number;
  treatmentIds?: string[];
}) {
  const [totalAmount, setTotalAmount] = useState(prefillAmount ? String(prefillAmount / 100) : "");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [interestRate, setInterestRate] = useState("0");
  const [startDate, setStartDate] = useState(todayIso());
  const [notes, setNotes] = useState("");

  const utils = trpc.useUtils();
  const create = trpc.paymentPlan.create.useMutation({
    onSuccess: () => {
      toast.success("Ödeme planı oluşturuldu (taslak).");
      utils.paymentPlan.listForPatient.invalidate({ patientId });
      utils.patient.getFinanceSummary.invalidate({ id: patientId });
      utils.treatment.listUnplanned.invalidate({ patientId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Yeni Ödeme Planı Oluştur</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {treatmentIds && treatmentIds.length > 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {treatmentIds.length} onaylı/tamamlanmış tedavinin tutarı otomatik dolduruldu; plan oluşturulunca bu
            tedaviler plana bağlanacak.
          </p>
        )}
        <div className="space-y-2">
          <Label>Toplam Tutar (₺)</Label>
          <Input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Taksit Sayısı</Label>
          <Input
            type="number"
            min={1}
            max={60}
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Faiz Oranı (%, opsiyonel)</Label>
          <Input type="number" min={0} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Başlangıç Tarihi</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Not (opsiyonel)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <p className="text-xs text-muted-foreground">
          Plan oluşturulduğunda taslak olarak kalır; taksitleri düzenledikten sonra
          &quot;İşleme Al&quot; ile onaylamanız gerekir.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Vazgeç
        </Button>
        <Button
          disabled={
            !totalAmount ||
            Number(totalAmount) <= 0 ||
            !installmentCount ||
            Number(installmentCount) < 1 ||
            create.isPending
          }
          onClick={() =>
            create.mutate({
              patientId,
              branchId,
              totalAmount: Math.round(Number(totalAmount) * 100),
              installmentCount: Number(installmentCount),
              interestRate: Number(interestRate) || 0,
              startDate: new Date(startDate).toISOString(),
              notes: notes || undefined,
              treatmentIds,
            })
          }
        >
          Oluştur
        </Button>
      </DialogFooter>
    </>
  );
}

export function PaymentPlanCreateDialog({
  open,
  onOpenChange,
  patientId,
  branchId,
  prefillAmount,
  treatmentIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  branchId: string;
  prefillAmount?: number;
  treatmentIds?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && (
          <PaymentPlanCreateForm
            onOpenChange={onOpenChange}
            patientId={patientId}
            branchId={branchId}
            prefillAmount={prefillAmount}
            treatmentIds={treatmentIds}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
