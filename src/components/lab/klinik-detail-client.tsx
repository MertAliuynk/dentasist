"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { formatMoney } from "@/lib/lab/labels";

export function LabKlinikDetailClient({ klinikId }: { klinikId: string }) {
  const { data } = trpc.lab.reports.klinikDetail.useQuery({ klinikId });

  if (!data) return <p className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="mx-auto w-full flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{data.klinik.name}</h1>
        <p className="text-sm text-muted-foreground">Hekim başına borç dökümü.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hekimler</CardTitle>
          <CardDescription>{data.doctors.length} hekim.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.doctors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu klinikte kayıtlı hekim yok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hekim</TableHead>
                  <TableHead>Aktif İş</TableHead>
                  <TableHead>Tamamlanan İş</TableHead>
                  <TableHead>Toplam Borç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.doctors.map((d) => (
                  <TableRow key={d.doctorId}>
                    <TableCell className="font-medium">{d.doctorName}</TableCell>
                    <TableCell>{d.activeJobCount}</TableCell>
                    <TableCell>{d.completedJobCount}</TableCell>
                    <TableCell>{formatMoney(d.totalDebt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
