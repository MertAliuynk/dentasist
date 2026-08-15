"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { CurrencyWidget } from "@/components/shared/currency-widget";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Planlandı",
  ARRIVED: "Geldi",
};

function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function treatmentLocationLabel(t: { toothNumber: number | null; jaw: string | null }) {
  if (t.toothNumber != null) return `Diş ${t.toothNumber}`;
  if (t.jaw) return t.jaw === "UST" ? "Üst Çene" : "Alt Çene";
  return null;
}

export default function DentalHomePage() {
  const [search, setSearch] = useState("");
  const [completeTreatmentId, setCompleteTreatmentId] = useState("");
  const utils = trpc.useUtils();

  const { data: searchData, isFetching: searching } = trpc.patient.list.useQuery(
    { search, limit: 8 },
    { enabled: search.trim().length > 0 },
  );

  const { data: todaySummary } = trpc.appointment.todaySummary.useQuery();
  const { data: nextUp } = trpc.appointment.nextUpcoming.useQuery();
  const primary = nextUp?.[0];

  const { data: approvedTreatments } = trpc.treatment.listApprovedForPatient.useQuery(
    { patientId: primary?.patient.id ?? "" },
    { enabled: !!primary },
  );

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: () => {
      utils.appointment.nextUpcoming.invalidate();
      utils.appointment.todaySummary.invalidate();
      setCompleteTreatmentId("");
      toast.success("Randevu güncellendi.");
    },
    onError: (e) => toast.error(e.message),
  });

  const list = todaySummary ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Hasta Ara</CardTitle>
            <CardDescription>İsim, telefon veya TC kimlik numarasıyla arayın.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Hasta ara…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {search.trim().length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aramak için yukarıya yazmaya başlayın.
              </p>
            ) : searching ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aranıyor…</p>
            ) : searchData && searchData.patients.length > 0 ? (
              <div className="flex flex-col divide-y divide-border">
                {searchData.patients.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dental/hastalar/${p.id}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-muted-foreground">{p.phone}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Randevu Takvimim</CardTitle>
              <CardDescription>Bugünün özeti</CardDescription>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Bugün için planlanmış randevu yok.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {list.map((a) => (
                    <Link
                      key={a.id}
                      href={`/dental/hastalar/${a.patient.id}`}
                      className="flex items-center justify-between py-2 text-sm hover:text-foreground"
                    >
                      <span className="font-medium">{formatTime(a.startsAt)}</span>
                      <span className="text-muted-foreground">{a.patient.fullName}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <CurrencyWidget />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sıradaki Randevu</CardTitle>
          <CardDescription>Güncel randevu bilgileri</CardDescription>
        </CardHeader>
        <CardContent>
          {!primary ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Şu anda bekleyen bir randevunuz bulunmuyor.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/dental/hastalar/${primary.patient.id}`} className="font-medium hover:underline">
                    {primary.patient.fullName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(primary.startsAt)} · {STATUS_LABEL[primary.status] ?? primary.status}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Biten Tedavi (opsiyonel)</label>
                <Select value={completeTreatmentId} onValueChange={(v) => setCompleteTreatmentId(v ?? "")}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Bu ziyarette tamamlanan tedaviyi seçin">
                      {(value: string) => {
                        const t = approvedTreatments?.find((t) => t.id === value);
                        if (!t) return null;
                        const loc = treatmentLocationLabel(t);
                        return `${t.name}${loc ? ` · ${loc}` : ""}`;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {!approvedTreatments || approvedTreatments.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">Onaylı tedavi yok.</p>
                    ) : (
                      approvedTreatments.map((t) => {
                        const loc = treatmentLocationLabel(t);
                        return (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {loc ? ` · ${loc}` : ""}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Seçilirse, &quot;Geldi&quot;ye tıklandığında bu tedavi de otomatik tamamlanmış sayılır.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: primary.id,
                      status: "ARRIVED",
                      completeTreatmentId: completeTreatmentId || undefined,
                    })
                  }
                >
                  Geldi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: primary.id, status: "NO_SHOW" })}
                >
                  Gelmedi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ id: primary.id, status: "POSTPONED" })}
                >
                  Ertelendi
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
