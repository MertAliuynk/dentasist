"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function toDateInput(date: string | Date) {
  return new Date(date).toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  UNPAID: "Ödenmedi",
  PARTIAL: "Kısmi Ödendi",
  PAID: "Ödendi",
  OVERDUE: "Gecikmiş",
};

const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal",
};

type Installment = {
  id: string;
  sequence: number;
  amount: number;
  paidAmount: number;
  dueDate: string | Date;
  status: string;
  isLocked: boolean;
};

type Plan = {
  id: string;
  status: string;
  totalAmount: number;
  installmentCount: number;
  patientId: string;
  installments: Installment[];
};

function InstallmentRow({ plan, installment }: { plan: Plan; installment: Installment }) {
  const [amountDraft, setAmountDraft] = useState(String(installment.amount / 100));
  const [dueDateDraft, setDueDateDraft] = useState(toDateInput(installment.dueDate));
  const utils = trpc.useUtils();

  const editAmount = trpc.paymentPlan.editInstallmentAmount.useMutation({
    onSuccess: () => {
      toast.success("Taksit tutarı güncellendi.");
      utils.paymentPlan.listForPatient.invalidate({ patientId: plan.patientId });
    },
    onError: (e) => toastError(e),
  });
  const editDate = trpc.paymentPlan.editInstallmentDueDate.useMutation({
    onSuccess: () => {
      toast.success("Taksit tarihi güncellendi.");
      utils.paymentPlan.listForPatient.invalidate({ patientId: plan.patientId });
    },
    onError: (e) => toastError(e),
  });

  const amountChanged = Math.round(Number(amountDraft) * 100) !== installment.amount;
  const dateChanged = dueDateDraft !== toDateInput(installment.dueDate);
  const canEditAmount = plan.status === "DRAFT";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm last:border-0">
      <span className="w-16 shrink-0 text-muted-foreground">#{installment.sequence}</span>

      {canEditAmount ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            className="h-8 w-28"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
          />
          {amountChanged && (
            <Button
              size="sm"
              variant="outline"
              disabled={editAmount.isPending}
              onClick={() =>
                editAmount.mutate({
                  planId: plan.id,
                  sequence: installment.sequence,
                  amount: Math.round(Number(amountDraft) * 100),
                })
              }
            >
              Kaydet
            </Button>
          )}
        </div>
      ) : (
        <span className="w-28 font-medium">{formatMoney(installment.amount)}</span>
      )}

      <div className="flex items-center gap-1">
        <Input
          type="date"
          className="h-8 w-40"
          value={dueDateDraft}
          onChange={(e) => setDueDateDraft(e.target.value)}
        />
        {dateChanged && (
          <Button
            size="sm"
            variant="outline"
            disabled={editDate.isPending}
            onClick={() =>
              editDate.mutate({ installmentId: installment.id, dueDate: new Date(dueDateDraft).toISOString() })
            }
          >
            Kaydet
          </Button>
        )}
      </div>

      <Badge variant={installment.status === "PAID" ? "secondary" : "outline"}>
        {STATUS_LABEL[installment.status] ?? installment.status}
        {installment.isLocked ? " · manuel" : ""}
      </Badge>

      {installment.status === "PARTIAL" && (
        <div className="flex w-32 items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, (installment.paidAmount / installment.amount) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatMoney(installment.paidAmount)} / {formatMoney(installment.amount)}
          </span>
        </div>
      )}

      {plan.status === "ACTIVE" && installment.status !== "PAID" && (
        <p className="ml-auto text-xs text-muted-foreground">
          Günlük Kasa&apos;da hasta geliri eklendiğinde otomatik ödendi olarak işaretlenir.
        </p>
      )}
    </div>
  );
}

export function PaymentPlanCard({ plan }: { plan: Plan }) {
  const [countDraft, setCountDraft] = useState(String(plan.installmentCount));
  const utils = trpc.useUtils();

  const updateCount = trpc.paymentPlan.updateInstallmentCount.useMutation({
    onSuccess: () => {
      toast.success("Taksit sayısı güncellendi.");
      utils.paymentPlan.listForPatient.invalidate({ patientId: plan.patientId });
    },
    onError: (e) => toastError(e),
  });

  const activate = trpc.paymentPlan.activate.useMutation({
    onSuccess: () => {
      toast.success("Plan işleme alındı.");
      utils.paymentPlan.listForPatient.invalidate({ patientId: plan.patientId });
      utils.patient.getFinanceSummary.invalidate({ id: plan.patientId });
    },
    onError: (e) => toastError(e),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = trpc.paymentPlan.delete.useMutation({
    onSuccess: () => {
      toast.success("Ödeme planı silindi.");
      utils.paymentPlan.listForPatient.invalidate({ patientId: plan.patientId });
      utils.patient.getFinanceSummary.invalidate({ id: plan.patientId });
      utils.treatment.listUnplanned.invalidate({ patientId: plan.patientId });
    },
    onError: (e) => toastError(e),
  });

  const sum = plan.installments.reduce((s, i) => s + i.amount, 0);
  const balanced = sum === plan.totalAmount;
  const paid = plan.installments.reduce((s, i) => s + i.paidAmount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-sm">
            {formatMoney(plan.totalAmount)} · {plan.installmentCount} taksit
          </CardTitle>
          <CardDescription>
            <Badge variant={plan.status === "ACTIVE" ? "secondary" : "outline"}>
              {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
            </Badge>
          </CardDescription>
        </div>
        {plan.status === "DRAFT" && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={60}
              className="h-8 w-20"
              value={countDraft}
              onChange={(e) => setCountDraft(e.target.value)}
            />
            {Number(countDraft) !== plan.installmentCount && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateCount.isPending}
                onClick={() => updateCount.mutate({ planId: plan.id, newCount: Number(countDraft) })}
              >
                Taksit Sayısını Güncelle
              </Button>
            )}
            <Button
              size="sm"
              disabled={!balanced || activate.isPending}
              onClick={() => activate.mutate({ planId: plan.id })}
            >
              İşleme Al
            </Button>
          </div>
        )}
        {!confirmDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Planı Sil
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {confirmDelete && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <span className="flex-1">
              Bu ödeme planı silinsin mi?
              {paid > 0 && (
                <span className="block text-xs text-muted-foreground">
                  Plana işlenmiş {formatMoney(paid)} ödeme silinmez; kasada hastanın ödemesi olarak kalır.
                </span>
              )}
            </span>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
              Vazgeç
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ planId: plan.id })}
            >
              Evet, Sil
            </Button>
          </div>
        )}
        {!balanced && plan.status === "DRAFT" && (
          <p className="mb-2 text-xs text-destructive">
            Taksit toplamı ({formatMoney(sum)}) plan tutarına eşit değil.
          </p>
        )}
        <div className="flex flex-col">
          {plan.installments
            .sort((a, b) => a.sequence - b.sequence)
            .map((i) => (
              <InstallmentRow key={i.id} plan={plan} installment={i} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
