"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, CalendarClock, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

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

const SUB_PAGES = [
  { href: "/dental/raporlar/hekim-performansi", icon: Stethoscope, title: "Hekim Performansı", description: "Hekim başına randevu ve tamamlanma oranı." },
  { href: "/dental/raporlar/randevu-raporlari", icon: CalendarClock, title: "Randevu Raporları", description: "Durum dağılımı ve gelmeme oranı." },
  { href: "/dental/raporlar/tedavi-istatistikleri", icon: Sparkles, title: "Tedavi İstatistikleri", description: "En çok uygulanan tedavi türleri." },
  { href: "/dental/raporlar/hasta-istatistikleri", icon: Users, title: "Hasta İstatistikleri", description: "Toplam ve yeni hasta sayıları." },
] as const;

export default function DentalReportsPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsDental.summary.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  return (
    <div className="mx-auto w-full flex max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raporlar — Genel Bakış</CardTitle>
          <CardDescription>Muayene, tedavi ve hekim başı randevu raporları.</CardDescription>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Toplam Randevu</CardDescription>
            <CardTitle className="text-2xl">{data?.totalAppointments ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Tamamlanan Tedavi</CardDescription>
            <CardTitle className="text-2xl">{data?.treatmentCounts.COMPLETED ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gelmeyen Randevu</CardDescription>
            <CardTitle className="text-2xl">{data?.statusCounts.NO_SHOW ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durum Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data &&
              Object.entries(data.statusCounts).map(([key, value]) => (
                <div key={key} className="rounded-md border border-border p-3 text-sm">
                  <p className="text-muted-foreground">{STATUS_LABEL[key] ?? key}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Detaylı Raporlar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SUB_PAGES.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <s.icon className="size-5 text-primary" />
                  <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
