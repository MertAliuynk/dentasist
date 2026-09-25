"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { platformTrpc } from "@/lib/platform-trpc/client";
import { DaysLeftText, fmtDateTime, fmtRelative } from "@/components/platform/platform-format";

function Stat({ label, value, href, tone }: { label: string; value: number; href?: string; tone?: "warn" | "bad" }) {
  const color = tone === "bad" && value > 0 ? "text-destructive" : tone === "warn" && value > 0 ? "text-amber-600 dark:text-amber-400" : "";
  const body = (
    <Card className="h-full transition-colors hover:bg-accent/40">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${color}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function PlatformDashboardPage() {
  const { data, isLoading } = platformTrpc.organization.stats.useQuery(undefined, { refetchInterval: 60_000 });

  if (isLoading || !data) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  const s = data.statusCounts;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Toplam Klinik" value={data.total} href="/admin/organizasyonlar" />
        <Stat label="Aktif Üyelik" value={s.ACTIVE ?? 0} href="/admin/organizasyonlar?filtre=ACTIVE" />
        <Stat label="Deneme" value={s.TRIAL ?? 0} href="/admin/organizasyonlar?filtre=TRIAL" />
        <Stat label="Kapatılan" value={s.CANCELED ?? 0} href="/admin/organizasyonlar?filtre=CANCELED" />
        <Stat label="7 Gün İçinde Bitecek" value={data.expiring.length} href="/admin/organizasyonlar?filtre=EXPIRING" tone="warn" />
        <Stat label="Süresi Dolmuş" value={data.expired} href="/admin/organizasyonlar?filtre=EXPIRED" tone="bad" />
        <Stat label="Açık Destek Talebi" value={data.openTickets} href="/admin/destek-talepleri" tone="warn" />
        <Stat label="Son 24 Saat Hata" value={data.errors24h} tone="bad" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Yakında Bitecek Üyelikler
            </CardTitle>
            <CardDescription>Önümüzdeki 7 gün içinde süresi dolacak klinikler.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.expiring.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Yakında biten üyelik yok.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.expiring.map((org) => (
                  <Link
                    key={org.id}
                    href={`/admin/organizasyonlar/${org.id}?sekme=uyelik`}
                    className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 truncate font-medium">{org.name}</span>
                    <span className="shrink-0 text-xs">
                      {org.subscription?.plan.name} · <DaysLeftText end={org.subscription?.currentPeriodEnd} />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" />
              Son Hatalar
            </CardTitle>
            <CardDescription>Kliniklerin aldığı son hatalar — tıklayınca ilgili kaydı açar.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentErrors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Kayıtlı hata yok. 🎉</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {data.recentErrors.map((e) => (
                  <Link
                    key={e.id}
                    href={`/admin/organizasyonlar/${e.organizationId}?sekme=kayitlar&hatalar=1`}
                    className="flex flex-col gap-0.5 py-2 text-sm hover:text-foreground"
                    title={fmtDateTime(e.createdAt)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{e.organization.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtRelative(e.createdAt)}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      <code className="text-foreground">{e.path}</code> · {e.userName ?? "—"} · {e.errorMessage}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
