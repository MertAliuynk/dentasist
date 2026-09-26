"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";

function BranchSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const { data: branches } = trpc.lab.klinik.listBranches.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.klinik.createBranch.useMutation({
    onSuccess: () => {
      toast.success("Şube eklendi.");
      utils.lab.klinik.listBranches.invalidate();
      setOpen(false);
      setName("");
      setAddress("");
      setPhone("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Şubeler</CardTitle>
          <CardDescription>Laboratuvar şubelerinizi yönetin.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Şube Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!branches || branches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz şube eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {branches.map((b) => (
              <div key={b.id} className="py-2 text-sm">
                <p className="font-medium">{b.name}</p>
                {b.address && <p className="text-muted-foreground">{b.address}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Şube Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Şube Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adres (opsiyonel)</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefon (opsiyonel)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ name: name.trim(), address: address || undefined, phone: phone || undefined })}
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function KlinikSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const { data: branches } = trpc.lab.klinik.listBranches.useQuery();
  const { data: klinikler } = trpc.lab.klinik.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.klinik.create.useMutation({
    onSuccess: () => {
      toast.success("Klinik eklendi.");
      utils.lab.klinik.list.invalidate();
      setOpen(false);
      setName("");
      setPhone("");
      setAddress("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Klinikler</CardTitle>
          <CardDescription>Laboratuvarınıza iş gönderen dış klinikler.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Klinik Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!klinikler || klinikler.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz klinik eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {klinikler.map((k) => (
              <div key={k.id} className="flex items-center justify-between py-2 text-sm">
                <p className="font-medium">{k.name}</p>
                <p className="text-muted-foreground">{k.hekimler.length} hekim</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Klinik Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Klinik Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Şube seçin">
                    {(value: string) => branches?.find((b) => b.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefon (opsiyonel)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adres (opsiyonel)</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || !branchId || create.isPending}
              onClick={() =>
                create.mutate({ name: name.trim(), branchId, phone: phone || undefined, address: address || undefined })
              }
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const STAFF_ROLE_OPTIONS = [
  { value: "DOKTOR", label: "Hekim" },
  { value: "TEKNISYEN", label: "Teknisyen" },
] as const;

function StaffSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("DOKTOR");
  const [branchId, setBranchId] = useState("");
  const [klinikId, setKlinikId] = useState("");

  const { data: branches } = trpc.lab.klinik.listBranches.useQuery();
  const { data: klinikler } = trpc.lab.klinik.list.useQuery();
  const { data: staff } = trpc.lab.staff.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.staff.create.useMutation({
    onSuccess: () => {
      toast.success("Kullanıcı eklendi.");
      utils.lab.staff.list.invalidate();
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setKlinikId("");
    },
    onError: (e) => toastError(e),
  });

  const branchKlinikler = klinikler?.filter((k) => k.branchId === branchId) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Hekim ve Teknisyen</CardTitle>
          <CardDescription>Laboratuvar hesaplarını yönetin.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Kullanıcı Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!staff || staff.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz kullanıcı eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-muted-foreground">{s.email}</p>
                </div>
                <p className="text-muted-foreground">
                  {s.memberships.map((m) => STAFF_ROLE_OPTIONS.find((r) => r.value === m.role)?.label ?? m.role).join(", ")}
                  {s.doctorProfile?.klinik ? ` · ${s.doctorProfile.klinik.name}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kullanıcı Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Şifre</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "DOKTOR")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => STAFF_ROLE_OPTIONS.find((r) => r.value === value)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={branchId} onValueChange={(v) => { setBranchId(v ?? ""); setKlinikId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Şube seçin">
                    {(value: string) => branches?.find((b) => b.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "DOKTOR" && (
              <div className="space-y-2">
                <Label>Klinik</Label>
                <Select value={klinikId} onValueChange={(v) => setKlinikId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Klinik seçin">
                      {(value: string) => branchKlinikler.find((k) => k.id === value)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branchKlinikler.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={
                !name.trim() ||
                !email.trim() ||
                password.length < 8 ||
                !branchId ||
                (role === "DOKTOR" && !klinikId) ||
                create.isPending
              }
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  email: email.trim(),
                  password,
                  role: role as "DOKTOR" | "TEKNISYEN",
                  branchId,
                  klinikId: role === "DOKTOR" ? klinikId : undefined,
                })
              }
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CatalogListSection({
  title,
  description,
  items,
  onCreate,
  isPending,
  extraLabel,
}: {
  title: string;
  description: string;
  items: { id: string; name: string; extra?: string }[] | undefined;
  onCreate: (name: string, extra?: string) => void;
  isPending: boolean;
  extraLabel?: string;
}) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Ad" value={name} onChange={(e) => setName(e.target.value)} className="max-w-56" />
          {extraLabel && (
            <Input
              placeholder={extraLabel}
              type="number"
              min={0}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="max-w-40"
            />
          )}
          <Button
            size="sm"
            disabled={!name.trim() || isPending}
            onClick={() => {
              onCreate(name.trim(), extra || undefined);
              setName("");
              setExtra("");
            }}
          >
            Ekle
          </Button>
        </div>
        {!items || items.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span>{item.name}</span>
                {item.extra && <span className="text-muted-foreground">{item.extra}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TreatmentTypeSection() {
  const { data } = trpc.lab.treatmentType.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.treatmentType.create.useMutation({
    onSuccess: () => utils.lab.treatmentType.list.invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <CatalogListSection
      title="Protez / Tedavi Türleri"
      description="Hekimlerin hastaya atayacağı türler ve fiyatları."
      items={data?.map((t) => ({ id: t.id, name: t.name, extra: `${(t.price / 100).toLocaleString("tr-TR")} ₺` }))}
      isPending={create.isPending}
      extraLabel="Fiyat (₺)"
      onCreate={(name, extra) => create.mutate({ name, price: Math.round(Number(extra ?? 0) * 100) })}
    />
  );
}

function StageCatalogSection() {
  const { data } = trpc.lab.stageCatalog.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.stageCatalog.create.useMutation({
    onSuccess: () => utils.lab.stageCatalog.list.invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <CatalogListSection
      title="Aşamalar"
      description="Hekim ve teknisyenin seçebileceği aşama adları."
      items={data}
      isPending={create.isPending}
      onCreate={(name) => create.mutate({ name })}
    />
  );
}

function ToothColorSection() {
  const { data } = trpc.lab.toothColor.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.toothColor.create.useMutation({
    onSuccess: () => utils.lab.toothColor.list.invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <CatalogListSection
      title="Diş Renkleri"
      description="Protez işlerinde seçilebilecek diş renk kodları."
      items={data}
      isPending={create.isPending}
      onCreate={(name) => create.mutate({ name })}
    />
  );
}

function ExpenseCategorySection() {
  const { data } = trpc.lab.expenseCategory.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.lab.expenseCategory.create.useMutation({
    onSuccess: () => utils.lab.expenseCategory.list.invalidate(),
    onError: (e) => toastError(e),
  });

  return (
    <CatalogListSection
      title="Gider Türleri"
      description="Kasada gider girişi yaparken seçilebilecek kalemler."
      items={data}
      isPending={create.isPending}
      onCreate={(name) => create.mutate({ name })}
    />
  );
}

export default function LabSettingsPage() {
  const { data: me } = trpc.user.me.useQuery();
  const roles = me?.memberships.map((m) => m.role) ?? [];
  const canManageCatalog = hasCapability(roles, "lab:catalog:manage", me?.capabilityOverrides);

  return (
    <div className="mx-auto w-full flex max-w-3xl flex-col gap-4">
      <BranchSection />
      <KlinikSection />
      <StaffSection />
      {canManageCatalog && (
        <>
          <TreatmentTypeSection />
          <StageCatalogSection />
          <ToothColorSection />
          <ExpenseCategorySection />
        </>
      )}
    </div>
  );
}
