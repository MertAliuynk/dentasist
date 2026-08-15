"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformTrpc } from "@/lib/platform-trpc/client";

const STATUS_OPTIONS = [
  { value: "PENDING_PAYMENT", label: "Ödeme Bekliyor" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Gecikmiş" },
  { value: "CANCELED", label: "İptal" },
  { value: "TRIAL", label: "Deneme" },
] as const;

const MODULES = ["DENTAL", "MUHASEBE"] as const;

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
}: {
  organizationId: string;
  role: string;
}) {
  const utils = platformTrpc.useUtils();
  const { data, isLoading } = platformTrpc.organization.summary.useQuery({ id: organizationId });
  const { data: grants } = platformTrpc.grant.listForOrg.useQuery({ organizationId });
  const { data: staff } = platformTrpc.staff.list.useQuery(undefined, { enabled: role === "OWNER" });
  const { data: plans } = platformTrpc.plan.list.useQuery();
  const { data: orgStaff } = platformTrpc.organization.staffList.useQuery({ organizationId });

  const [status, setStatus] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [grantToId, setGrantToId] = useState("");
  const [grantHours, setGrantHours] = useState("24");
  const [peekSearch, setPeekSearch] = useState("");
  const [peekEnabled, setPeekEnabled] = useState(false);

  const canManage = role === "OWNER" || role === "DEVELOPER";

  const updateSub = platformTrpc.organization.updateSubscription.useMutation({
    onSuccess: () => {
      toast.success("Abonelik güncellendi.");
      utils.organization.summary.invalidate({ id: organizationId });
    },
    onError: (e) => toast.error(e.message),
  });

  const issueGrant = platformTrpc.grant.issue.useMutation({
    onSuccess: () => {
      toast.success("Geçici erişim verildi.");
      utils.grant.listForOrg.invalidate({ organizationId });
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeGrant = platformTrpc.grant.revoke.useMutation({
    onSuccess: () => {
      toast.success("Erişim iptal edildi.");
      utils.grant.listForOrg.invalidate({ organizationId });
    },
    onError: (e) => toast.error(e.message),
  });

  const setStaffActive = platformTrpc.organization.staffSetActive.useMutation({
    onSuccess: () => {
      toast.success("Hesap durumu güncellendi.");
      utils.organization.staffList.invalidate({ organizationId });
    },
    onError: (e) => toast.error(e.message),
  });

  const peek = platformTrpc.organization.sensitivePeek.useQuery(
    { id: organizationId, search: peekSearch },
    { enabled: peekEnabled },
  );

  if (isLoading) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!data) return <p className="py-24 text-center text-sm text-muted-foreground">Bulunamadı.</p>;

  const { organization, hasSensitiveAccess } = data;
  const activeModules = new Set(
    organization.subscription?.entitlements.filter((e) => e.active).map((e) => e.module) ?? [],
  );
  const effectiveStatus = status || organization.subscription?.status || "";
  const effectiveModules = modules.size > 0 ? modules : activeModules;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{organization.name}</CardTitle>
          <CardDescription>/{organization.slug}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Şube", value: organization._count.branches },
            { label: "Kullanıcı", value: organization._count.users },
            { label: "Doktor", value: organization._count.doctors },
            { label: "Hasta", value: organization._count.patients },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-border p-3 text-sm">
              <p className="text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abonelik</CardTitle>
          <CardDescription>
            Plan: {organization.subscription?.plan.name ?? "—"}
            {organization.subscription?.discountCode && (
              <span> · İndirim kodu: {organization.subscription.discountCode.code}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Durum</p>
              <Select value={effectiveStatus} onValueChange={(v) => setStatus(v ?? "")}>
                <SelectTrigger className="w-48">
                  <SelectValue>
                    {(value: string) => STATUS_OPTIONS.find((s) => s.value === value)?.label}
                  </SelectValue>
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
              <p className="text-sm font-medium">Plan</p>
              <Select value={planId || organization.subscription?.planId || ""} onValueChange={(v) => setPlanId(v ?? "")}>
                <SelectTrigger className="w-48">
                  <SelectValue>{(value: string) => plans?.find((p) => p.id === value)?.name}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Modüller</p>
              <div className="flex gap-2">
                {MODULES.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={effectiveModules.has(m) ? "default" : "outline"}
                    disabled={!canManage}
                    onClick={() =>
                      setModules((prev) => {
                        const next = new Set(prev.size > 0 ? prev : activeModules);
                        if (next.has(m)) next.delete(m);
                        else next.add(m);
                        return next;
                      })
                    }
                  >
                    {m === "DENTAL" ? "Dental" : "Muhasebe"}
                  </Button>
                ))}
              </div>
            </div>
            {canManage && (
              <Button
                disabled={updateSub.isPending}
                onClick={() =>
                  updateSub.mutate({
                    organizationId,
                    status: (status || undefined) as never,
                    modules: [...effectiveModules] as never,
                    planId: planId || undefined,
                  })
                }
              >
                Kaydet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personel</CardTitle>
          <CardDescription>Bu kliniğin kendi hesapları.</CardDescription>
        </CardHeader>
        <CardContent>
          {!orgStaff || orgStaff.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {orgStaff.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.email} · {s.memberships.map((m) => ROLE_LABEL[m.role] ?? m.role).join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.deletedAt ? "outline" : "secondary"}>{s.deletedAt ? "Pasif" : "Aktif"}</Badge>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setStaffActive.isPending}
                        onClick={() => setStaffActive.mutate({ userId: s.id, active: !!s.deletedAt })}
                      >
                        {s.deletedAt ? "Aktifleştir" : "Devre Dışı Bırak"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hassas Veriler</CardTitle>
          <CardDescription>
            {hasSensitiveAccess
              ? "Bu klinik için hasta arama erişiminiz var."
              : "Bu klinik için hassas veri erişiminiz yok. Owner/Developer'dan geçici erişim isteyin."}
          </CardDescription>
        </CardHeader>
        {hasSensitiveAccess && (
          <CardContent className="space-y-4">
            {!peekEnabled ? (
              <Button variant="outline" onClick={() => setPeekEnabled(true)}>
                Hasta Ara
              </Button>
            ) : (
              <>
                <Input
                  placeholder="Hasta ara…"
                  value={peekSearch}
                  onChange={(e) => setPeekSearch(e.target.value)}
                />
                {peek.data && (
                  <div className="flex flex-col divide-y divide-border text-sm">
                    <p className="py-1 text-xs text-muted-foreground">
                      Toplam {peek.data.totalPatients} hasta, ilk 50 gösteriliyor.
                    </p>
                    {peek.data.patients.map((p) => (
                      <div key={p.id} className="flex justify-between py-1.5">
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

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geçici Destek Erişimi</CardTitle>
            <CardDescription>Bir destek temsilcisine bu klinik için süreli erişim verin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Temsilci</p>
                <Select value={grantToId} onValueChange={(v) => setGrantToId(v ?? "")}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Seçin">
                      {(value: string) => staff?.find((s) => s.id === value)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {staff
                      ?.filter((s) => s.role === "SUPPORT")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Süre (saat)</p>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  className="w-24"
                  value={grantHours}
                  onChange={(e) => setGrantHours(e.target.value)}
                />
              </div>
              <Button
                disabled={!grantToId || issueGrant.isPending}
                onClick={() =>
                  issueGrant.mutate({ organizationId, grantedToId: grantToId, hours: Number(grantHours) })
                }
              >
                Erişim Ver
              </Button>
            </div>

            <div className="flex flex-col divide-y divide-border">
              {grants?.map((g) => {
                const active = new Date(g.expiresAt) > new Date();
                return (
                  <div key={g.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {g.grantedTo.name} · {g.grantedBy.name} tarafından ·{" "}
                      {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(
                        new Date(g.expiresAt),
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={active ? "secondary" : "outline"}>{active ? "Aktif" : "Süresi Doldu"}</Badge>
                      {active && (
                        <Button variant="ghost" size="sm" onClick={() => revokeGrant.mutate({ id: g.id })}>
                          İptal Et
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
