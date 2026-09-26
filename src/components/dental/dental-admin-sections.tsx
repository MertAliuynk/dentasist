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
import { TREATMENT_SCOPE_OPTIONS, scopeLabel } from "@/lib/dental/treatment-labels";

export function RoomSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: rooms } = trpc.room.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.room.create.useMutation({
    onSuccess: () => {
      toast.success("Oda eklendi.");
      utils.room.list.invalidate();
      setOpen(false);
      setName("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Odalar</CardTitle>
          <CardDescription>Randevu takviminde seçilebilecek odalar.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Oda Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!rooms || rooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz oda eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {rooms.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{branches?.find((b) => b.id === r.branchId)?.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Oda Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Oda Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oda 1" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || !branchId || create.isPending}
              onClick={() => create.mutate({ name: name.trim(), branchId })}
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function TreatmentCategorySection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: categories } = trpc.treatmentCategory.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.treatmentCategory.create.useMutation({
    onSuccess: () => {
      toast.success("Kategori eklendi.");
      utils.treatmentCategory.list.invalidate();
      setOpen(false);
      setName("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Tedavi Kategorileri</CardTitle>
          <CardDescription>Tedavi Ekle sayfasındaki kategori filtreleri — sıfırdan siz oluşturursunuz.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Kategori Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!categories || categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz kategori eklenmemiş.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="rounded-full border border-border px-3 py-1 text-sm">
                {c.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Kategori Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Ad</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Cerrahi" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim() })}>
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function TreatmentTypeSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope] = useState<string>("DIS_BAZLI");
  const [price, setPrice] = useState("");

  const { data: types } = trpc.treatmentType.list.useQuery();
  const { data: categories } = trpc.treatmentCategory.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.treatmentType.create.useMutation({
    onSuccess: () => {
      toast.success("Tedavi türü eklendi.");
      utils.treatmentType.list.invalidate();
      setOpen(false);
      setName("");
      setPrice("");
    },
    onError: (e) => toastError(e),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Tedavi Türleri</CardTitle>
          <CardDescription>Tedavi ekle formunda seçilebilecek katalog; fiyat burada belirlenir.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Tedavi Türü Ekle
        </Button>
      </CardHeader>
      <CardContent>
        {!types || types.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz tedavi türü eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span>{t.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t.category?.name ?? "Kategorisiz"} · {scopeLabel(t.scope)}
                  </span>
                </div>
                {t.defaultPrice != null && (
                  <span className="text-muted-foreground">
                    {new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
                      t.defaultPrice / 100,
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tedavi Türü Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ad</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori (opsiyonel)</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kategori seçin">
                    {(value: string) => categories?.find((c) => c.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!categories || categories.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  Önce yukarıdan bir tedavi kategorisi oluşturun (opsiyonel).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Kapsam</Label>
              <Select value={scope} onValueChange={(v) => setScope(v ?? "DIS_BAZLI")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => TREATMENT_SCOPE_OPTIONS.find((s) => s.value === value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_SCOPE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tutar (₺)</Label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Tedavi eklenirken bu tutar kullanılır; diş bazlı tedavilerde seçilen diş sayısıyla, çene
                bazlı tedavilerde seçilen çene sayısıyla (1 veya 2) çarpılır.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  name: name.trim(),
                  categoryId: categoryId || undefined,
                  scope: scope as "DIS_BAZLI" | "CENE_BAZLI",
                  defaultPrice: price ? Math.round(Number(price) * 100) : undefined,
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
