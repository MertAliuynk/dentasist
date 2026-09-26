"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { CurrencyWidget } from "@/components/shared/currency-widget";
import { AppointmentLegend } from "@/components/dental/appointment-legend";
import { APPT_VISUAL_LABEL, apptVisual } from "@/lib/dental/appointment-visual";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";

type NextItem = inferRouterOutputs<AppRouter>["appointment"]["nextUpcoming"][number];

function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function treatmentLocationLabel(t: { toothNumber: number | null; jaw: string | null }) {
  if (t.toothNumber != null) return `Diş ${t.toothNumber}`;
  if (t.jaw) return t.jaw === "UST" ? "Üst Çene" : "Alt Çene";
  return null;
}

function minutesFromNow(d: string | Date) {
  return Math.round((new Date(d).getTime() - Date.now()) / 60000);
}

function WhenText({ startsAt }: { startsAt: string | Date }) {
  const m = minutesFromNow(startsAt);
  if (m < -5) return <span className="font-medium text-amber-600 dark:text-amber-400">{Math.abs(m)} dk gecikti</span>;
  if (m <= 5) return <span className="font-medium text-emerald-600 dark:text-emerald-400">Şimdi</span>;
  if (m < 60) return <span>{m} dk sonra</span>;
  return <span>{Math.floor(m / 60)} sa {m % 60 ? `${m % 60} dk` : ""} sonra</span>;
}

