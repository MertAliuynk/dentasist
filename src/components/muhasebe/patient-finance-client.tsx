"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc/client";
import { PaymentPlanCreateDialog } from "@/components/muhasebe/payment-plan-create-dialog";
import { PaymentPlanCard } from "@/components/muhasebe/payment-plan-card";

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

const TREATMENT_STATUS_LABEL: Record<string, string> = { APPROVED: "Onaylandı", COMPLETED: "Tamamlandı" };

// Turns the dental side's approved/completed-but-unbilled treatments into a
// ready-to-activate payment plan: pick which ones to bill, the total fills
// itself in, and creating the plan links those treatments to it — no manual
// re-typing of amounts already decided on the Dental side.
function UnplannedTreatmentsCard({ patientId, branchId }: { patientId: string; branchId: string }) {
  const { data: treatments } = trpc.treatment.listUnplanned.useQuery({ patientId });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!treatments || treatments.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedTreatments = treatments.filter((t) => selected.has(t.id));
  const total = selectedTreatments.reduce((s, t) => s + (t.price ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardList className="size-4" />
          Plana Eklenmemiş Tedaviler
        </CardTitle>
        <CardDescription>
          Dental tarafında onaylanan/tamamlanan ama henüz bir ödeme planına bağlanmamış tedaviler.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col divide-y divide-border">
          {treatments.map((t) => (
            <label key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                <span>
                  {t.name}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {t.doctor.user.name} · {TREATMENT_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </span>
              </span>
              <span className="text-muted-foreground">{t.price != null ? formatMoney(t.price) : "—"}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm font-medium">Seçili Toplam: {formatMoney(total)}</p>
          <Button size="sm" disabled={selectedTreatments.length === 0} onClick={() => setDialogOpen(true)}>
            Seçililerden Ödeme Planı Oluştur
          </Button>
        </div>
      </CardContent>

      <PaymentPlanCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patientId={patientId}
        branchId={branchId}
        prefillAmount={total}
        treatmentIds={selectedTreatments.map((t) => t.id)}
      />
    </Card>
  );
}

export function PatientFinanceClient({ patientId }: { patientId: string }) {
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  const { data: summary, isLoading } = trpc.patient.getFinanceSummary.useQuery({ id: patientId });
  const { data: plans } = trpc.paymentPlan.listForPatient.useQuery({ patientId });
  const { data: notes } = trpc.patientNote.list.useQuery({ patientId });
  const utils = trpc.useUtils();

  const addNote = trpc.patientNote.create.useMutation({
    onSuccess: () => {
      toast.success("Not eklendi.");
      setNoteBody("");
      utils.patientNote.list.invalidate({ patientId });
    },
    onError: (e) => toastError(e),
  });

  if (isLoading) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!summary) return <p className="py-24 text-center text-sm text-muted-foreground">Hasta bulunamadı.</p>;

  const { patient, totalAmount, received, remaining } = summary;

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">{patient.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{patient.phone}</p>
          </div>
          <Button onClick={() => setPlanDialogOpen(true)}>
            <span>Yeni Ödeme Planı Oluştur</span>
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">SMS Gönder</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="pb-3 text-xs text-muted-foreground">Ödeme hatırlatması vb. için hastaya mesaj gönderin.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dental/sms-hizmetleri?hasta=${patientId}`} />}>
                SMS Gönder
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dental/whatsapp-hizmetleri?hasta=${patientId}`} />}>
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hasta Notları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Not ekleyin…"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={1}
              />
              <Button
                size="sm"
                disabled={!noteBody.trim() || addNote.isPending}
                onClick={() => addNote.mutate({ patientId, body: noteBody.trim() })}
              >
                Ekle
              </Button>
            </div>
            {!notes || notes.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Kayıt yok</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.slice(0, 5).map((n) => (
                  <p key={n.id} className="text-xs text-muted-foreground">
                    {n.body}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Toplam Tutar", value: totalAmount },
          { label: "Alınan Tutar", value: received },
          { label: "Kalan Tutar", value: remaining },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
              <p className="text-2xl font-semibold">{formatMoney(item.value)}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      <UnplannedTreatmentsCard patientId={patientId} branchId={patient.branchId} />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">Ödeme Planları</h2>
        {!plans || plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Bu hastaya ait bir ödeme planı bulunmuyor.
          </p>
        ) : (
          plans.map((plan) => <PaymentPlanCard key={plan.id} plan={{ ...plan, patientId }} />)
        )}
      </div>

      <PaymentPlanCreateDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        patientId={patientId}
        branchId={patient.branchId}
      />
    </div>
  );
}
