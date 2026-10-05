"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { MoneyInput, emptyMoney, moneyResult, type MoneyValue } from "@/components/shared/money-input";
import { ExpiryBadge, REASON_META, fmtDate, moneyInput, parseMoney, toDateInput, type Reason } from "@/components/dental/stock/stock-utils";

export type ProductLite = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  supplierId: string | null;
};

function useInvalidateStock() {
  const utils = trpc.useUtils();
  return () => {
    utils.stock.product.list.invalidate();
    utils.stock.product.get.invalidate();
    utils.stock.movement.list.invalidate();
    utils.stock.summary.invalidate();
    utils.stock.reorder.invalidate();
  };
}

const NONE = "__none";

function OptionalSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; name: string }[] | undefined;
  placeholder: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(!v || v === NONE ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue>{(v: string) => (v === NONE ? placeholder : options?.find((o) => o.id === v)?.name)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options?.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Product create / edit

export type ProductForm = {
  id?: string;
  branchId?: string;
  name: string;
  code: string | null;
  brand: string | null;
  unit: string;
  categoryId: string | null;
  supplierId: string | null;
  criticalLevel: number;
  targetLevel: number | null;
  unitPrice: number | null;
  note: string | null;
};

const UNITS = ["adet", "kutu", "paket", "şişe", "tüp", "ml", "gr", "kg", "rulo", "set", "çift"];

function ProductFormBody({ initial, onClose }: { initial: ProductForm; onClose: () => void }) {
  const invalidate = useInvalidateStock();
  const [f, setF] = useState(initial);
  const [price, setPrice] = useState(moneyInput(initial.unitPrice));
  const [initialQty, setInitialQty] = useState("");
  const [initialExpiry, setInitialExpiry] = useState("");
  const [initialLot, setInitialLot] = useState("");
  const { data: branches } = trpc.branch.list.useQuery();
  const { data: categories } = trpc.stock.category.list.useQuery();
  const { data: suppliers } = trpc.stock.supplier.list.useQuery();
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const branchId = f.branchId ?? (branches?.length === 1 ? branches[0].id : undefined);

  const done = (msg: string) => {
    toast.success(msg);
    invalidate();
    onClose();
  };
  const create = trpc.stock.product.create.useMutation({ onSuccess: () => done("Ürün eklendi."), onError: (e) => toastError(e) });
  const update = trpc.stock.product.update.useMutation({ onSuccess: () => done("Ürün güncellendi."), onError: (e) => toastError(e) });

  const payload = {
    name: f.name.trim(),
    code: f.code?.trim() || null,
    brand: f.brand?.trim() || null,
    unit: f.unit.trim() || "adet",
    categoryId: f.categoryId,
    supplierId: f.supplierId,
    criticalLevel: f.criticalLevel,
    targetLevel: f.targetLevel,
    unitPrice: parseMoney(price),
    note: f.note?.trim() || null,
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{f.id ? "Ürünü Düzenle" : "Yeni Ürün"}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1.5">
            <Label>Ürün Adı *</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ör. Kompozit Dolgu A2" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Ürün Kodu / Barkod</Label>
            <Input value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Marka</Label>
            <Input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <OptionalSelect value={f.categoryId} onChange={(v) => set("categoryId", v)} options={categories} placeholder="Kategorisiz" />
          </div>
          <div className="space-y-1.5">
            <Label>Tedarikçi</Label>
            <OptionalSelect value={f.supplierId} onChange={(v) => set("supplierId", v)} options={suppliers} placeholder="Seçilmedi" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Birim</Label>
            <Input list="stock-units" value={f.unit} onChange={(e) => set("unit", e.target.value)} />
            <datalist id="stock-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Kritik Seviye</Label>
            <Input type="number" min={0} value={f.criticalLevel} onChange={(e) => set("criticalLevel", Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label>İdeal Stok</Label>
            <Input
              type="number"
              min={0}
              placeholder="opsiyonel"
              value={f.targetLevel ?? ""}
              onChange={(e) => set("targetLevel", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Birim Fiyat (₺)</Label>
            <Input inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Stok kritik seviyeye düşünce uyarı verilir; sipariş listesi ideal stoğa tamamlayacak miktarı önerir.
        </p>

        {!f.id && (
          <div className="space-y-3 rounded-md border border-dashed border-border p-3">
            {branches && branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Şube *</Label>
                <OptionalSelect value={f.branchId ?? null} onChange={(v) => set("branchId", v ?? undefined)} options={branches} placeholder="Şube seçin" />
              </div>
            )}
            <p className="text-sm font-medium">Başlangıç stoğu (opsiyonel)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Miktar</Label>
                <Input type="number" min={0} value={initialQty} onChange={(e) => setInitialQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Son Kullanma Tarihi</Label>
                <Input type="date" value={initialExpiry} onChange={(e) => setInitialExpiry(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lot / Parti No</Label>
                <Input value={initialLot} onChange={(e) => setInitialLot(e.target.value)} />
              </div>
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Not</Label>
          <Textarea rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="Saklama koşulu, kullanım notu…" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          disabled={!payload.name || create.isPending || update.isPending || (!f.id && !branchId)}
          onClick={() =>
            f.id
              ? update.mutate({ id: f.id, ...payload })
              : create.mutate({
                  branchId: branchId!,
                  ...payload,
                  initialQuantity: Math.max(0, Number(initialQty) || 0),
                  initialExpiry: initialExpiry || null,
                  initialLotNo: initialLot || null,
                })
          }
        >
          {f.id ? "Kaydet" : "Ürünü Ekle"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ProductFormDialog({ value, onClose }: { value: ProductForm | null; onClose: () => void }) {
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">{value && <ProductFormBody key={value.id ?? "new"} initial={value} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Stock in (receive)

function ReceiveBody({ product, onClose }: { product: ProductLite; onClose: () => void }) {
  const invalidate = useInvalidateStock();
  const { data: suppliers } = trpc.stock.supplier.list.useQuery();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState<MoneyValue>(emptyMoney(moneyInput(product.unitPrice)));
  const [lot, setLot] = useState("");
  const [expiry, setExpiry] = useState("");
  const [supplierId, setSupplierId] = useState<string | null>(product.supplierId);
  const [invoice, setInvoice] = useState("");
  const [note, setNote] = useState("");
  const receive = trpc.stock.movement.receive.useMutation({
    onSuccess: () => {
      toast.success(`${qty} ${product.unit} stoğa girildi.`);
      invalidate();
      onClose();
    },
    onError: (e) => toastError(e),
  });
  const n = Number(qty) || 0;
  const costResult = moneyResult(cost);
  const unitCost = costResult.tlKurus;
  const foreignCost =
    costResult.currency !== "TRY" && costResult.foreignAmount != null && costResult.exchangeRate
      ? { currency: costResult.currency, unitCost: costResult.foreignAmount, rate: costResult.exchangeRate }
      : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stok Girişi</DialogTitle>
        <DialogDescription>
          {product.name} · mevcut {product.quantity} {product.unit}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Gelen Miktar ({product.unit}) *</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5 sm:row-span-2">
            <Label>Birim Alış Fiyatı</Label>
            <MoneyInput value={cost} onChange={setCost} side="selling" />
          </div>
          <div className="space-y-1.5">
            <Label>Son Kullanma Tarihi</Label>
            <Input type="date" value={expiry} min={toDateInput(new Date())} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Lot / Parti No</Label>
            <Input value={lot} onChange={(e) => setLot(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tedarikçi</Label>
            <OptionalSelect value={supplierId} onChange={setSupplierId} options={suppliers} placeholder="Seçilmedi" />
          </div>
          <div className="space-y-1.5">
            <Label>Fatura / İrsaliye No</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
        </div>
        <Input placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
        {n > 0 && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
            Yeni stok: <b>{product.quantity + n} {product.unit}</b>
            {unitCost != null && <> · Tutar: <b>{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format((n * unitCost) / 100)}</b></>}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          disabled={n < 1 || receive.isPending}
          onClick={() =>
            receive.mutate({
              productId: product.id,
              quantity: n,
              unitCost,
              foreignCost: foreignCost as { currency: "USD" | "EUR" | "GBP"; unitCost: number; rate: number } | null,
              lotNo: lot || null,
              expiryDate: expiry || null,
              supplierId,
              invoiceNo: invoice || null,
              note: note || null,
            })
          }
        >
          Stoğa Gir
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stock out (consume)

const OUT_REASONS: Reason[] = ["KULLANIM", "HASTA_KULLANIMI", "FIRE", "SKT_IMHA", "IADE"];

function PatientPicker({ value, onChange }: { value: { id: string; fullName: string } | null; onChange: (p: { id: string; fullName: string } | null) => void }) {
  const [search, setSearch] = useState("");
  const { data } = trpc.patient.list.useQuery({ search, limit: 6 }, { enabled: search.trim().length > 1 && !value });
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input px-3 py-1.5 text-sm">
        {value.fullName}
        <Button variant="ghost" size="xs" onClick={() => onChange(null)}>
          Değiştir
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input placeholder="Hasta adı veya telefon…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {data && data.patients.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-input">
          {data.patients.map((p) => (
            <button key={p.id} type="button" className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-accent" onClick={() => onChange(p)}>
              <span>{p.fullName}</span>
              <span className="text-muted-foreground">{p.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mirrors the server's FEFO order: lots arrive already sorted by expiry. */
function fefoPlan<T extends { quantity: number }>(lots: T[], quantity: number) {
  const out: (T & { take: number })[] = [];
  let left = quantity;
  for (const l of lots) {
    if (left <= 0) break;
    const take = Math.min(l.quantity, left);
    out.push({ ...l, take });
    left -= take;
  }
  return out;
}

function ConsumeBody({ product, defaultReason, onClose }: { product: ProductLite; defaultReason: Reason; onClose: () => void }) {
  const invalidate = useInvalidateStock();
  const { data: detail } = trpc.stock.product.get.useQuery({ id: product.id });
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<Reason>(defaultReason);
  const [lotId, setLotId] = useState<string | null>(null);
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [note, setNote] = useState("");
  const consume = trpc.stock.movement.consume.useMutation({
    onSuccess: () => {
      toast.success(`${qty} ${product.unit} stoktan düşüldü.`);
      invalidate();
      onClose();
    },
    onError: (e) => toastError(e),
  });

  const n = Number(qty) || 0;
  const lots = detail?.lots ?? [];
  const available = lotId ? (lots.find((l) => l.id === lotId)?.quantity ?? 0) : product.quantity;

  // FEFO preview: which lots this will come from.
  const plan = fefoPlan(lotId ? lots.filter((l) => l.id === lotId) : lots, n);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stok Çıkışı</DialogTitle>
        <DialogDescription>
          {product.name} · mevcut {product.quantity} {product.unit}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Çıkış Sebebi</Label>
          <div className="flex flex-wrap gap-1.5">
            {OUT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${reason === r ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground"}`}
              >
                {REASON_META[r].label}
              </button>
            ))}
          </div>
        </div>
        {reason === "HASTA_KULLANIMI" && (
          <div className="space-y-1.5">
            <Label>Hasta *</Label>
            <PatientPicker value={patient} onChange={setPatient} />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Miktar ({product.unit}) *</Label>
            <Input type="number" min={1} max={available} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Parti</Label>
            <Select value={lotId ?? "AUTO"} onValueChange={(v) => setLotId(!v || v === "AUTO" ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) => {
                    if (v === "AUTO") return "Otomatik (SKT'si en yakın önce)";
                    const l = lots.find((x) => x.id === v);
                    return l ? `${l.lotNo ?? "Lotsuz"} · ${l.quantity} · SKT ${fmtDate(l.expiryDate)}` : "";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Otomatik (SKT&apos;si en yakın önce)</SelectItem>
                {lots.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.lotNo ?? "Lotsuz"} · {l.quantity} {product.unit} · SKT {fmtDate(l.expiryDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Input placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
        {n > 0 && (
          <div className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
            {n > available ? (
              <p className="text-destructive">Yetersiz stok — en fazla {available} {product.unit} çıkabilir.</p>
            ) : (
              <>
                <p>
                  Kalan stok: <b>{product.quantity - n} {product.unit}</b>
                </p>
                {plan.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Düşülecek: {plan.map((p) => `${p.take} (${p.lotNo ?? "lotsuz"}${p.expiryDate ? `, SKT ${fmtDate(p.expiryDate)}` : ""})`).join(" + ")}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          variant={reason === "FIRE" || reason === "SKT_IMHA" ? "destructive" : "default"}
          disabled={n < 1 || n > available || consume.isPending || (reason === "HASTA_KULLANIMI" && !patient)}
          onClick={() =>
            consume.mutate({ productId: product.id, quantity: n, reason: reason as never, lotId, patientId: patient?.id ?? null, note: note || null })
          }
        >
          Stoktan Düş
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stock count

function CountBody({ product, onClose }: { product: ProductLite; onClose: () => void }) {
  const invalidate = useInvalidateStock();
  const [counted, setCounted] = useState(String(product.quantity));
  const [note, setNote] = useState("");
  const count = trpc.stock.movement.count.useMutation({
    onSuccess: (r) => {
      toast.success(r.diff === 0 ? "Sayım sistemle aynı, değişiklik yok." : `Sayım kaydedildi (${r.diff > 0 ? "+" : ""}${r.diff} ${product.unit}).`);
      invalidate();
      onClose();
    },
    onError: (e) => toastError(e),
  });
  const n = counted === "" ? NaN : Number(counted);
  const diff = Number.isFinite(n) ? n - product.quantity : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stok Sayımı</DialogTitle>
        <DialogDescription>
          {product.name} — rafta saydığınız gerçek miktarı girin; fark sayım düzeltmesi olarak kaydedilir.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">Sistemdeki</p>
            <p className="text-xl font-semibold tabular-nums">
              {product.quantity} <span className="text-sm font-normal">{product.unit}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Sayılan</Label>
            <Input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
          </div>
        </div>
        {Number.isFinite(n) && diff !== 0 && (
          <p className={`rounded-md px-3 py-2 text-sm ${diff < 0 ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
            Fark: <b>{diff > 0 ? "+" : ""}{diff} {product.unit}</b> {diff < 0 ? "(eksik — SKT'si en yakın partiden düşülür)" : "(fazla — yeni parti olarak eklenir)"}
          </p>
        )}
        <Input placeholder="Açıklama (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button disabled={!Number.isFinite(n) || n < 0 || count.isPending} onClick={() => count.mutate({ productId: product.id, countedQuantity: n, note: note || null })}>
          Sayımı Kaydet
        </Button>
      </DialogFooter>
    </>
  );
}

export type StockAction = { kind: "in" | "out" | "count"; product: ProductLite; reason?: Reason };

export function StockActionDialog({ action, onClose }: { action: StockAction | null; onClose: () => void }) {
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {action?.kind === "in" && <ReceiveBody key={action.product.id} product={action.product} onClose={onClose} />}
        {action?.kind === "out" && (
          <ConsumeBody key={action.product.id} product={action.product} defaultReason={action.reason ?? "KULLANIM"} onClose={onClose} />
        )}
        {action?.kind === "count" && <CountBody key={action.product.id} product={action.product} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

export { ExpiryBadge };
