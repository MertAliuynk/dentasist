"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function formatDate(date: string | Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(date));
}

const STATUS_LABEL: Record<string, string> = {
  TAMAMLANDI: "Tamamlandı",
  BEKLIYOR: "Bekliyor",
  GECIKMIS: "Gecikmiş",
};

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  TAMAMLANDI: "secondary",
  BEKLIYOR: "outline",
  GECIKMIS: "destructive",
};

export default function PaymentListsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const { data, isLoading } = trpc.patient.listForMuhasebe.useQuery({
    search: search || undefined,
    branchId: branchId || undefined,
    doctorId: doctorId || undefined,
    status: (status || undefined) as "TAMAMLANDI" | "BEKLIYOR" | "GECIKMIS" | undefined,
  });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ödeme Listeleri</CardTitle>
          <CardDescription>Tüm hastaların ödeme durumu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 basis-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Ara…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
              <SelectTrigger className="w-44">
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
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tüm Hekimler">
                  {(value: string) => doctors?.find((d) => d.id === value)?.user.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tüm Durumlar">
                  {(value: string) => STATUS_LABEL[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Hekim</TableHead>
                  <TableHead>Toplam Tutar</TableHead>
                  <TableHead>Ödenen</TableHead>
                  <TableHead>Kalan</TableHead>
                  <TableHead>Son Ödeme</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/muhasebe/hastalar/${p.id}`)}
                  >
                    <TableCell>
                      <Link href={`/muhasebe/hastalar/${p.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{p.doctorName ?? "—"}</TableCell>
                    <TableCell>{formatMoney(p.totalAmount)}</TableCell>
                    <TableCell>{formatMoney(p.paidAmount)}</TableCell>
                    <TableCell>{formatMoney(p.remaining)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.lastPaymentDate)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </TableCell>
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
