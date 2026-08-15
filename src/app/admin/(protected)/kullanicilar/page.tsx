"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { platformTrpc } from "@/lib/platform-trpc/client";

const ROLE_OPTIONS = [
  { value: "DEVELOPER", label: "Developer" },
  { value: "SUPPORT", label: "Destek Temsilcisi" },
] as const;

export default function PlatformStaffPage() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("SUPPORT");

  const { data: staff, isLoading } = platformTrpc.staff.list.useQuery();
  const utils = platformTrpc.useUtils();

  const create = platformTrpc.staff.create.useMutation({
    onSuccess: () => {
      toast.success("Ekip üyesi eklendi.");
      utils.staff.list.invalidate();
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deactivate = platformTrpc.staff.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Hesap devre dışı bırakıldı.");
      utils.staff.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">Ekip Üyeleri</CardTitle>
            <CardDescription>Developer ve destek temsilcisi hesapları.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Üye Ekle
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {staff?.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ROLE_OPTIONS.find((r) => r.value === s.role)?.label ?? s.role}</Badge>
                    {s.role !== "OWNER" && (
                      <Button variant="ghost" size="sm" onClick={() => deactivate.mutate({ id: s.id })}>
                        Devre Dışı Bırak
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ekip Üyesi Ekle</DialogTitle>
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
              <p className="text-xs text-muted-foreground">En az 10 karakter.</p>
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "SUPPORT")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => ROLE_OPTIONS.find((r) => r.value === value)?.label}</SelectValue>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || !email.trim() || password.length < 10 || create.isPending}
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  email: email.trim(),
                  password,
                  role: role as "DEVELOPER" | "SUPPORT",
                })
              }
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
