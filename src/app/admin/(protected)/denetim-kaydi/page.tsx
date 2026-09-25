"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { platformTrpc } from "@/lib/platform-trpc/client";
import { PLATFORM_ACTION_LABEL as ACTION_LABEL } from "@/components/platform/platform-format";


function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export default function PlatformAuditLogPage() {
  const { data, isLoading } = platformTrpc.auditLog.list.useQuery({ limit: 100 });

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Denetim Kaydı</CardTitle>
          <CardDescription>Platform ekibinin hassas işlemleri.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.map((log) => (
                <div key={log.id} className="py-2.5 text-sm">
                  <p>
                    <span className="font-medium">{log.actor.name}</span>{" "}
                    <span className="text-muted-foreground">{ACTION_LABEL[log.action] ?? log.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
