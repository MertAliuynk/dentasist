"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { CashEntryDialog } from "@/components/muhasebe/cash-entry-dialog";
import { hasCapability } from "@/server/rbac/permissions";
import { CurrencyWidget } from "@/components/shared/currency-widget";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(dateStr));
}

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyCashRegisterPage() {
  const [date, setDate] = useState(todayIso());
  const [addType, setAddType] = useState<"GELIR" | "GIDER" | null>(null);

  const { data: branches } = trpc.branch.list.useQuery();
  const branchId = branches?.[0]?.id ?? "";
  const { data } = trpc.cashRegister.listByDate.useQuery({ date });
  const { data: me } = trpc.user.me.useQuery();
  const utils = trpc.useUtils();

  const canDelete = hasCapability(
    me?.memberships.map((m) => m.role) ?? [],
    "muhasebe:cash:delete",
    me?.capabilityOverrides,
  );

  const deleteEntry = trpc.cashRegister.delete.useMutation({
    onSuccess: () => {
      toast.success("Kayıt silindi.");
      utils.cashRegister.listByDate.invalidate();
      utils.paymentPlan.listForPatient.invalidate();
    },
    onError: (e) => toastError(e),
  });

  function shiftDay(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  const net = (data?.byMethod.NAKIT ?? 0) + (data?.byMethod.HAVALE ?? 0) + (data?.byMethod.KREDI_KARTI ?? 0);

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="icon" aria-label="Önceki gün" onClick={() => shiftDay(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-48 text-center text-sm font-medium">{formatDate(date)}</span>
        <Button variant="ghost" size="icon" aria-label="Sonraki gün" onClick={() => shiftDay(1)}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDate(todayIso())}>
          Bugüne Git
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4" />
              <CardTitle className="text-base">Gelir</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddType("GELIR")}>
              <Plus className="size-4" />
              Gelir Ekle
            </Button>
          </CardHeader>
          <CardContent>
            {!data || data.income.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Bugün için gelir kaydı yok.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.income.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{e.description || (e.patient ? e.patient.fullName : "Gelir")}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(e.amount)}</span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label="Kaydı sil"
                          disabled={deleteEntry.isPending}
                          onClick={() => deleteEntry.mutate({ id: e.id })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-destructive" />
              <CardTitle className="text-base">Gider</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddType("GIDER")}>
              <Plus className="size-4" />
              Gider Ekle
            </Button>
          </CardHeader>
          <CardContent>
            {!data || data.expense.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Bugün için gider kaydı yok.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.expense.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{e.description || e.category?.name || "Gider"}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMoney(e.amount)}</span>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label="Kaydı sil"
                          disabled={deleteEntry.isPending}
                          onClick={() => deleteEntry.mutate({ id: e.id })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nakit", value: data?.byMethod.NAKIT ?? 0 },
          { label: "Havale", value: data?.byMethod.HAVALE ?? 0 },
          { label: "Kredi Kartı", value: data?.byMethod.KREDI_KARTI ?? 0 },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(item.value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card className="border-foreground/20">
          <CardHeader>
            <CardDescription>Toplam</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(net)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <CurrencyWidget />

      {addType && branchId && (
        <CashEntryDialog
          open={!!addType}
          onOpenChange={(open) => !open && setAddType(null)}
          type={addType}
          date={date}
          branchId={branchId}
        />
      )}
    </div>
  );
}
