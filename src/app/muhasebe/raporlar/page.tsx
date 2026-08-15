"use client";

import { useState } from "react";
import Link from "next/link";
import { GitCompare, Stethoscope, PieChart, LineChart } from "lucide-react";
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

const SUB_PAGES = [
  { href: "/muhasebe/raporlar/finansal-raporlar", icon: LineChart, title: "Finansal Raporlar", description: "Günlük gelir-gider trendi." },
  { href: "/muhasebe/raporlar/sube-karsilastirma", icon: GitCompare, title: "Şube Karşılaştırma", description: "Şubelere göre gelir-gider." },
  { href: "/muhasebe/raporlar/hekim-borc-raporu", icon: Stethoscope, title: "Hekim Borç Raporu", description: "Hekim başına tahsil edilmemiş tutar." },
  { href: "/muhasebe/raporlar/gider-analizi", icon: PieChart, title: "Gider Analizi", description: "Gider kalemine göre dağılım." },
] as const;

export default function MuhasebeReportsPage() {
  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsMuhasebe.summary.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raporlar — Genel Bakış</CardTitle>
          <CardDescription>Bekleyen/gecikmiş tutarlar ve gelir-gider karşılaştırması.</CardDescription>
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
            <CardDescription>Toplam Bekleyen Tutar</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(data?.pendingTotal ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Toplam Gecikmiş Tutar</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatMoney(data?.overdueTotal ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gelir - Gider (Günlük)</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.dailyBreakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Gelir</TableHead>
                  <TableHead>Gider</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyBreakdown.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell>{formatMoney(d.income)}</TableCell>
                    <TableCell>{formatMoney(d.expense)}</TableCell>
                    <TableCell>{formatMoney(d.income - d.expense)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
