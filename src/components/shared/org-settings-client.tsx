"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { inferRouterOutputs } from "@trpc/server";
import { Download, Gift, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/trpc/routers/_app";

type Org = inferRouterOutputs<AppRouter>["organization"]["get"];

const WEEKDAYS = [
  { key: "mon", label: "Pazartesi" },
  { key: "tue", label: "Salı" },
  { key: "wed", label: "Çarşamba" },
  { key: "thu", label: "Perşembe" },
  { key: "fri", label: "Cuma" },
  { key: "sat", label: "Cumartesi" },
  { key: "sun", label: "Pazar" },
] as const;

type DayHours = { open: string; close: string; closed: boolean };
type WorkingHours = Partial<Record<(typeof WEEKDAYS)[number]["key"], DayHours>>;

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function SaveButton({ show, pending, onClick }: { show: boolean; pending: boolean; onClick: () => void }) {
  if (!show) return null;
  return (
    <Button size="sm" disabled={pending} onClick={onClick}>
      Kaydet
    </Button>
  );
}

function GeneralSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const [name, setName] = useState(org.name);
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Genel Ayarlar</CardTitle>
        <CardDescription>Klinik/işletme adınız.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label>İşletme Adı</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
        </div>
        <SaveButton show={!readOnly && name !== org.name} pending={update.isPending} onClick={() => update.mutate({ name })} />
      </CardContent>
    </Card>
  );
}

function BusinessInfoSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const [phone, setPhone] = useState(org.phone ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [taxNumber, setTaxNumber] = useState(org.taxNumber ?? "");
  const [taxOffice, setTaxOffice] = useState(org.taxOffice ?? "");
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("İşletme bilgileri güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changed =
    phone !== (org.phone ?? "") ||
    address !== (org.address ?? "") ||
    taxNumber !== (org.taxNumber ?? "") ||
    taxOffice !== (org.taxOffice ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">İşletme Bilgileri</CardTitle>
        <CardDescription>Telefon, adres ve vergi bilgileriniz.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Vergi Numarası</Label>
            <Input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Adres</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Vergi Dairesi</Label>
            <Input value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} disabled={readOnly} />
          </div>
        </div>
        <div className="flex justify-end">
          <SaveButton
            show={!readOnly && changed}
            pending={update.isPending}
            onClick={() => update.mutate({ phone, address, taxNumber, taxOffice })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BillingInfoSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const [billingEmail, setBillingEmail] = useState(org.billingEmail ?? "");
  const [billingAddress, setBillingAddress] = useState(org.billingAddress ?? "");
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Fatura bilgileri güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changed = billingEmail !== (org.billingEmail ?? "") || billingAddress !== (org.billingAddress ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fatura Bilgileri</CardTitle>
        <CardDescription>Abonelik faturalarınızın gönderileceği bilgiler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Fatura E-postası</Label>
          <Input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <Label>Fatura Adresi</Label>
          <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} disabled={readOnly} />
        </div>
        <div className="flex justify-end">
          <SaveButton
            show={!readOnly && changed}
            pending={update.isPending}
            onClick={() => update.mutate({ billingEmail, billingAddress })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WorkingHoursSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const initial = (org.workingHours as WorkingHours | null) ?? {};
  const [hours, setHours] = useState<WorkingHours>(initial);
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Çalışma saatleri güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function setDay(key: string, patch: Partial<DayHours>) {
    setHours((prev) => ({
      ...prev,
      [key]: { open: "09:00", close: "18:00", closed: false, ...prev[key as keyof WorkingHours], ...patch },
    }));
  }

  const changed = JSON.stringify(hours) !== JSON.stringify(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Çalışma Saatleri</CardTitle>
        <CardDescription>Şubenizin haftalık çalışma saatleri.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {WEEKDAYS.map((day) => {
          const value = hours[day.key] ?? { open: "09:00", close: "18:00", closed: false };
          return (
            <div key={day.key} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-24 shrink-0">{day.label}</span>
              <Switch
                checked={!value.closed}
                onCheckedChange={(checked) => setDay(day.key, { closed: !checked })}
                disabled={readOnly}
              />
              {!value.closed ? (
                <>
                  <Input
                    type="time"
                    className="h-8 w-28"
                    value={value.open}
                    onChange={(e) => setDay(day.key, { open: e.target.value })}
                    disabled={readOnly}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    className="h-8 w-28"
                    value={value.close}
                    onChange={(e) => setDay(day.key, { close: e.target.value })}
                    disabled={readOnly}
                  />
                </>
              ) : (
                <span className="text-muted-foreground">Kapalı</span>
              )}
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <SaveButton show={!readOnly && changed} pending={update.isPending} onClick={() => update.mutate({ workingHours: hours })} />
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentSettingsSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const [duration, setDuration] = useState(String(org.appointmentDurationMinutes));
  const [buffer, setBuffer] = useState(String(org.appointmentBufferMinutes));
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Randevu ayarları güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changed = Number(duration) !== org.appointmentDurationMinutes || Number(buffer) !== org.appointmentBufferMinutes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Randevu Ayarları</CardTitle>
        <CardDescription>Yeni randevu oluştururken kullanılacak varsayılan süre ve aralar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Varsayılan Süre (dk)</Label>
            <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Randevular Arası Boşluk (dk)</Label>
            <Input type="number" min={0} max={120} value={buffer} onChange={(e) => setBuffer(e.target.value)} disabled={readOnly} />
          </div>
        </div>
        <div className="flex justify-end">
          <SaveButton
            show={!readOnly && changed}
            pending={update.isPending}
            onClick={() =>
              update.mutate({ appointmentDurationMinutes: Number(duration), appointmentBufferMinutes: Number(buffer) })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function TogglesSection({ org, readOnly }: { org: Org; readOnly: boolean }) {
  const utils = trpc.useUtils();
  const update = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Güncellendi.");
      utils.organization.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hatırlatma, Anamnez ve Onam Ayarları</CardTitle>
        <CardDescription>
          SMS hatırlatması için SMS Hizmetleri sayfasından SMS sağlayıcı hesabınızın bağlı olması gerekir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            SMS ile randevu hatırlatması gönder
            <span className="ml-2 text-xs text-muted-foreground">(SMS hesabı bağlı olmalı)</span>
          </span>
          <Switch
            checked={org.smsRemindersEnabled}
            onCheckedChange={(checked) => update.mutate({ smsRemindersEnabled: checked })}
            disabled={readOnly}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>Hasta eklerken anamnez zorunlu olsun</span>
          <Switch
            checked={org.anamnezRequired}
            onCheckedChange={(checked) => update.mutate({ anamnezRequired: checked })}
            disabled={readOnly}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>
            Tedavi onayından önce onam formu zorunlu olsun
          </span>
          <Switch
            checked={org.onamRequired}
            onCheckedChange={(checked) => update.mutate({ onamRequired: checked })}
            disabled={readOnly}
          />
        </label>
      </CardContent>
    </Card>
  );
}

function LicenseSection({ org }: { org: Org }) {
  const sub = org.subscription;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" />
          Lisans Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!sub ? (
          <p className="text-muted-foreground">Aktif abonelik bulunamadı.</p>
        ) : (
          <>
            <p>
              Plan: <span className="font-medium">{sub.plan.name}</span> · {formatMoney(sub.plan.priceMonthly)}/ay
            </p>
            <p className="flex items-center gap-2">
              Durum: <Badge variant="secondary">{sub.status}</Badge>
            </p>
            {sub.discountCode && <p className="text-muted-foreground">İndirim kodu: {sub.discountCode.code}</p>}
            <p className="text-muted-foreground">
              Modüller: {sub.entitlements.filter((e) => e.active).map((e) => e.module).join(", ") || "—"}
            </p>
            {sub.currentPeriodEnd && (
              <p className="text-muted-foreground">
                Dönem sonu: {new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(sub.currentPeriodEnd))}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UpgradeReferralSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Satın Al / Yükselt
          </CardTitle>
          <CardDescription>Planınızı yükseltin veya ek modül ekleyin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" render={<Link href="/fiyatlandirma" target="_blank" />} nativeButton={false}>
            Fiyatlandırmayı Görüntüle
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="size-4" />
            Referans Programı
          </CardTitle>
          <CardDescription>Bir kliniği davet edin, ikiniz de kazanın.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Bu bölüm yakında burada olacak.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function UserManagementSection({ yonetimHref }: { yonetimHref: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Kullanıcı Yönetimi
        </CardTitle>
        <CardDescription>Personel ekleme, rol ve yetki düzenleme artık Yönetim sayfasında.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="outline" render={<Link href={yonetimHref} />} nativeButton={false}>
          Yönetim Sayfasına Git
        </Button>
      </CardContent>
    </Card>
  );
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DataExportSection({ moduleType }: { moduleType: "dental" | "muhasebe" }) {
  const utils = trpc.useUtils();

  async function exportPatients() {
    const patients = await utils.patient.exportCsv.fetch();
    const rows = patients.map((p) => ({
      "Ad Soyad": p.fullName,
      Telefon: p.phone,
      "TC Kimlik": p.tcKimlikNo ?? "",
      Şube: p.branch.name,
      Doktor: p.primaryDoctor?.user.name ?? "",
      "Kayıt Tarihi": new Date(p.createdAt).toISOString().slice(0, 10),
    }));
    downloadCsv("hastalar.csv", toCsv(rows));
  }

  async function exportTransactions() {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 5);
    const transactions = await utils.reportsMuhasebe.transactionsExport.fetch({
      start: start.toISOString(),
      end: new Date().toISOString(),
      sort: "desc",
    });
    const rows = transactions.map((t) => ({
      Tarih: new Date(t.entryDate).toISOString().slice(0, 10),
      Tür: t.type,
      Tutar: (t.amount / 100).toFixed(2),
      "Ödeme Tipi": t.method,
      Şube: t.branch.name,
      Açıklama: t.description ?? "",
    }));
    downloadCsv("muhasebe-kayitlari.csv", toCsv(rows));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="size-4" />
          Verileri İndir
        </CardTitle>
        <CardDescription>Verilerinizi CSV olarak dışa aktarın.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {moduleType === "dental" ? (
          <Button size="sm" variant="outline" onClick={exportPatients}>
            Hastaları İndir (CSV)
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={exportTransactions}>
            Muhasebe Kayıtlarını İndir (CSV)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function OrgSettingsClient({
  moduleType,
  yonetimHref,
}: {
  moduleType: "dental" | "muhasebe";
  yonetimHref: string;
}) {
  const { data: org, isLoading } = trpc.organization.get.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const isPatron = me?.memberships.some((m) => m.role === "PATRON") ?? false;

  if (isLoading || !org) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {!isPatron && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Bu ayarları yalnızca Patron rolü değiştirebilir — aşağıdaki bilgiler salt okunur görüntüleniyor.
        </p>
      )}
      <GeneralSection org={org} readOnly={!isPatron} />
      <BusinessInfoSection org={org} readOnly={!isPatron} />
      <BillingInfoSection org={org} readOnly={!isPatron} />
      <UserManagementSection yonetimHref={yonetimHref} />
      <WorkingHoursSection org={org} readOnly={!isPatron} />
      <AppointmentSettingsSection org={org} readOnly={!isPatron} />
      <TogglesSection org={org} readOnly={!isPatron} />
      <LicenseSection org={org} />
      <UpgradeReferralSection />
      <DataExportSection moduleType={moduleType} />
    </div>
  );
}
