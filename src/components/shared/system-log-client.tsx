"use client";

import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

const ACTION_LABEL: Record<string, string> = {
  "cash_entry.deleted": "Kasa kaydı silindi",
  "patient.deleted": "Hasta silindi",
  "patient.created": "Hasta eklendi",
  "treatment.deleted": "Tedavi silindi",
  "appointment.status_changed": "Randevu durumu değiştirildi",
  "installment.amount_edited": "Taksit tutarı düzenlendi",
  "payment_plan.activated": "Ödeme planı işleme alındı",
  "staff.created": "Personel eklendi",
  "organization.settings_updated": "Ayarlar güncellendi",
};

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export function SystemLogClient() {
  const { data, isLoading, fetchNextPage, hasNextPage } = trpc.auditLog.list.useInfiniteQuery(
    { limit: 50 },
    { getNextPageParam: (last) => last.nextCursor },
  );

  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" />
            Sistem Kayıtları
          </CardTitle>
          <CardDescription>Ekibinizin yaptığı hassas işlemlerin kaydı.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-border">
                {logs.map((log) => (
                  <div key={log.id} className="py-2.5 text-sm">
                    <p>
                      <span className="font-medium">{log.actor.name}</span>{" "}
                      <span className="text-muted-foreground">{ACTION_LABEL[log.action] ?? log.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt)} · {log.entityType}
                    </p>
                  </div>
                ))}
              </div>
              {hasNextPage && (
                <div className="pt-3 text-center">
                  <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
                    Daha Fazla Yükle
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
