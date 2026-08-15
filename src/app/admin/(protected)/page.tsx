import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(date);
}

export default async function PlatformDashboardPage() {
  const [totalOrgs, activeSubs, pastDue, recentOrgs] = await Promise.all([
    db.organization.count(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.subscription.count({ where: { status: "PAST_DUE" } }),
    db.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { subscription: { include: { plan: true } } },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Toplam Klinik</CardDescription>
            <CardTitle className="text-2xl">{totalOrgs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Aktif Abonelik</CardDescription>
            <CardTitle className="text-2xl">{activeSubs}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ödemesi Gecikmiş</CardDescription>
            <CardTitle className="text-2xl text-destructive">{pastDue}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Kaydolan Klinikler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            {recentOrgs.map((org) => (
              <Link
                key={org.id}
                href={`/admin/organizasyonlar/${org.id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:text-foreground"
              >
                <span className="font-medium">{org.name}</span>
                <span className="text-muted-foreground">
                  {org.subscription?.plan.name ?? "—"} · {formatDate(org.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
