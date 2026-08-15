"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function BranchComparisonPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsMuhasebe.crossBranch.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şube Karşılaştırma</CardTitle>
          <CardDescription>Şubelere göre gelir-gider dağılımı.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Başlangıç</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bitiş</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {data && data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Grafik</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="branchName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v / 100).toFixed(0)}₺`} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend />
                <Bar dataKey="income" name="Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Gider" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şube</TableHead>
                  <TableHead>Gelir</TableHead>
                  <TableHead>Gider</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell>{formatMoney(b.income)}</TableCell>
                    <TableCell>{formatMoney(b.expense)}</TableCell>
                    <TableCell>{formatMoney(b.income - b.expense)}</TableCell>
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
