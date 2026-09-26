"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export default function MuhasebePatientListPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = trpc.patient.listForMuhasebe.useQuery({ search });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hastalar</CardTitle>
          <CardDescription>
            Ad soyad, telefon, hekim, kalan tutar ve ödeme tarihleriyle hasta listesi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Hasta ara…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz hasta kaydı bulunmuyor.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Hekim</TableHead>
                  <TableHead>Kalan Tutar</TableHead>
                  <TableHead>Son Ödeme</TableHead>
                  <TableHead>Sonraki Ödeme</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/muhasebe/hastalar/${p.id}`} className="hover:underline">
                        {p.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{p.doctorName ?? "—"}</TableCell>
                    <TableCell>{formatMoney(p.remaining)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.lastPaymentDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.nextPaymentDate)}</TableCell>
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
