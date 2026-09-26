"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { formatMoney, LAB_TREATMENT_STATUS_LABEL } from "@/lib/lab/labels";

const FILTERS = [
  { value: undefined, label: "Tümü" },
  { value: "DEVAM_EDIYOR" as const, label: "Devam Eden" },
  { value: "TAMAMLANDI" as const, label: "Tamamlanan" },
];

export default function LabMyTransactionsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"DEVAM_EDIYOR" | "TAMAMLANDI" | undefined>(undefined);
  const { data: stats } = trpc.lab.treatment.myStats.useQuery();
  const { data: treatments } = trpc.lab.treatment.list.useQuery({ status });

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">İşlemlerim</h1>
        <p className="text-sm text-muted-foreground">Kendi işleriniz ve borç durumunuz.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Toplam Borç</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(stats?.totalDebt ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Hasta Sayısı</CardDescription>
            <CardTitle className="text-2xl">{stats?.patientCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Aktif İş</CardDescription>
            <CardTitle className="text-2xl">{stats?.activeJobCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Tamamlanan İş</CardDescription>
            <CardTitle className="text-2xl">{stats?.completedJobCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.value ? "default" : "outline"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {!treatments || treatments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Protez Türü</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatments.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/laboratuvar/hastalarim/${t.labPatient.id}`)}
                    >
                      <TableCell className="font-medium">{t.labPatient.fullName}</TableCell>
                      <TableCell>{t.labTreatmentType.name}</TableCell>
                      <TableCell>{LAB_TREATMENT_STATUS_LABEL[t.status]}</TableCell>
                      <TableCell>{formatMoney(t.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
