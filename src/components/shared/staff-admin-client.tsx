"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import {
  ALL_CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  type Capability,
  type PermissionEffect,
} from "@/server/rbac/permissions";
import { ROLE_LABELS } from "@/lib/nav/role-labels";
import type { GlobalRole } from "@prisma/client";

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

type StaffMember = {
  id: string;
  name: string;
  email: string;
  deletedAt: Date | null;
  memberships: { role: GlobalRole; branch: { name: string } | null }[];
  doctorProfile: { id: string } | null;
  capabilityOverrides: { capability: string; effect: PermissionEffect }[];
};

function DoctorColorCell({ doctorId }: { doctorId: string }) {
  const { data: doctors } = trpc.doctor.list.useQuery();
  const doctor = doctors?.find((d) => d.id === doctorId);
  const [color, setColor] = useState(doctor?.colorHex ?? "#4F46E5");
  const utils = trpc.useUtils();
  const update = trpc.doctor.updateColor.useMutation({
    onSuccess: () => {
      toast.success("Renk güncellendi.");
      utils.doctor.list.invalidate();
    },
    onError: (e) => toastError(e),
  });

  if (!doctor) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="size-6 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        aria-label="Hekim rengi"
      />
      {color !== doctor.colorHex && (
        <Button size="sm" variant="outline" className="h-6 px-1.5 text-xs" disabled={update.isPending} onClick={() => update.mutate({ id: doctorId, colorHex: color })}>
          Kaydet
        </Button>
      )}
    </div>
  );
}

function primaryRole(staff: StaffMember): GlobalRole | null {
  return staff.memberships[0]?.role ?? null;
}

function branchNames(staff: StaffMember): string {
  const names = [...new Set(staff.memberships.map((m) => m.branch?.name).filter((n): n is string => !!n))];
  return names.length > 0 ? names.join(", ") : "Tüm şubeler";
}

function PermissionDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const role = staff ? primaryRole(staff) : null;
  const roleDefaults = useMemo(() => (role ? ROLE_CAPABILITIES[role] : []), [role]);

  const initialChecked = useMemo(() => {
    const map = new Map<Capability, boolean>();
    for (const cap of ALL_CAPABILITIES) map.set(cap, roleDefaults.includes(cap));
    for (const override of staff?.capabilityOverrides ?? []) {
      if (ALL_CAPABILITIES.includes(override.capability as Capability)) {
        map.set(override.capability as Capability, override.effect === "GRANT");
      }
    }
    return map;
  }, [staff, roleDefaults]);

  const [checked, setChecked] = useState<Map<Capability, boolean>>(initialChecked);

  // Re-sync local state whenever a different staff member is opened.
  const [openedForId, setOpenedForId] = useState<string | null>(null);
  if (staff && staff.id !== openedForId) {
    setOpenedForId(staff.id);
    setChecked(initialChecked);
  }

  const updateOverrides = trpc.staffAdmin.updateOverrides.useMutation({
    onSuccess: () => {
      toast.success("Yetkiler güncellendi.");
      utils.staffAdmin.listStaff.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toastError(e),
  });

  if (!staff) return null;

  const handleSave = () => {
    const overrides = ALL_CAPABILITIES.filter((cap) => {
      const isChecked = checked.get(cap) ?? false;
      const isDefault = roleDefaults.includes(cap);
      return isChecked !== isDefault;
    }).map((capability) => ({
      capability,
      effect: (checked.get(capability) ? "GRANT" : "REVOKE") as PermissionEffect,
    }));
    updateOverrides.mutate({ userId: staff.id, overrides });
  };

  const handleResetToRoleDefault = () => {
    const map = new Map<Capability, boolean>();
    for (const cap of ALL_CAPABILITIES) map.set(cap, roleDefaults.includes(cap));
    setChecked(map);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{staff.name} — Yetkileri Düzenle</DialogTitle>
          <DialogDescription>
            Rol: {role ? ROLE_LABELS[role] : "—"}. Rolün varsayılan yetkilerinden farklı olarak
            işaretlediğiniz her şey bu hesaba özel olarak kaydedilir.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
          {CAPABILITY_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="space-y-1.5">
                {group.capabilities.map((cap) => {
                  const isChecked = checked.get(cap) ?? false;
                  const isDefault = roleDefaults.includes(cap);
                  const isCustom = isChecked !== isDefault;
                  return (
                    <label
                      key={cap}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(value) => {
                            const next = new Map(checked);
                            next.set(cap, !!value);
                            setChecked(next);
                          }}
                        />
                        {CAPABILITY_LABELS[cap]}
                      </span>
                      {isCustom && (
                        <Badge variant="outline" className="text-[10px]">
                          Özel
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-row items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleResetToRoleDefault}>
            Rol Varsayılanına Sıfırla
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button disabled={updateOverrides.isPending} onClick={handleSave}>
              Kaydet
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BranchOverview() {
  const { data } = trpc.staffAdmin.branchOverview.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Şubeler — Genel Görünüm</CardTitle>
        <CardDescription>Tüm şubelerin doktor, personel, hasta ve işlem özeti.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Henüz şube eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Şube</TableHead>
                  <TableHead>Doktor</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Bugünkü Randevu</TableHead>
                  <TableHead>Bu Ay Gelir</TableHead>
                  <TableHead>Bu Ay Gider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell>{b.doctorCount}</TableCell>
                    <TableCell>{b.staffCount}</TableCell>
                    <TableCell>{b.patientCount}</TableCell>
                    <TableCell>{b.todayAppointments}</TableCell>
                    <TableCell>{formatMoney(b.monthIncome)}</TableCell>
                    <TableCell>{formatMoney(b.monthExpense)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffDirectory() {
  const { data: staff } = trpc.staffAdmin.listStaff.useQuery();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const setActive = trpc.staffAdmin.setStaffActive.useMutation({
    onSuccess: () => {
      toast.success("Durum güncellendi.");
      utils.staffAdmin.listStaff.invalidate();
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personel ve Yetkiler</CardTitle>
        <CardDescription>
          Tüm şubelerdeki hesaplar. Her hesabın erişimini role bağlı kalmadan tek tek düzenleyebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!staff || staff.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Henüz personel eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Şube</TableHead>
                  <TableHead>Renk</TableHead>
                  <TableHead>Özel Yetki</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => {
                  const role = primaryRole(s as StaffMember);
                  const isPatron = role === "PATRON";
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </TableCell>
                      <TableCell>{role ? ROLE_LABELS[role] : "—"}</TableCell>
                      <TableCell>{branchNames(s as StaffMember)}</TableCell>
                      <TableCell>
                        {s.doctorProfile ? <DoctorColorCell doctorId={s.doctorProfile.id} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {s.capabilityOverrides.length > 0 ? (
                          <Badge variant="outline">{s.capabilityOverrides.length} yetki</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.deletedAt ? "outline" : "secondary"}>
                          {s.deletedAt ? "Pasif" : "Aktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isPatron && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditing(s as StaffMember);
                                setDialogOpen(true);
                              }}
                            >
                              Yetkileri Düzenle
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={setActive.isPending}
                              onClick={() =>
                                setActive.mutate({ userId: s.id, active: !!s.deletedAt })
                              }
                            >
                              {s.deletedAt ? "Aktifleştir" : "Devre Dışı Bırak"}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <PermissionDialog staff={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}

export function StaffAdminClient({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Yönetim</h1>
        <p className="text-sm text-muted-foreground">
          {moduleLabel} modülünün tüm şubeleri, personeli ve yetki yapısı — yalnızca Patron rolüne açık.
        </p>
      </div>
      <BranchOverview />
      <StaffDirectory />
    </div>
  );
}
