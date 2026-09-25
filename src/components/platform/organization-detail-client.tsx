"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Copy, KeyRound, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { platformTrpc } from "@/lib/platform-trpc/client";
import { SUBSCRIPTION_STATUS_LABEL } from "@/lib/subscription-access";
import {
  DaysLeftText,
  MODULE_LABEL,
  PLATFORM_ACTION_LABEL,
  SubscriptionBadge,
  fmtDate,
  fmtDateTime,
  fmtRelative,
} from "@/components/platform/platform-format";
import type { DetailTab } from "@/components/platform/detail-tabs";
import type { inferRouterOutputs } from "@trpc/server";
import type { PlatformAppRouter } from "@/server/trpc/platform-routers/_app";

const STATUS_OPTIONS = (["ACTIVE", "TRIAL", "PAST_DUE", "PENDING_PAYMENT", "CANCELED"] as const).map((value) => ({
  value,
  label: SUBSCRIPTION_STATUS_LABEL[value],
}));
type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

const MODULES = ["DENTAL", "MUHASEBE", "LABORATUVAR"] as const;
type ModuleValue = (typeof MODULES)[number];

const ROLE_LABEL: Record<string, string> = {
  PATRON: "Patron",
  SUBE_YONETICISI: "Şube Yöneticisi",
  DOKTOR: "Doktor",
  SEKRETER: "Sekreter",
  TEKNISYEN: "Teknisyen",
};


