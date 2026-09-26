"use client";

import { useState } from "react";
import { Download, Filter, X, TrendingUp, TrendingDown, Scale, Wallet, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

const METHOD_LABEL: Record<string, string> = { NAKIT: "Nakit", HAVALE: "Banka Transferi", KREDI_KARTI: "Kredi Kartı" };
const TYPE_OPTIONS = [
  { value: "ALL", label: "Tümü" },
  { value: "GELIR", label: "Gelir" },
  { value: "GIDER", label: "Gider" },
] as const;
const SORT_OPTIONS = [
  { value: "desc", label: "Tarih (Yeniden Eskiye)" },
  { value: "asc", label: "Tarih (Eskiden Yeniye)" },
] as const;

type Row = {
  id: string;
  type: "GELIR" | "GIDER";
  method: "NAKIT" | "HAVALE" | "KREDI_KARTI";
  amount: number;
  entryDate: string | Date;
  description: string | null;
  branch: { name: string };
  patient: { fullName: string } | null;
  doctor: { user: { name: string } } | null;
};

function turLabel(row: Row) {
  if (row.type === "GELIR") return row.patient ? "Hasta Ödemesi" : "Klinik Geliri";
  return row.doctor ? "Doktor Gideri" : "Şube Gideri";
}

function ilgiliLabel(row: Row) {
  return row.patient?.fullName ?? row.doctor?.user.name ?? "—";
}

function toCsv(rows: Row[]) {
  const header = ["Tarih", "Tür", "Miktar", "Ödeme Tipi", "Şube", "İlgili", "Açıklama"];
  const lines = rows.map((r) =>
    [
      formatDateTime(r.entryDate),
      turLabel(r),
      (r.type === "GELIR" ? "+" : "-") + (r.amount / 100).toFixed(2),
      METHOD_LABEL[r.method],
      r.branch.name,
      ilgiliLabel(r),
      r.description ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function CrossBranchReviewPage() {
  const [start, setStart] = useState(isoDaysAgo(90));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [type, setType] = useState("ALL");
  const [branchId, setBranchId] = useState("");
  const [method, setMethod] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: branches } = trpc.branch.list.useQuery();
  const filters = {
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
    type: type === "ALL" ? undefined : (type as "GELIR" | "GIDER"),
    branchId: branchId || undefined,
    method: (method || undefined) as "NAKIT" | "HAVALE" | "KREDI_KARTI" | undefined,
    sort,
  };
  const { data } = trpc.reportsMuhasebe.transactions.useQuery({ ...filters, page, pageSize });
  const { data: branchSummary } = trpc.reportsMuhasebe.crossBranch.useQuery({ start: filters.start, end: filters.end });
  const utils = trpc.useUtils();

  function clearFilters() {
    setType("ALL");
    setBranchId("");
    setMethod("");
    setSort("desc");
    setStart(isoDaysAgo(90));
    setEnd(isoDaysAgo(0));
    setPage(0);
  }

  async function downloadCsv() {
    const rows = await utils.reportsMuhasebe.transactionsExport.fetch(filters);
    const csv = toCsv(rows as Row[]);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mali-yonetim-${start}-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const net = (data?.totals.income ?? 0) - (data?.totals.expense ?? 0);
  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Mali Yönetim</h1>
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download className="size-4" />
          CSV İndir
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> Toplam Gelir
            </CardDescription>
            <CardTitle className="text-xl text-emerald-600 dark:text-emerald-400">
              {formatMoney(data?.totals.income ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <TrendingDown className="size-3.5" /> Toplam Gider
            </CardDescription>
            <CardTitle className="text-xl text-destructive">{formatMoney(data?.totals.expense ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Scale className="size-3.5" /> Net Durum
            </CardDescription>
            <CardTitle className="text-xl">{formatMoney(net)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-3.5" /> Nakit
            </CardDescription>
            <CardTitle className="text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">
                Gelir: {formatMoney(data?.totals.byMethod.NAKIT.income ?? 0)}
              </span>
              <br />
              <span className="text-destructive">Gider: {formatMoney(data?.totals.byMethod.NAKIT.expense ?? 0)}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="size-3.5" /> Kredi Kartı
            </CardDescription>
            <CardTitle className="text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">
                Gelir: {formatMoney(data?.totals.byMethod.KREDI_KARTI.income ?? 0)}
              </span>
              <br />
              <span className="text-destructive">
                Gider: {formatMoney(data?.totals.byMethod.KREDI_KARTI.expense ?? 0)}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" /> Filtreler
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-3.5" />
            Filtreleri Temizle
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={(v) => { setType(v ?? "ALL"); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue>{(value: string) => TYPE_OPTIONS.find((t) => t.value === value)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchId} onValueChange={(v) => { setBranchId(v ?? ""); setPage(0); }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tüm Şubeler">
                {(value: string) => branches?.find((b) => b.id === value)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {branches?.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v) => { setMethod(v ?? ""); setPage(0); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tüm Ödeme Tipleri">{(value: string) => METHOD_LABEL[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(METHOD_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={start} onChange={(e) => { setStart(e.target.value); setPage(0); }} />
          <Input type="date" className="w-40" value={end} onChange={(e) => { setEnd(e.target.value); setPage(0); }} />
          <Select value={sort} onValueChange={(v) => setSort((v ?? "desc") as "asc" | "desc")}>
            <SelectTrigger className="w-52">
              <SelectValue>{(value: string) => SORT_OPTIONS.find((s) => s.value === value)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İşlem Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Tür</TableHead>
                      <TableHead>Miktar</TableHead>
                      <TableHead>Ödeme Tipi</TableHead>
                      <TableHead>Şube</TableHead>
                      <TableHead>İlgili</TableHead>
                      <TableHead>Açıklama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(r.entryDate)}</TableCell>
                        <TableCell>
                          <Badge variant={r.type === "GELIR" ? "outline" : "destructive"}>{turLabel(r as Row)}</Badge>
                        </TableCell>
                        <TableCell
                          className={r.type === "GELIR" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
                        >
                          {r.type === "GELIR" ? "+" : "-"}
                          {formatMoney(r.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{METHOD_LABEL[r.method]}</Badge>
                        </TableCell>
                        <TableCell>{r.branch.name}</TableCell>
                        <TableCell>{ilgiliLabel(r as Row)}</TableCell>
                        <TableCell className="max-w-48 truncate text-muted-foreground">
                          {r.description || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground sm:flex-row sm:justify-between">
                <span>
                  Toplam {data.total} kayıttan {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.total)} arası
                  gösteriliyor
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şube Bazlı Mali Özet</CardTitle>
        </CardHeader>
        <CardContent>
          {!branchSummary || branchSummary.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {branchSummary.map((b) => (
                <div key={b.branchId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-medium">{b.branchName}</span>
                  <span className="text-muted-foreground">
                    Gelir: <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(b.income)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Gider: <span className="text-destructive">{formatMoney(b.expense)}</span>
                  </span>
                  <span className="font-medium">Net: {formatMoney(b.income - b.expense)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
