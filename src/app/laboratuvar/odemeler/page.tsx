"use client";

import { useRouter } from "next/navigation";
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

export default function LabPaymentsPage() {
  const router = useRouter();
  const { data } = trpc.lab.reports.klinikDebt.useQuery();

  return (
    <div className="mx-auto w-full flex max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ödemeler</h1>
        <p className="text-sm text-muted-foreground">Klinik başına toplam borç.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klinikler</CardTitle>
          <CardDescription>Detay için bir kliniğe tıklayın.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klinik</TableHead>
                  <TableHead>Hekim Sayısı</TableHead>
                  <TableHead>Toplam Borç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((k) => (
                  <TableRow
                    key={k.klinikId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/laboratuvar/odemeler/${k.klinikId}`)}
                  >
                    <TableCell className="font-medium">{k.klinikName}</TableCell>
                    <TableCell>{k.doctorCount}</TableCell>
                    <TableCell>{formatMoney(k.totalDebt)}</TableCell>
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
