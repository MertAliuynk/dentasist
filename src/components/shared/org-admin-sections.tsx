"use client";

import { useState } from "react";
import { toast } from "sonner";
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

const ROLE_OPTIONS = [
  { value: "DOKTOR", label: "Doktor" },
  { value: "SEKRETER", label: "Sekreter" },
  { value: "SUBE_YONETICISI", label: "Şube Yöneticisi" },
] as const;

/** Şube ekleme — Patron-only, shared by Dental and Muhasebe Yönetim pages. */
export function BranchSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const { data: branches } = trpc.branch.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.branch.create.useMutation({
    onSuccess: () => {
      toast.success("Şube eklendi.");
      utils.branch.list.invalidate();
      setOpen(false);
      setName("");
      setAddress("");
      setPhone("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Şubeler</CardTitle>
          <CardDescription>Klinik şubelerinizi yönetin.</CardDescription>
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

/** Kullanıcı (personel) oluşturma — shared by Dental and Muhasebe Yönetim
 * pages. Editing an existing account's role/permissions/status lives in
 * StaffAdminClient's StaffDirectory table, not here. */
export function StaffCreateSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("DOKTOR");
  const [branchId, setBranchId] = useState("");
  const [title, setTitle] = useState("");
  const [commissionRate, setCommissionRate] = useState("");

  const { data: branches } = trpc.branch.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.user.createStaff.useMutation({
    onSuccess: () => {
      toast.success("Kullanıcı eklendi.");
      utils.user.listStaff.invalidate();
      utils.staffAdmin.listStaff.invalidate();
      utils.doctor.list.invalidate();
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setTitle("");
      setCommissionRate("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Kullanıcı Oluştur</CardTitle>
          <CardDescription>Doktor, sekreter veya şube yöneticisi hesabı ekleyin.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Kullanıcı Ekle
        </Button>
      </CardHeader>

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
                  <SelectValue>
                    {(value: string) => ROLE_OPTIONS.find((r) => r.value === value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {role === "DOKTOR" && (
              <>
                <div className="space-y-2">
                  <Label>Unvan (opsiyonel)</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dt., Op. Dr. …" />
                </div>
                <div className="space-y-2">
                  <Label>Hakediş Oranı (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || !email.trim() || password.length < 8 || !branchId || create.isPending}
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  email: email.trim(),
                  password,
                  role: role as "DOKTOR" | "SEKRETER" | "SUBE_YONETICISI",
                  branchId,
                  title: title || undefined,
                  commissionRate: commissionRate ? Number(commissionRate) : undefined,
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