/** One doctor's next unhandled patient, with the arrive / no-show actions. */
function NextAppointmentCard({ item }: { item: NextItem }) {
  const utils = trpc.useUtils();
  const [completeTreatmentId, setCompleteTreatmentId] = useState("");
  const { data: approvedTreatments } = trpc.treatment.listApprovedForPatient.useQuery({ patientId: item.patient.id });

  const updateStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: (_r, v) => {
      utils.appointment.nextUpcoming.invalidate();
      utils.appointment.todaySummary.invalidate();
      setCompleteTreatmentId("");
      toast.success(
        v.status === "ARRIVED" ? `${item.patient.fullName} geldi olarak işaretlendi.` : v.status === "NO_SHOW" ? "Gelmedi olarak işaretlendi." : "Randevu ertelendi.",
      );
    },
    onError: (e) => toastError(e),
  });
  const busy = updateStatus.isPending;

  return (
    <div
      className="appt appt-upcoming flex flex-col gap-3 p-3.5"
      style={{ "--appt-color": item.doctor.colorHex } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.doctor.colorHex }} />
            <span className="truncate">{item.doctor.user.name}</span>
          </p>
          <Link href={`/dental/hastalar/${item.patient.id}`} className="mt-1 block truncate text-base font-semibold hover:underline">
            {item.patient.fullName}
          </Link>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {formatTime(item.startsAt)} · <WhenText startsAt={item.startsAt} />
            {item.room && <span>· {item.room.name}</span>}
          </p>
        </div>
        {item.remainingAfter > 0 && (
          <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
            sonra {item.remainingAfter} hasta
          </span>
        )}
      </div>

      {approvedTreatments && approvedTreatments.length > 0 && (
        <Select value={completeTreatmentId} onValueChange={(v) => setCompleteTreatmentId(v ?? "")}>
          <SelectTrigger size="sm" className="w-full bg-background">
            <SelectValue placeholder="Biten tedavi (opsiyonel)">
              {(value: string) => {
                const t = approvedTreatments.find((x) => x.id === value);
                if (!t) return null;
                const loc = treatmentLocationLabel(t);
                return `${t.name}${loc ? ` · ${loc}` : ""}`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {approvedTreatments.map((t) => {
              const loc = treatmentLocationLabel(t);
              return (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {loc ? ` · ${loc}` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => updateStatus.mutate({ id: item.id, status: "ARRIVED", completeTreatmentId: completeTreatmentId || undefined })}
        >
          Geldi
        </Button>
        <Button size="sm" variant="outline" className="bg-background" disabled={busy} onClick={() => updateStatus.mutate({ id: item.id, status: "NO_SHOW" })}>
          Gelmedi
        </Button>
        <Button size="sm" variant="outline" className="bg-background" disabled={busy} onClick={() => updateStatus.mutate({ id: item.id, status: "POSTPONED" })}>
          Ertelendi
        </Button>
      </div>
    </div>
  );
}

export default function DentalHomePage() {
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);

  const { data: searchData, isFetching: searching } = trpc.patient.list.useQuery(
    { search, limit: 8 },
    { enabled: search.trim().length > 0 },
  );
  // Refresh on a timer so "gecikti" / next-patient cards stay current on a
  // dashboard left open at the front desk.
  const { data: today } = trpc.appointment.todaySummary.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: nextUp } = trpc.appointment.nextUpcoming.useQuery(undefined, { refetchInterval: 60_000 });

  const doctors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const a of today ?? []) {
      const cur = m.get(a.doctorId) ?? { id: a.doctorId, name: a.doctor.user.name, color: a.doctor.colorHex, count: 0 };
      cur.count++;
      m.set(a.doctorId, cur);
    }
    return [...m.values()];
  }, [today]);

  const list = (today ?? []).filter((a) => !doctorFilter || a.doctorId === doctorFilter);
  const counts = (today ?? []).reduce(
    (acc, a) => {
      const v = apptVisual(a.status, a.startsAt);
      if (v === "done") acc.done++;
      else if (v === "upcoming" || v === "overdue") acc.waiting++;
      else acc.other++;
      return acc;
    },
    { waiting: 0, done: 0, other: 0 },
  );

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-1 space-y-0 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Sıradaki Randevular</CardTitle>
            <CardDescription>Bugün bekleyen hastası olan her hekimin sıradaki randevusu.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!nextUp ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : nextUp.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bugün bekleyen randevu kalmadı.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {nextUp.map((item) => (
                <NextAppointmentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Randevu Takvimim</CardTitle>
                <CardDescription>
                  Bugün {today?.length ?? 0} randevu · {counts.waiting} bekleniyor · {counts.done} geldi
                  {counts.other > 0 && ` · ${counts.other} gelmedi/ertelendi`}
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dental/randevu-takvimi" />}>
                Takvimi Aç
              </Button>
            </div>
            {doctors.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <Button size="xs" variant={doctorFilter === null ? "default" : "outline"} onClick={() => setDoctorFilter(null)}>
                  Tümü
                </Button>
                {doctors.map((d) => (
                  <Button key={d.id} size="xs" variant={doctorFilter === d.id ? "default" : "outline"} onClick={() => setDoctorFilter(d.id)}>
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    {d.name} <span className="opacity-60">{d.count}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!today ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            ) : list.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Bugün için planlanmış randevu yok.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {list.map((a) => {
                  const v = apptVisual(a.status, a.startsAt);
                  return (
                    <Link
                      key={a.id}
                      href={`/dental/hastalar/${a.patient.id}`}
                      className={`appt appt-${v} flex items-center gap-3 px-3 py-2 text-sm transition-opacity hover:opacity-90`}
                      style={{ "--appt-color": a.doctor.colorHex } as React.CSSProperties}
                    >
                      <span className="w-11 shrink-0 font-mono text-sm font-semibold tabular-nums">{formatTime(a.startsAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="appt-title block truncate font-medium">{a.patient.fullName}</span>
                        <span className="flex items-center gap-1.5 text-xs opacity-80">
                          <span
                            className="size-2 shrink-0 rounded-full ring-1 ring-white/60"
                            style={{ background: a.doctor.colorHex }}
                          />
                          <span className="truncate">{a.doctor.user.name}</span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-xs opacity-80 sm:inline">{APPT_VISUAL_LABEL[v]}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {today && today.length > 0 && <AppointmentLegend className="border-t border-border pt-3" />}
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hasta Ara</CardTitle>
              <CardDescription>İsim, telefon veya TC kimlik numarasıyla arayın.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Hasta ara…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {search.trim().length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aramak için yazmaya başlayın.</p>
              ) : searching ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aranıyor…</p>
              ) : searchData && searchData.patients.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {searchData.patients.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dental/hastalar/${p.id}`}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-foreground"
                    >
                      <span className="min-w-0 truncate font-medium">{p.fullName}</span>
                      <span className="shrink-0 text-muted-foreground">{p.phone}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p>
              )}
            </CardContent>
          </Card>
          <CurrencyWidget />
        </div>
      </div>
    </div>
  );
}
