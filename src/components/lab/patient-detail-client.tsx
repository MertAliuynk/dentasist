"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { formatMoney, LAB_TREATMENT_STATUS_LABEL } from "@/lib/lab/labels";
import { AddStageDialog } from "@/components/lab/add-stage-dialog";
import { AddTreatmentDialog } from "@/components/lab/add-treatment-dialog";
import { FeedbackDialog } from "@/components/lab/feedback-dialog";

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

export function LabPatientDetailClient({ patientId }: { patientId: string }) {
  const { data: me } = trpc.user.me.useQuery();
  const { data: patient } = trpc.lab.patient.getById.useQuery({ id: patientId });
  const utils = trpc.useUtils();

  const [addTreatmentOpen, setAddTreatmentOpen] = useState(false);
  const [stageDialogFor, setStageDialogFor] = useState<string | null>(null);
  const [feedbackDialogFor, setFeedbackDialogFor] = useState<string | null>(null);

  const finish = trpc.lab.treatment.finish.useMutation({
    onSuccess: () => {
      toast.success("Tedavi tamamlandı olarak işaretlendi.");
      utils.lab.patient.getById.invalidate();
      utils.lab.treatment.list.invalidate();
    },
    onError: (e) => toastError(e),
  });

  if (!patient || !me) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  const roles = me.memberships.map((m) => m.role);
  const isOwnHekim = me.id === patient.doctor.user.id;
  const isTeknisyenOrPatron = roles.includes("TEKNISYEN") || roles.includes("PATRON");

  return (
    <div className="mx-auto w-full flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{patient.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {patient.klinik.name} · Hekim: {patient.doctor.user.name}
          </p>
        </div>
        {isOwnHekim && <Button onClick={() => setAddTreatmentOpen(true)}>Yeni İş Ekle</Button>}
      </div>

      {patient.note && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{patient.note}</CardContent>
        </Card>
      )}

      {patient.treatments.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Henüz iş eklenmemiş.</p>
      ) : (
        patient.treatments.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{t.labTreatmentType.name}</CardTitle>
                <CardDescription>
                  {t.toothColor ? `${t.toothColor.name} · ` : ""}
                  {formatMoney(t.price)}
                </CardDescription>
              </div>
              <Badge variant={t.status === "TAMAMLANDI" ? "secondary" : "outline"}>
                {LAB_TREATMENT_STATUS_LABEL[t.status]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Aşamalar</p>
                <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {t.stages.map((s) => (
                    <div key={s.id} className="p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.stageCatalog.name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(s.dueDate)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.addedByUser.name}</p>
                      {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {t.status === "DEVAM_EDIYOR" && (isOwnHekim || isTeknisyenOrPatron) && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStageDialogFor(t.id)}>
                    Aşama Ekle
                  </Button>
                  {isTeknisyenOrPatron && (
                    <Button size="sm" disabled={finish.isPending} onClick={() => finish.mutate({ labTreatmentId: t.id })}>
                      Bitim Yap
                    </Button>
                  )}
                </div>
              )}

              {t.status === "TAMAMLANDI" && isOwnHekim && (
                <Button size="sm" variant="outline" onClick={() => setFeedbackDialogFor(t.id)}>
                  Geri Bildirim Ver
                </Button>
              )}

              {t.feedback.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Geri Bildirimler</p>
                  {t.feedback.map((f) => (
                    <p key={f.id} className="rounded-md bg-muted/50 p-2 text-sm">
                      {f.message}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <AddTreatmentDialog labPatientId={patient.id} open={addTreatmentOpen} onOpenChange={setAddTreatmentOpen} />
      {stageDialogFor && (
        <AddStageDialog
          labTreatmentId={stageDialogFor}
          open={!!stageDialogFor}
          onOpenChange={(open) => !open && setStageDialogFor(null)}
        />
      )}
      {feedbackDialogFor && (
        <FeedbackDialog
          labTreatmentId={feedbackDialogFor}
          open={!!feedbackDialogFor}
          onOpenChange={(open) => !open && setFeedbackDialogFor(null)}
        />
      )}
    </div>
  );
}
