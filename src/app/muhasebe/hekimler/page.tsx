"use client";

import Link from "next/link";
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

export default function DoctorsFinancialListPage() {
  const { data: doctors, isLoading } = trpc.doctor.list.useQuery();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hekimler</CardTitle>
          <CardDescription>Bir hekime tıklayınca detaylı finansal sayfası açılır.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !doctors || doctors.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz hekim eklenmemiş.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Şube</TableHead>
                  <TableHead>Hakediş Oranı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/muhasebe/hekimler/${d.id}`} className="hover:underline">
                        {d.title ? `${d.title} ` : ""}
                        {d.user.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.branch.name}</TableCell>
                    <TableCell className="text-muted-foreground">%{Number(d.commissionRate)}</TableCell>
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