export function OrganizationDetailClient({
  organizationId,
  role,
  initialTab,
  initialOnlyErrors,
}: {
  organizationId: string;
  role: string;
  initialTab: DetailTab;
  initialOnlyErrors: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>(initialTab);
  // Set when "İşlemleri gör" is clicked on a user, to pre-filter the log tab.
  const [logUserId, setLogUserId] = useState<string>("");
  const { data, isLoading } = platformTrpc.organization.summary.useQuery({ id: organizationId });
  const canManage = role === "OWNER" || role === "DEVELOPER";

  const changeTab = (next: DetailTab) => {
    setTab(next);
    router.replace(`/admin/organizasyonlar/${organizationId}?sekme=${next}`, { scroll: false });
  };

  if (isLoading) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!data) return <p className="py-24 text-center text-sm text-muted-foreground">Bulunamadı.</p>;

  const { organization } = data;
  const sub = organization.subscription;
  const owner = data.owners[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link href="/admin/organizasyonlar" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Klinikler
      </Link>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {organization.name}
              <SubscriptionBadge sub={sub} />
            </CardTitle>
            <CardDescription className="space-x-2">
              <span>{sub?.plan.name ?? "Plan yok"}</span>
              <span>·</span>
              <span>Bitiş: {sub?.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : "Süresiz"}</span>
              {sub?.currentPeriodEnd && (
                <>
                  <span>·</span>
                  <DaysLeftText end={sub.currentPeriodEnd} />
                </>
              )}
            </CardDescription>
            {owner && (
              <p className="text-sm text-muted-foreground">
                Sahibi: <span className="text-foreground">{owner.name}</span> · {owner.email}
                {owner.phone ? ` · ${owner.phone}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
            <span>Son işlem: {fmtRelative(data.lastActivityAt)}</span>
            <span>
              Son giriş: {data.lastLogin ? `${fmtRelative(data.lastLogin.at)} (${data.lastLogin.userName})` : "hiç"}
            </span>
            {data.errors7d > 0 && (
              <button className="text-destructive hover:underline" onClick={() => changeTab("kayitlar")}>
                Son 7 günde {data.errors7d} hata
              </button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={(v) => changeTab(v as DetailTab)}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="genel">Genel</TabsTrigger>
            <TabsTrigger value="uyelik">Üyelik</TabsTrigger>
            <TabsTrigger value="kullanicilar">Kullanıcılar</TabsTrigger>
            <TabsTrigger value="kayitlar">İşlem Kayıtları</TabsTrigger>
            <TabsTrigger value="gecmis">Üyelik Geçmişi</TabsTrigger>
            <TabsTrigger value="hastalar">Hastalar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="genel">
          <GeneralTab data={data} />
        </TabsContent>
        <TabsContent value="uyelik">
          <SubscriptionTab organizationId={organizationId} sub={sub} canManage={canManage} />
        </TabsContent>
        <TabsContent value="kullanicilar">
          <UsersTab
            organizationId={organizationId}
            canManage={canManage}
            onShowActivity={(userId) => {
              setLogUserId(userId);
              changeTab("kayitlar");
            }}
          />
        </TabsContent>
        <TabsContent value="kayitlar">
          <ActivityTab
            organizationId={organizationId}
            initialOnlyErrors={initialOnlyErrors}
            userId={logUserId}
            onUserChange={setLogUserId}
          />
        </TabsContent>
        <TabsContent value="gecmis">
          <HistoryTab organizationId={organizationId} />
        </TabsContent>
        <TabsContent value="hastalar">
          <PatientsTab organizationId={organizationId} hasAccess={data.hasSensitiveAccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------

type SummaryData = inferRouterOutputs<PlatformAppRouter>["organization"]["summary"];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function GeneralTab({ data }: { data: SummaryData }) {
  const org = data.organization;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Şube", value: org._count.branches },
          { label: "Kullanıcı", value: org._count.users },
          { label: "Doktor", value: org._count.doctors },
          { label: "Hasta", value: org._count.patients },
          { label: "Randevu", value: org._count.appointments },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-3 text-sm">
            <p className="text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">İşletme Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Kısa ad" value={`/${org.slug}`} />
            <InfoRow label="Telefon" value={org.phone} />
            <InfoRow label="Adres" value={org.address} />
            <InfoRow label="Vergi No / Dairesi" value={org.taxNumber ? `${org.taxNumber} / ${org.taxOffice ?? "—"}` : null} />
            <InfoRow label="Fatura e-postası" value={org.billingEmail} />
            <InfoRow label="Kayıt tarihi" value={fmtDateTime(org.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yetkililer ve Şubeler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-border">
              {data.owners.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Patron hesabı yok.</p>
              ) : (
                data.owners.map((o) => (
                  <div key={o.id} className="py-1.5 text-sm">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.email}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {org.branches.map((b) => (
                <Badge key={b.id} variant="outline">
                  {b.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Sub = SummaryData["organization"]["subscription"];

function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function SubscriptionTab({ organizationId, sub, canManage }: { organizationId: string; sub: Sub; canManage: boolean }) {
  const utils = platformTrpc.useUtils();
  const { data: plans } = platformTrpc.plan.list.useQuery();

  const [planId, setPlanId] = useState(sub?.planId ?? "");
  const [status, setStatus] = useState<StatusValue>((sub?.status as StatusValue) ?? "TRIAL");
  const [endDate, setEndDate] = useState(toDateInput(sub?.currentPeriodEnd));
  const [openEnded, setOpenEnded] = useState(!!sub && !sub.currentPeriodEnd);
  const [modules, setModules] = useState<Set<ModuleValue>>(
    new Set((sub?.entitlements.filter((e) => e.active).map((e) => e.module) as ModuleValue[]) ?? ["DENTAL"]),
  );
  const [note, setNote] = useState(sub?.adminNote ?? "");
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const refresh = () => {
    utils.organization.summary.invalidate({ id: organizationId });
    utils.organization.history.invalidate({ organizationId });
    utils.organization.list.invalidate();
    utils.organization.stats.invalidate();
  };

  const assign = platformTrpc.organization.assignSubscription.useMutation({
    onSuccess: () => {
      toast.success("Üyelik kaydedildi.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const adjust = platformTrpc.organization.adjustPeriod.useMutation({
    onSuccess: (res, vars) => {
      toast.success(`${vars.days > 0 ? "Uzatıldı" : "Kısaltıldı"} — yeni bitiş: ${fmtDate(res.currentPeriodEnd)}`);
      setEndDate(toDateInput(res.currentPeriodEnd));
      setOpenEnded(false);
      setCustomDays("");
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const setSubStatus = platformTrpc.organization.setStatus.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(vars.status === "CANCELED" ? "Üyelik kapatıldı." : "Üyelik açıldı.");
      setStatus(vars.status);
      setConfirmClose(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const saveNote = platformTrpc.organization.updateNote.useMutation({
    onSuccess: () => {
      toast.success("Not kaydedildi.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const selectedPlan = plans?.find((p) => p.id === planId);
  const busy = assign.isPending || adjust.isPending || setSubStatus.isPending;
  const isClosed = sub?.status === "CANCELED";

  const applyPlanModules = (id: string) => {
    setPlanId(id);
    const plan = plans?.find((p) => p.id === id);
    if (plan) setModules(new Set(plan.modules as ModuleValue[]));
  };

  const submitAssign = () => {
    if (!planId) return toast.error("Plan seçin.");
    if (!openEnded && !endDate) return toast.error("Bitiş tarihi seçin veya 'Süresiz' işaretleyin.");
    assign.mutate({
      organizationId,
      planId,
      status,
      currentPeriodEnd: openEnded ? null : new Date(`${endDate}T23:59:59`).toISOString(),
      modules: [...modules],
      adminNote: note,
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sub ? "Üyeliği Düzenle" : "Üyelik Ata"}</CardTitle>
          <CardDescription>Plan, durum, bitiş tarihi ve açık modülleri tek seferde ayarlayın.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={(v) => applyPlanModules(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Plan seçin">
                    {(value: string) => plans?.find((p) => p.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {!p.isActive && " (pasif)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlan && (
                <p className="text-xs text-muted-foreground">
                  {(selectedPlan.priceMonthly / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}/ay
                  {selectedPlan.maxBranches ? ` · ${selectedPlan.maxBranches} şube` : ""}
                  {selectedPlan.maxUsers ? ` · ${selectedPlan.maxUsers} kullanıcı` : ""}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Durum</Label>
              <Select value={status} onValueChange={(v) => setStatus((v as StatusValue) ?? "ACTIVE")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => STATUS_OPTIONS.find((s) => s.value === value)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bitiş Tarihi</Label>
              <Input type="date" value={endDate} disabled={openEnded} onChange={(e) => setEndDate(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={openEnded} onCheckedChange={setOpenEnded} />
                Süresiz (bitiş tarihi yok)
              </label>
            </div>
            <div className="space-y-2">
              <Label>Modüller</Label>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={modules.has(m) ? "default" : "outline"}
                    onClick={() =>
                      setModules((prev) => {
                        const next = new Set(prev);
                        if (next.has(m)) next.delete(m);
                        else next.add(m);
                        return next;
                      })
                    }
                  >
                    {MODULE_LABEL[m]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dahili Not</Label>
            <Textarea
              rows={3}
              placeholder="Örn. Havale ile 3 aylık ödeme alındı, 15.10'da tekrar aranacak…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Sadece platform ekibi görür, klinik görmez.</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={submitAssign}>
                {sub ? "Kaydet" : "Üyelik Ata"}
              </Button>
              {sub && (
                <Button
                  variant="outline"
                  disabled={saveNote.isPending || note === (sub.adminNote ?? "")}
                  onClick={() => saveNote.mutate({ organizationId, adminNote: note })}
                >
                  Sadece Notu Kaydet
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {sub && canManage && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uzat / Kısalt</CardTitle>
              <CardDescription>
                Mevcut bitiş: {sub.currentPeriodEnd ? fmtDate(sub.currentPeriodEnd) : "Süresiz"}. Süresi geçmişse uzatma bugünden sayılır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {[7, 14, 30, 90, 180, 365].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => adjust.mutate({ organizationId, days: d, reason: reason || undefined })}
                  >
                    +{d >= 365 ? "1 yıl" : `${d} gün`}
                  </Button>
                ))}
                {[-1, -7].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busy || !sub.currentPeriodEnd}
                    onClick={() => adjust.mutate({ organizationId, days: d, reason: reason || undefined })}
                  >
                    {d} gün
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Gün (örn. 45 veya -10)"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={busy || !customDays || Number(customDays) === 0}
                  onClick={() => adjust.mutate({ organizationId, days: Math.trunc(Number(customDays)), reason: reason || undefined })}
                >
                  Uygula
                </Button>
              </div>
              <Input placeholder="Sebep (opsiyonel, geçmişe yazılır)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </CardContent>
          </Card>

          <Card className={isClosed ? "" : "border-destructive/40"}>
            <CardHeader>
              <CardTitle className="text-base">{isClosed ? "Üyeliği Aç" : "Üyeliği Kapat"}</CardTitle>
              <CardDescription>
                {isClosed
                  ? "Klinik tekrar giriş yapıp çalışabilir hale gelir."
                  : "Klinik modüllere erişemez (en geç 5 dk içinde). Veriler silinmez."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isClosed ? (
                <Button disabled={busy} onClick={() => setSubStatus.mutate({ organizationId, status: "ACTIVE", reason: reason || undefined })}>
                  Aktif Olarak Aç
                </Button>
              ) : !confirmClose ? (
                <Button variant="destructive" disabled={busy} onClick={() => setConfirmClose(true)}>
                  Üyeliği Kapat
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Emin misiniz?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => setSubStatus.mutate({ organizationId, status: "CANCELED", reason: reason || undefined })}
                  >
                    Evet, kapat
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                    Vazgeç
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {sub.discountCode && (
            <p className="px-1 text-xs text-muted-foreground">Kayıtta kullanılan indirim kodu: {sub.discountCode.code}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function UsersTab({
  organizationId,
  canManage,
  onShowActivity,
}: {
  organizationId: string;
  canManage: boolean;
  onShowActivity: (userId: string) => void;
}) {
  const utils = platformTrpc.useUtils();
  const { data: users, isLoading } = platformTrpc.organization.staffList.useQuery({ organizationId });
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const setActive = platformTrpc.organization.staffSetActive.useMutation({
    onSuccess: () => {
      toast.success("Hesap durumu güncellendi.");
      utils.organization.staffList.invalidate({ organizationId });
    },
    onError: (e) => toast.error(e.message),
  });
  const resetPassword = platformTrpc.organization.staffResetPassword.useMutation({
    onSuccess: (res) => {
      setConfirmResetId(null);
      setResetResult(res);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kullanıcılar</CardTitle>
        <CardDescription>Kliniğin personel hesapları. Şifre sıfırlama geçici bir şifre üretir.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !users || users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {u.name}
                    <Badge variant={u.deletedAt ? "outline" : "secondary"}>{u.deletedAt ? "Pasif" : "Aktif"}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""} ·{" "}
                    {u.memberships
                      .map((m) => `${ROLE_LABEL[m.role] ?? m.role}${m.branch ? ` (${m.branch.name})` : ""}`)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onShowActivity(u.id)}>
                    İşlemleri
                  </Button>
                  {canManage &&
                    (confirmResetId === u.id ? (
                      <>
                        <Button size="sm" variant="secondary" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate({ userId: u.id })}>
                          Evet, sıfırla
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmResetId(null)}>
                          Vazgeç
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmResetId(u.id)}>
                        <KeyRound className="size-3.5" /> Şifre Sıfırla
                      </Button>
                    ))}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ userId: u.id, active: !!u.deletedAt })}
                    >
                      {u.deletedAt ? "Aktifleştir" : "Devre Dışı Bırak"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeni Geçici Şifre</DialogTitle>
            <DialogDescription>
              {resetResult?.email} için. Bu şifre bir daha gösterilmeyecek — kullanıcıya iletin ve girişten sonra değiştirmesini söyleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
            <code className="flex-1 text-lg tracking-wider">{resetResult?.password}</code>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Kopyala"
              onClick={() => {
                navigator.clipboard.writeText(resetResult?.password ?? "");
                toast.success("Kopyalandı.");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------

// Human-readable rendering of tRPC paths ("patient.create" → "Hasta · Ekle")
// — unknown segments fall through as-is so nothing is hidden.
const PATH_SECTION: Record<string, string> = {
  auth: "Giriş",
  patient: "Hasta",
  patientNote: "Hasta Notu",
  patientXray: "Röntgen",
  patientConsentForm: "Onam Formu",
  appointment: "Randevu",
  appointmentBlock: "Saat Kapama",
  treatment: "Tedavi",
  treatmentType: "Tedavi Türü",
  treatmentCategory: "Tedavi Kategorisi",
  favoriteTreatmentType: "Favori Tedavi",
  paymentPlan: "Ödeme Planı",
  cashRegister: "Kasa",
  doctor: "Hekim",
  branch: "Şube",
  room: "Oda",
  user: "Kullanıcı",
  staffAdmin: "Personel Yönetimi",
  organization: "Klinik Ayarları",
  followUp: "Geri Dönüş",
  expenseCategory: "Gider Kategorisi",
  messageTemplate: "Mesaj Şablonu",
  supportTicket: "Destek Talebi",
  stock: "Stok",
  lab: "Laboratuvar",
  reportsDental: "Dental Rapor",
  reportsMuhasebe: "Muhasebe Rapor",
};
const PATH_ACTION: Record<string, string> = {
  login: "Oturum Açma",
  create: "Ekle",
  update: "Güncelle",
  delete: "Sil",
  remove: "Sil",
  list: "Liste",
  get: "Görüntüle",
  byId: "Görüntüle",
  updateStatus: "Durum Değiştir",
  activate: "İşleme Al",
};

function describePath(path: string) {
  const parts = path.split(".");
  const section = PATH_SECTION[parts[0]] ?? parts[0];
  const rest = parts.slice(1).map((p) => PATH_ACTION[p] ?? p);
  return [section, ...rest].join(" · ");
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActivityTab({
  organizationId,
  initialOnlyErrors,
  userId,
  onUserChange,
}: {
  organizationId: string;
  initialOnlyErrors: boolean;
  userId: string;
  onUserChange: (id: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(initialOnlyErrors);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: users } = platformTrpc.organization.staffList.useQuery({ organizationId });

  const queryInput = useMemo(
    () => ({
      organizationId,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      userId: userId || undefined,
      onlyErrors,
      search: search || undefined,
      limit: 100,
    }),
    [organizationId, from, to, userId, onlyErrors, search],
  );

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, refetch } =
    platformTrpc.organization.activity.useInfiniteQuery(queryInput, {
      getNextPageParam: (last) => last.nextCursor,
    });
  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  const setRange = (hours: number | "today") => {
    const now = new Date();
    const start = hours === "today" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - hours * 3600_000);
    setFrom(toLocalInput(start));
    setTo("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">İşlem Kayıtları</CardTitle>
          <CardDescription>
            Kliniğin yaptığı her kayıt/güncelleme/silme, aldığı her hata ve giriş denemeleri. Satıra tıklayınca gönderilen veri ve hata detayı açılır.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Yenile
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bitiş</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kullanıcı</Label>
            <Select value={userId || "ALL"} onValueChange={(v) => onUserChange(!v || v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(value: string) => (value === "ALL" ? "Tüm kullanıcılar" : users?.find((u) => u.id === value)?.name)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm kullanıcılar</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ara</Label>
            <Input placeholder="İşlem, hata mesajı…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="outline" onClick={() => setRange(1)}>Son 1 saat</Button>
          <Button size="xs" variant="outline" onClick={() => setRange("today")}>Bugün</Button>
          <Button size="xs" variant="outline" onClick={() => setRange(24 * 7)}>Son 7 gün</Button>
          <Button size="xs" variant="ghost" onClick={() => { setFrom(""); setTo(""); setSearch(""); onUserChange(""); }}>
            Filtreleri temizle
          </Button>
          <label className="ml-auto flex items-center gap-2 text-sm">
            <Switch checked={onlyErrors} onCheckedChange={setOnlyErrors} />
            Sadece hatalar
          </label>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Bu filtrelere uyan kayıt yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {logs.map((log) => {
              const open = expanded === log.id;
              return (
                <div key={log.id} className={log.ok ? "" : "bg-destructive/5"}>
                  <button
                    className="grid w-full grid-cols-[auto_1fr] items-start gap-x-3 px-3 py-2 text-left text-sm hover:bg-accent/50 sm:grid-cols-[9.5rem_1fr_auto]"
                    onClick={() => setExpanded(open ? null : log.id)}
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
                    <span className="min-w-0">
                      <span className="font-medium">{describePath(log.path)}</span>
                      <span className="text-muted-foreground"> · {log.userName ?? "—"}</span>
                      {!log.ok && log.errorMessage && (
                        <span className="block truncate text-xs text-destructive">{log.errorMessage}</span>
                      )}
                    </span>
                    <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                      {log.durationMs != null && <span className="text-xs tabular-nums text-muted-foreground">{log.durationMs} ms</span>}
                      <Badge variant={log.ok ? "secondary" : "destructive"}>{log.ok ? "Başarılı" : log.errorCode ?? "Hata"}</Badge>
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
                      <p>
                        <span className="text-muted-foreground">Teknik ad:</span> <code>{log.path}</code> ·{" "}
                        <span className="text-muted-foreground">Tür:</span> {log.kind} · <span className="text-muted-foreground">IP:</span> {log.ip ?? "—"}
                      </p>
                      {log.errorMessage && (
                        <p className="whitespace-pre-wrap text-destructive">{log.errorMessage}</p>
                      )}
                      {log.input != null && (
                        <pre className="max-h-72 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
                          {JSON.stringify(log.input, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {hasNextPage && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetching}>
              Daha Eski Kayıtlar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function describeDiff(action: string, diff: unknown): string | null {
  if (!diff || typeof diff !== "object") return null;
  const d = diff as Record<string, unknown>;
  const date = (v: unknown) => (typeof v === "string" ? fmtDate(v) : "Süresiz");
  const status = (v: unknown) => SUBSCRIPTION_STATUS_LABEL[v as keyof typeof SUBSCRIPTION_STATUS_LABEL] ?? String(v);
  switch (action) {
    case "org.subscription_extended":
    case "org.subscription_shortened":
      return `${d.days as number > 0 ? "+" : ""}${d.days} gün · ${date(d.before)} → ${date(d.after)}${d.reason ? ` · "${d.reason}"` : ""}`;
    case "org.subscription_status_changed":
      return `${status(d.before)} → ${status(d.after)}${d.reason ? ` · "${d.reason}"` : ""}`;
    case "org.subscription_assigned": {
      const after = d.after as Record<string, unknown> | undefined;
      if (!after) return null;
      const mods = (after.modules as string[] | undefined)?.map((m) => MODULE_LABEL[m] ?? m).join(", ");
      return `${after.planName} · ${status(after.status)} · Bitiş: ${date(after.currentPeriodEnd)} · ${mods}`;
    }
    case "org.staff_account_toggled":
      return `${d.email ?? ""} → ${d.active ? "aktif" : "pasif"}`;
    case "org.staff_password_reset":
      return String(d.email ?? "");
    default:
      return null;
  }
}

function HistoryTab({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = platformTrpc.organization.history.useQuery({ organizationId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Üyelik Geçmişi</CardTitle>
        <CardDescription>Bu klinik üzerinde platform ekibinin yaptığı her işlem.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz işlem yapılmamış.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {data.map((log) => {
              const detail = describeDiff(log.action, log.diff);
              return (
                <div key={log.id} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{PLATFORM_ACTION_LABEL[log.action] ?? log.action}</span>
                      <span className="text-muted-foreground"> · {log.actor.name}</span>
                    </p>
                    {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(log.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PatientsTab({ organizationId, hasAccess }: { organizationId: string; hasAccess: boolean }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [enabled, setEnabled] = useState(false);
  // Every fetch is audit-logged server-side, so don't fire one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const peek = platformTrpc.organization.sensitivePeek.useQuery(
    { id: organizationId, search: debounced },
    { enabled: enabled && hasAccess },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hastalar</CardTitle>
        <CardDescription>
          {hasAccess
            ? "Hasta verisi hassastır — her görüntüleme üyelik geçmişine kaydedilir."
            : "Bu klinik için hasta verisi erişiminiz yok."}
        </CardDescription>
      </CardHeader>
      {hasAccess && (
        <CardContent className="space-y-4">
          {!enabled ? (
            <Button variant="outline" onClick={() => setEnabled(true)}>
              Hasta Listesini Göster
            </Button>
          ) : (
            <>
              <Input placeholder="Ad veya telefon ile ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {peek.data && (
                <div className="flex flex-col divide-y divide-border text-sm">
                  <p className="py-1 text-xs text-muted-foreground">
                    Toplam {peek.data.totalPatients} hasta, ilk 50 gösteriliyor.
                  </p>
                  {peek.data.patients.map((p) => (
                    <div key={p.id} className="flex justify-between gap-2 py-1.5">
                      <span>{p.fullName}</span>
                      <span className="text-muted-foreground">
                        {p.phone} · {p.branch.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
