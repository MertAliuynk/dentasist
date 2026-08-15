"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function ProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [unit, setUnit] = useState("adet");
  const [quantity, setQuantity] = useState("0");
  const [criticalLevel, setCriticalLevel] = useState("0");
  const [unitPrice, setUnitPrice] = useState("");

  const { data: branches } = trpc.branch.list.useQuery(undefined, { enabled: open });
  const { data: categories } = trpc.stock.category.list.useQuery(undefined, { enabled: open });
  const { data: suppliers } = trpc.stock.supplier.list.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  const create = trpc.stock.product.create.useMutation({
    onSuccess: () => {
      toast.success("Ürün eklendi.");
      utils.stock.product.list.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ürün Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ürün Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Birim</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="adet, kutu, ml…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategori (opsiyonel)</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seçin">
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
            </div>
            <div className="space-y-2">
              <Label>Tedarikçi (opsiyonel)</Label>
              <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seçin">
                    {(value: string) => suppliers?.find((s) => s.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Başlangıç Stoğu</Label>
              <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kritik Seviye</Label>
              <Input type="number" min={0} value={criticalLevel} onChange={(e) => setCriticalLevel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Birim Fiyat (₺)</Label>
              <Input type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!name.trim() || !branchId || create.isPending}
            onClick={() =>
              create.mutate({
                name: name.trim(),
                branchId,
                unit: unit.trim() || "adet",
                categoryId: categoryId || undefined,
                supplierId: supplierId || undefined,
                quantity: Number(quantity) || 0,
                criticalLevel: Number(criticalLevel) || 0,
                unitPrice: unitPrice ? Math.round(Number(unitPrice) * 100) : undefined,
              })
            }
          >
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  open,
  onOpenChange,
  requirePatient,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requirePatient?: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"GIRIS" | "CIKIS">(requirePatient ? "CIKIS" : "GIRIS");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientLabel, setPatientLabel] = useState("");

  const { data: products } = trpc.stock.product.list.useQuery(undefined, { enabled: open });
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: open && patientSearch.trim().length > 0 },
  );
  const utils = trpc.useUtils();

  const create = trpc.stock.movement.create.useMutation({
    onSuccess: () => {
      toast.success("Hareket kaydedildi.");
      utils.stock.movement.list.invalidate();
      utils.stock.product.list.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const product = products?.find((p) => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{requirePatient ? "Ürün Kullanımı Ekle" : "Stok Hareketi Ekle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ürün</Label>
            <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Ürün seçin">
                  {(value: string) => products?.find((p) => p.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.quantity} {p.unit} — {p.branch.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!requirePatient && (
            <div className="space-y-2">
              <Label>Hareket Türü</Label>
              <Select value={type} onValueChange={(v) => setType((v as "GIRIS" | "CIKIS") ?? "GIRIS")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: string) => (value === "GIRIS" ? "Giriş" : "Çıkış")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GIRIS">Giriş</SelectItem>
                  <SelectItem value="CIKIS">Çıkış</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Miktar {product && `(mevcut: ${product.quantity} ${product.unit})`}</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          {requirePatient && (
            <div className="space-y-2">
              <Label>Hasta</Label>
              {patientId ? (
                <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                  <span>{patientLabel}</span>
                  <Button variant="ghost" size="sm" onClick={() => setPatientId(null)}>
                    Değiştir
                  </Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Hasta ara…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                  {patientResults && patientResults.patients.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-input">
                      {patientResults.patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientLabel(p.fullName);
                          }}
                        >
                          <span>{p.fullName}</span>
                          <span className="text-muted-foreground">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!productId || !quantity || Number(quantity) < 1 || (requirePatient && !patientId) || create.isPending}
            onClick={() =>
              product &&
              create.mutate({
                productId,
                branchId: product.branchId,
                type: requirePatient ? "CIKIS" : type,
                quantity: Number(quantity),
                patientId: patientId || undefined,
                note: note || undefined,
              })
            }
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTab({ canManage }: { canManage: boolean }) {
  const [name, setName] = useState("");
  const { data: categories } = trpc.stock.category.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.stock.category.create.useMutation({
    onSuccess: () => {
      toast.success("Kategori eklendi.");
      utils.stock.category.list.invalidate();
      setName("");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.stock.category.delete.useMutation({
    onSuccess: () => {
      toast.success("Kategori silindi.");
      utils.stock.category.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kategoriler</CardTitle>
        <CardDescription>Stok ürünlerini gruplamak için kategoriler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. Sarf Malzeme, Cerrahi Alet" />
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim() })}>
              Ekle
            </Button>
          </div>
        )}
        {!categories || categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz kategori eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name}</span>
                {canManage && (
                  <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove.mutate({ id: c.id })}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuppliersTab({ canManage }: { canManage: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { data: suppliers } = trpc.stock.supplier.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.stock.supplier.create.useMutation({
    onSuccess: () => {
      toast.success("Tedarikçi eklendi.");
      utils.stock.supplier.list.invalidate();
      setName("");
      setPhone("");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.stock.supplier.delete.useMutation({
    onSuccess: () => {
      toast.success("Tedarikçi silindi.");
      utils.stock.supplier.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tedarikçiler</CardTitle>
        <CardDescription>Stok ürünlerini tedarik ettiğiniz firmalar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Firma adı" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (opsiyonel)" className="w-40" />
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate({ name: name.trim(), phone: phone || undefined })}
            >
              Ekle
            </Button>
          </div>
        )}
        {!suppliers || suppliers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz tedarikçi eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {suppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {s.name}
                  {s.phone && <span className="ml-2 text-xs text-muted-foreground">{s.phone}</span>}
                </span>
                {canManage && (
                  <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove.mutate({ id: s.id })}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsTab({ canManage }: { canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: products } = trpc.stock.product.list.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.stock.product.delete.useMutation({
    onSuccess: () => {
      toast.success("Ürün silindi.");
      utils.stock.product.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Ürünler</CardTitle>
          <CardDescription>Mevcut stok ürünleri ve miktarları.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Ürün Ekle
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!products || products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Henüz ürün eklenmemiş.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Şube</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Birim Fiyat</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const low = p.quantity <= p.criticalLevel;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.branch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.supplier?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {p.quantity} {p.unit}
                        {low && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" />
                            Kritik
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.unitPrice != null ? formatMoney(p.unitPrice) : "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove.mutate({ id: p.id })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {canManage && <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </Card>
  );
}

function MovementsTab({ onlyPatientUsage }: { onlyPatientUsage: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: movements } = trpc.stock.movement.list.useQuery({ onlyPatientUsage });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">{onlyPatientUsage ? "Ürün Kullanımları" : "Stok Hareketleri"}</CardTitle>
          <CardDescription>
            {onlyPatientUsage ? "Hastalarda kullanılan malzemeler." : "Tüm giriş ve çıkış hareketleri."}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          {onlyPatientUsage ? "Kullanım Ekle" : "Hareket Ekle"}
        </Button>
      </CardHeader>
      <CardContent>
        {!movements || movements.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Şube</TableHead>
                {onlyPatientUsage && <TableHead>Hasta</TableHead>}
                <TableHead>Not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                  <TableCell className="font-medium">{m.product.name}</TableCell>
                  <TableCell>
                    <Badge variant={m.type === "GIRIS" ? "secondary" : "outline"}>
                      {m.type === "GIRIS" ? "Giriş" : "Çıkış"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.quantity} {m.product.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.branch.name}</TableCell>
                  {onlyPatientUsage && <TableCell className="text-muted-foreground">{m.patient?.fullName ?? "—"}</TableCell>}
                  <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <MovementDialog open={dialogOpen} onOpenChange={setDialogOpen} requirePatient={onlyPatientUsage} />
    </Card>
  );
}

export function StockClient() {
  const { data: me } = trpc.user.me.useQuery();
  // Category/supplier/product management ("manage") is a step above just
  // logging stock movements/usage ("write") — doctors get the latter only,
  // so the CRUD-only tabs and add/delete controls stay hidden for them.
  const canManage = me
    ? hasCapability(me.memberships.map((m) => m.role), "dental:stock:manage", me.capabilityOverrides)
    : false;

  return (
    <div className="mx-auto max-w-6xl">
      <Tabs defaultValue="urunler">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          <TabsList className="w-max sm:w-fit">
            <TabsTrigger value="urunler">Ürünler</TabsTrigger>
            <TabsTrigger value="hareketler">Stok Hareketleri</TabsTrigger>
            <TabsTrigger value="kullanimlar">Ürün Kullanımları</TabsTrigger>
            {canManage && <TabsTrigger value="kategoriler">Kategoriler</TabsTrigger>}
            {canManage && <TabsTrigger value="tedarikciler">Tedarikçiler</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="urunler">
          <ProductsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="hareketler">
          <MovementsTab onlyPatientUsage={false} />
        </TabsContent>
        <TabsContent value="kullanimlar">
          <MovementsTab onlyPatientUsage={true} />
        </TabsContent>
        {canManage && (
          <TabsContent value="kategoriler">
            <CategoriesTab canManage={canManage} />
          </TabsContent>
        )}
        {canManage && (
          <TabsContent value="tedarikciler">
            <SuppliersTab canManage={canManage} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
