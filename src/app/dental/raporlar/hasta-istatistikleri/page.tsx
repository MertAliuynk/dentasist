"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function PatientStatsPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsDental.patientStats.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasta İstatistikleri</CardTitle>
          <CardDescription>Toplam hasta sayısı ve seçili dönemdeki yeni hastalar.</CardDescription>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Toplam Hasta</CardDescription>
            <CardTitle className="text-2xl">{data?.totalPatients ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Seçili Dönemde Yeni Hasta</CardDescription>
            <CardTitle className="text-2xl">{data?.newPatients ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şubeye Göre Hasta Sayısı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data || data.byBranch.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.byBranch.map((b) => (
                  <div key={b.branchId} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-muted-foreground">{b.branchName}</p>
                    <p className="text-xl font-semibold">{b.count}</p>
                  </div>
                ))}
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byBranch}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="branchName" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Hasta Sayısı" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
