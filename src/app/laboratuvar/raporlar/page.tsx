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

export default function LabReportsPage() {
  const { data: branches } = trpc.lab.reports.branchSummary.useQuery();
  const { data: doctors } = trpc.lab.reports.doctorDebt.useQuery({});

  return (
    <div className="mx-auto w-full flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">Şube ve hekim başına iş ve borç dökümü.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şubeler</CardTitle>
        </CardHeader>
        <CardContent>
          {!branches || branches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şube</TableHead>
                  <TableHead>Hekim</TableHead>
                  <TableHead>Aktif İş</TableHead>
                  <TableHead>Tamamlanan İş</TableHead>
                  <TableHead>Toplam Borç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell>{b.doctorCount}</TableCell>
                    <TableCell>{b.activeJobCount}</TableCell>
                    <TableCell>{b.completedJobCount}</TableCell>
                    <TableCell>{formatMoney(b.totalDebt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hekim Başı Borç</CardTitle>
          <CardDescription>Erişiminiz dahilindeki tüm hekimler.</CardDescription>
        </CardHeader>
        <CardContent>
          {!doctors || doctors.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hekim</TableHead>
                  <TableHead>Klinik</TableHead>
                  <TableHead>Aktif İş</TableHead>
                  <TableHead>Tamamlanan İş</TableHead>
                  <TableHead>Toplam Borç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow key={d.doctorId}>
                    <TableCell className="font-medium">{d.doctorName}</TableCell>
                    <TableCell>{d.klinikName}</TableCell>
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
