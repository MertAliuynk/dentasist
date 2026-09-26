"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformTrpc } from "@/lib/platform-trpc/client";
import {
  DaysLeftText,
  SubscriptionBadge,
  fmtDate,
  fmtDateTime,
  fmtRelative,
} from "@/components/platform/platform-format";

const FILTERS = [
  { value: "ALL", label: "Tümü" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "TRIAL", label: "Deneme" },
  { value: "EXPIRING", label: "7 Günde Bitecek" },
  { value: "EXPIRED", label: "Süresi Dolmuş" },
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "PENDING_PAYMENT", label: "Ödeme Bekliyor" },
  { value: "CANCELED", label: "Kapatılan" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function OrganizationsList() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (FILTERS.find((f) => f.value === params.get("filtre"))?.value ?? "ALL") as Filter;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>(initial);
  const { data, isLoading } = platformTrpc.organization.list.useQuery({ search: search || undefined, filter });

  const changeFilter = (f: Filter) => {
    setFilter(f);
    router.replace(f === "ALL" ? "/admin/organizasyonlar" : `/admin/organizasyonlar?filtre=${f}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klinikler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Klinik adı, e-posta veya telefon ile ara…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? "default" : "outline"}
                onClick={() => changeFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Klinik</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead>Son İşlem</TableHead>
                    <TableHead className="text-right">Kullanıcı / Hasta</TableHead>
                    <TableHead>Kayıt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((org) => (
                    <TableRow
                      key={org.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/organizasyonlar/${org.id}`)}
                    >
                      <TableCell>
                        <Link
                          href={`/admin/organizasyonlar/${org.id}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {org.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {org.owner ? `${org.owner.name} · ${org.owner.email}` : "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{org.subscription?.plan.name ?? "—"}</TableCell>
                      <TableCell>
                        <SubscriptionBadge sub={org.subscription} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {org.subscription?.currentPeriodEnd ? (
                          <>
                            <p>{fmtDate(org.subscription.currentPeriodEnd)}</p>
                            <DaysLeftText end={org.subscription.currentPeriodEnd} />
                          </>
                        ) : (
                          <DaysLeftText end={null} />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={fmtDateTime(org.lastActivityAt)}>
                        {fmtRelative(org.lastActivityAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {org._count.users} / {org._count.patients}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(org.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformOrganizationsPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <OrganizationsList />
    </Suspense>
  );
}
