"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

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

export function DoctorFinancialsClient({ doctorId }: { doctorId: string }) {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data, isLoading } = trpc.doctor.getFinancials.useQuery({
    doctorId,
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  if (isLoading) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!data) return <p className="py-24 text-center text-sm text-muted-foreground">Hekim bulunamadı.</p>;

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">
              {data.doctor.title ? `${data.doctor.title} ` : ""}
              {data.doctor.user.name}
            </CardTitle>
            <CardDescription>Hakediş oranı: %{Number(data.doctor.commissionRate)}</CardDescription>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Toplam Gelir", value: data.totalIncome },
          { label: "Toplam Gider", value: data.totalExpense },
          { label: "Hakediş", value: data.earnings },
          { label: "Bekleyen Ödemeler", value: data.pendingAmount },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
              <p className="text-2xl font-semibold">{formatMoney(item.value)}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hekim Gelirleri</CardTitle>
          </CardHeader>
          <CardContent>
            {data.incomeEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Kayıt yok</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.incomeEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {e.patient?.fullName ?? e.description ?? "Gelir"} · {formatDate(e.entryDate)}
                    </span>
                    <span className="font-medium">{formatMoney(e.amount)}</span>
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
                  <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{e.description || "Gider"} · {formatDate(e.entryDate)}</span>
                    <span className="font-medium">{formatMoney(e.amount)}</span>
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
