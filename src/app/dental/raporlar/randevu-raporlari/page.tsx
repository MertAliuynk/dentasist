"use client";

import { useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#6366f1",
  ARRIVED: "#10b981",
  NO_SHOW: "#ef4444",
  POSTPONED: "#f59e0b",
  COMPLETED: "#0ea5e9",
  CANCELED: "#94a3b8",
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Planlandı",
  ARRIVED: "Geldi",
  NO_SHOW: "Gelmedi",
  POSTPONED: "Ertelendi",
  COMPLETED: "Tamamlandı",
  CANCELED: "İptal",
};

export default function AppointmentReportsPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsDental.summary.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  const total = data?.totalAppointments ?? 0;
  const noShowRate = total > 0 ? Math.round(((data?.statusCounts.NO_SHOW ?? 0) / total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Randevu Raporları</CardTitle>
          <CardDescription>Randevu durum dağılımı ve gelmeme oranı.</CardDescription>
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
            <CardDescription>Toplam Randevu</CardDescription>
            <CardTitle className="text-2xl">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gelmeme Oranı</CardDescription>
            <CardTitle className="text-2xl text-destructive">%{noShowRate}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durum Dağılımı</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 content-start">
            {data &&
              Object.entries(data.statusCounts).map(([key, value]) => (
                <div key={key} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-muted-foreground">{STATUS_LABEL[key] ?? key}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              ))}
          </div>
          {total > 0 && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(data!.statusCounts).map(([key, value]) => ({
                      name: STATUS_LABEL[key] ?? key,
                      value,
                      key,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {Object.keys(data!.statusCounts).map((key) => (
                      <Cell key={key} fill={STATUS_COLOR[key] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
