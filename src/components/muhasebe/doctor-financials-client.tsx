"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";
import { cn } from "@/lib/utils";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(date));
}

type Basis = "TAHSILAT" | "TEDAVI";
const BASIS_KEY = "hakedis-basis";

const BASES: { value: Basis; title: string; hint: string }[] = [
  { value: "TAHSILAT", title: "Tahsilat bazlı", hint: "(Hekimin hastalarından tahsilat − hekim giderleri) × oran" },
  { value: "TEDAVI", title: "Tedavi bazlı", hint: "Dönemde tamamlanan tedavilerin tutarı × oran" },
];

function CommissionEditor({ doctorId, rate }: { doctorId: string; rate: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(rate));
  const utils = trpc.useUtils();
  const save = trpc.doctor.updateCommission.useMutation({
    onSuccess: () => {
      toast.success("Hakediş oranı güncellendi.");
      utils.doctor.getFinancials.invalidate();
      utils.doctor.list.invalidate();
      setEditing(false);
    },
    onError: (e) => toastError(e),
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(rate));
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 rounded px-1 font-medium text-foreground hover:bg-accent"
        title="Oranı düzenle"
      >
        %{rate} <Pencil className="size-3 text-muted-foreground" />
      </button>
    );
  }
  const n = Number(draft.replace(",", "."));
  const valid = draft.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100;
  return (
    <span className="inline-flex items-center gap-1">
      %
      <Input
        autoFocus
        inputMode="decimal"
        className="h-7 w-16"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && valid && save.mutate({ id: doctorId, commissionRate: n })}
      />
      <Button size="sm" className="h-7" disabled={!valid || save.isPending} onClick={() => save.mutate({ id: doctorId, commissionRate: n })}>
        Kaydet
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
        Vazgeç
      </Button>
    </span>
  );
}

export function DoctorFinancialsClient({ doctorId }: { doctorId: string }) {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));
  // Read lazily: basis is only rendered after data loads, so SSR never shows it.
  const [basis, setBasis] = useState<Basis>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(BASIS_KEY) : null;
      return saved === "TEDAVI" ? "TEDAVI" : "TAHSILAT";
    } catch {
      return "TAHSILAT";
    }
  });
  const pickBasis = (b: Basis) => {
    setBasis(b);
    try {
      localStorage.setItem(BASIS_KEY, b);
    } catch {}
  };

  const { data: me } = trpc.user.me.useQuery();
  const canEditRate = hasCapability(me?.memberships.map((m) => m.role) ?? [], "org:user:manage", me?.capabilityOverrides);

  const { data, isLoading } = trpc.doctor.getFinancials.useQuery({
    doctorId,
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  if (isLoading) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!data) return <p className="py-24 text-center text-sm text-muted-foreground">Hekim bulunamadı.</p>;

  const earnings = basis === "TAHSILAT" ? data.earningsByCollection : data.earningsByTreatment;
  const base = basis === "TAHSILAT" ? data.collectionBase : data.treatmentRevenue;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">
              {data.doctor.title ? `${data.doctor.title} ` : ""}
              {data.doctor.user.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              Hakediş oranı:{" "}
              {canEditRate ? <CommissionEditor doctorId={doctorId} rate={data.commissionRate} /> : <span>%{data.commissionRate}</span>}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Başlangıç</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bitiş</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="flex flex-col gap-3 space-y-0 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardDescription>Hakediş ({formatDate(start)} – {formatDate(end)})</CardDescription>
            <p className="text-3xl font-semibold tabular-nums">{formatMoney(earnings)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(base)} × %{data.commissionRate}
              {data.commissionRate === 0 && " — hakediş oranı tanımlanmamış, yukarıdan girebilirsiniz."}
            </p>
          </div>
          <div className="inline-flex flex-col gap-1 sm:flex-row" role="radiogroup" aria-label="Hesaplama esası">
            {BASES.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={basis === b.value}
                onClick={() => pickBasis(b.value)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors sm:max-w-56",
                  basis === b.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                )}
              >
                <span className="block font-medium">{b.title}</span>
                <span className="block text-xs text-muted-foreground">{b.hint}</span>
              </button>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tahsilat", value: data.totalIncome },
          { label: "Hekim Giderleri", value: data.totalExpense },
          { label: "Tamamlanan Tedaviler", value: data.treatmentRevenue },
          { label: "Bekleyen Taksitler", value: data.pendingAmount },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(item.value)}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tahsilatlar</CardTitle>
          </CardHeader>
          <CardContent>
            {data.incomeEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Kayıt yok</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.incomeEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {e.patient?.fullName ?? e.description ?? "Gelir"} · {formatDate(e.entryDate)}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tamamlanan Tedaviler</CardTitle>
          </CardHeader>
          <CardContent>
            {data.completedTreatments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Kayıt yok</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.completedTreatments.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">
                        {t.name}
                        {t.toothNumber ? ` (#${t.toothNumber})` : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.patientName} · {t.completedAt ? formatDate(t.completedAt) : "—"}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(t.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hekim Giderleri</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expenseEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Kayıt yok</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.expenseEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {e.description || "Gider"} · {formatDate(e.entryDate)}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
