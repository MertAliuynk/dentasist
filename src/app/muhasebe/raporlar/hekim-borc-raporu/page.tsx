"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function DoctorDebtReportPage() {
  const { data } = trpc.reportsMuhasebe.doctorDebtSummary.useQuery();

  return (
    <div className="mx-auto w-full flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hekim Borç Raporu</CardTitle>
          <CardDescription>Hekim başına henüz tahsil edilmemiş (ödenmemiş/kısmi) tutar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v / 100).toFixed(0)}₺`} />
                    <YAxis type="category" dataKey="doctorName" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Bar dataKey="debt" name="Bekleyen Tutar" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hekim</TableHead>
                    <TableHead>Bekleyen Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.doctorId}>
                      <TableCell className="font-medium">{d.doctorName}</TableCell>
                      <TableCell>{formatMoney(d.debt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
