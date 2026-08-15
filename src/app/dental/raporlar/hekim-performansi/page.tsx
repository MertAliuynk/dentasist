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

export default function DoctorPerformanceReportPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsDental.summary.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hekim Performansı</CardTitle>
          <CardDescription>Hekim başına toplam randevu, tamamlanma ve gelmeme sayıları.</CardDescription>
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

      {data && data.byDoctor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Grafik</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDoctor}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="doctorName" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="completed" name="Tamamlanan/Geldi" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="noShow" name="Gelmedi" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {!data || data.byDoctor.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doktor</TableHead>
                  <TableHead>Toplam Randevu</TableHead>
                  <TableHead>Tamamlanan/Geldi</TableHead>
                  <TableHead>Gelmedi</TableHead>
                  <TableHead>Tamamlanma Oranı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byDoctor
                  .sort((a, b) => b.total - a.total)
                  .map((d) => (
                    <TableRow key={d.doctorId}>
                      <TableCell className="font-medium">{d.doctorName}</TableCell>
                      <TableCell>{d.total}</TableCell>
                      <TableCell>{d.completed}</TableCell>
                      <TableCell>{d.noShow}</TableCell>
                      <TableCell>{d.total > 0 ? `%${Math.round((d.completed / d.total) * 100)}` : "—"}</TableCell>
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
