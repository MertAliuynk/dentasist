"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { formatMoney } from "@/lib/lab/labels";
import { LabCashEntryDialog } from "@/components/lab/cash-entry-dialog";

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" }).format(
    new Date(dateStr),
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function LabCashRegisterPage() {
  const [date, setDate] = useState(todayIso());
  const [addType, setAddType] = useState<"GELIR" | "GIDER" | null>(null);

  const { data: branches } = trpc.lab.klinik.listBranches.useQuery();
  const [branchId, setBranchId] = useState("");
  const activeBranchId = branchId || branches?.[0]?.id || "";
  const { data } = trpc.lab.cash.listByDate.useQuery({ date });

  function shiftDay(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {branches && branches.length > 1 && (
          <Select value={activeBranchId} onValueChange={(v) => setBranchId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Şube seçin">
                {(value: string) => branches.find((b) => b.id === value)?.name}
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
        )}
        <div className="flex flex-wrap items-center gap-2">
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
                    <span>{e.description || "Gelir"}</span>
                    <span className="font-medium">{formatMoney(e.amount)}</span>
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
                    <span className="font-medium">{formatMoney(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {addType && activeBranchId && (
        <LabCashEntryDialog
          open={!!addType}
          onOpenChange={(open) => !open && setAddType(null)}
          type={addType}
          date={date}
          branchId={activeBranchId}
        />
      )}
    </div>
  );
}
