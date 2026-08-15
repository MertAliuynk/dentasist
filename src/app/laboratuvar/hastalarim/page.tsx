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

export default function LabPatientsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"DEVAM_EDIYOR" | "TAMAMLANDI" | undefined>(undefined);
  const { data } = trpc.lab.treatment.list.useQuery({ status });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hastalarım</h1>
          <p className="text-sm text-muted-foreground">Protez işleri ve durumları.</p>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İşler</CardTitle>
          <CardDescription>{data?.length ?? 0} kayıt.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Klinik</TableHead>
                    <TableHead>Hekim</TableHead>
                    <TableHead>Protez Türü</TableHead>
                    <TableHead>Son Aşama</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/laboratuvar/hastalarim/${t.labPatient.id}`)}
                    >
                      <TableCell className="font-medium">{t.labPatient.fullName}</TableCell>
                      <TableCell>{t.labPatient.klinik.name}</TableCell>
                      <TableCell>{t.doctor.user.name}</TableCell>
                      <TableCell>{t.labTreatmentType.name}</TableCell>
                      <TableCell>{t.stages[0]?.stageCatalog.name ?? "—"}</TableCell>
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
