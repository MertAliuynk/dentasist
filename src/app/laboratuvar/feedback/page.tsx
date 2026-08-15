"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export default function LabFeedbackPage() {
  const router = useRouter();
  const { data } = trpc.lab.feedback.list.useQuery();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-sm text-muted-foreground">Tamamlanan işler için gelen geri bildirimler.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Geri Bildirimler</CardTitle>
          <CardDescription>{data?.length ?? 0} kayıt.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Henüz geri bildirim yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="flex w-full flex-col items-start gap-1 py-3 text-left text-sm hover:bg-accent"
                  onClick={() => router.push(`/laboratuvar/hastalarim/${f.labTreatment.labPatientId}`)}
                >
                  <span className="font-medium">
                    {f.labTreatment.labPatient.fullName} — {f.labTreatment.labTreatmentType.name}
                  </span>
                  <span>{f.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.author.name} · {formatDateTime(f.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
