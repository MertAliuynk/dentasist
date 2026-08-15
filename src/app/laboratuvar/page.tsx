"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { formatMoney, LAB_TREATMENT_STATUS_LABEL } from "@/lib/lab/labels";

export default function LabDashboardPage() {
  const { data: me } = trpc.user.me.useQuery();
  const roles = me?.memberships.map((m) => m.role) ?? [];
  const isBroadRole = roles.includes("PATRON") || roles.includes("SUBE_YONETICISI");

  const { data: myStats } = trpc.lab.treatment.myStats.useQuery(undefined, { enabled: !!me });
  const { data: branchSummary } = trpc.lab.reports.branchSummary.useQuery(undefined, { enabled: isBroadRole });
  const { data: activeJobs } = trpc.lab.treatment.list.useQuery({ status: "DEVAM_EDIYOR" }, { enabled: !!me });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Laboratuvar</h1>
        <p className="text-sm text-muted-foreground">Genel görünüm.</p>
      </div>

      {myStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Toplam Borç</CardDescription>
              <CardTitle className="text-2xl">{formatMoney(myStats.totalDebt)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Hasta Sayısı</CardDescription>
              <CardTitle className="text-2xl">{myStats.patientCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Aktif İş</CardDescription>
              <CardTitle className="text-2xl">{myStats.activeJobCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Tamamlanan İş</CardDescription>
              <CardTitle className="text-2xl">{myStats.completedJobCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {isBroadRole && branchSummary && branchSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Şubeler</CardTitle>
            <CardDescription>Tüm şubelerin genel durumu.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {branchSummary.map((b) => (
              <div key={b.branchId} className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{b.branchName}</p>
                <p className="mt-1 text-muted-foreground">{b.doctorCount} hekim</p>
                <p className="text-muted-foreground">{b.activeJobCount} aktif iş</p>
                <p className="mt-1 font-medium">{formatMoney(b.totalDebt)} borç</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktif İşler</CardTitle>
          <CardDescription>Devam eden protez işleri.</CardDescription>
        </CardHeader>
        <CardContent>
          {!activeJobs || activeJobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aktif iş bulunmuyor.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {activeJobs.slice(0, 8).map((t) => (
                <Link
                  key={t.id}
                  href={`/laboratuvar/hastalarim/${t.labPatient.id}`}
                  className="flex items-center justify-between py-2 text-sm hover:bg-accent"
                >
                  <span>
                    {t.labPatient.fullName} — {t.labTreatmentType.name}
                  </span>
                  <span className="text-muted-foreground">
                    {LAB_TREATMENT_STATUS_LABEL[t.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
