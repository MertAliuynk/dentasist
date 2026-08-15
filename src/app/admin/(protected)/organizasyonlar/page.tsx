"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformTrpc } from "@/lib/platform-trpc/client";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Ödeme Bekliyor",
  ACTIVE: "Aktif",
  PAST_DUE: "Gecikmiş",
  CANCELED: "İptal",
  TRIAL: "Deneme",
};

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = platformTrpc.organization.list.useQuery({ search });

  return (
    <div className="mx-auto max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organizasyonlar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Klinik ara…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klinik</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Şube</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Hasta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link href={`/admin/organizasyonlar/${org.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.subscription?.plan.name ?? "—"}</TableCell>
                    <TableCell>
                      {org.subscription ? (
                        <Badge variant={org.subscription.status === "ACTIVE" ? "secondary" : "outline"}>
                          {STATUS_LABEL[org.subscription.status] ?? org.subscription.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org._count.branches}</TableCell>
                    <TableCell className="text-muted-foreground">{org._count.users}</TableCell>
                    <TableCell className="text-muted-foreground">{org._count.patients}</TableCell>
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
