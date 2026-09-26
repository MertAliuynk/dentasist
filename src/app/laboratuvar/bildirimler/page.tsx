"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export default function LabNotificationsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data } = trpc.lab.notification.list.useQuery();

  const markRead = trpc.lab.notification.markRead.useMutation({
    onSuccess: () => utils.lab.notification.list.invalidate(),
  });
  const markAllRead = trpc.lab.notification.markAllRead.useMutation({
    onSuccess: () => utils.lab.notification.list.invalidate(),
  });

  return (
    <div className="mx-auto w-full flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bildirimler</h1>
          <p className="text-sm text-muted-foreground">Aşama ve tedavi güncellemeleri.</p>
        </div>
        <Button variant="outline" size="sm" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          Tümünü Okundu İşaretle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Bildirimler</CardTitle>
          <CardDescription>{data?.length ?? 0} kayıt.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flex w-full items-start justify-between gap-3 py-3 text-left text-sm hover:bg-accent ${!n.readAt ? "font-medium" : "text-muted-foreground"}`}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate({ id: n.id });
                    router.push(`/laboratuvar/hastalarim/${n.labTreatment.labPatientId}`);
                  }}
                >
                  <span>
                    <span className="block">{n.message}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
