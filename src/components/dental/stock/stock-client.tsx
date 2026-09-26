"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CalendarX,
  ClipboardCopy,
  ClipboardList,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";
import {
  ExpiryBadge,
  REASON_META,
  ReasonBadge,
  StockBar,
  downloadCsv,
  fmtDate,
  fmtDateTime,
  money,
  type Reason,
} from "@/components/dental/stock/stock-utils";
import { ProductFormDialog, StockActionDialog, type ProductForm, type ProductLite, type StockAction } from "@/components/dental/stock/stock-dialogs";

type StatusFilter = "ALL" | "LOW" | "OUT" | "EXPIRING" | "EXPIRED";

const EMPTY_PRODUCT: ProductForm = {
  name: "",
  code: null,
  brand: null,
  unit: "adet",
  categoryId: null,
  supplierId: null,
  criticalLevel: 5,
  targetLevel: null,
  unitPrice: null,
  note: null,
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  active,
  onClick,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "warn" | "bad";
  active?: boolean;
  onClick?: () => void;
}) {
  const color = tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors ${
        active ? "border-primary ring-1 ring-primary" : "border-border"
      } ${onClick ? "hover:bg-accent/40" : "cursor-default"}`}
    >
      <span className="rounded-lg bg-muted p-2">
        <Icon className={`size-4 ${color || "text-muted-foreground"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={`block text-xl font-semibold tabular-nums ${color}`}>{value}</span>
        {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

const toLite = (p: { id: string; name: string; unit: string; quantity: number; unitPrice: number | null; supplierId: string | null }): ProductLite => ({
  id: p.id,
  name: p.name,
  unit: p.unit,
  quantity: p.quantity,
  unitPrice: p.unitPrice,
  supplierId: p.supplierId,
});

// ---------------------------------------------------------------------------
// Products

function ProductsTab({
  canManage,
  canWrite,
  status,
  setStatus,
  onAction,
  onEdit,
  onOpen,
}: {
  canManage: boolean;
  canWrite: boolean;
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
  onAction: (a: StockAction) => void;
  onEdit: (p: ProductForm) => void;
  onOpen: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const { data: products, isLoading } = trpc.stock.product.list.useQuery();
  const { data: categories } = trpc.stock.category.list.useQuery();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("ALL");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const q = useDebounced(search.trim().toLocaleLowerCase("tr-TR"), 150);

  const remove = trpc.stock.product.delete.useMutation({
    onSuccess: () => {
      toast.success("Ürün silindi.");
      setConfirmDelete(null);
      utils.stock.product.list.invalidate();
      utils.stock.summary.invalidate();
    },
    onError: (e) => toastError(e),
  });

  const rows = useMemo(() => {
    return (products ?? []).filter((p) => {
      if (categoryId !== "ALL" && (p.categoryId ?? "NONE") !== categoryId) return false;
      if (status === "LOW" && p.status !== "LOW") return false;
      if (status === "OUT" && p.status !== "OUT") return false;
      if (status === "EXPIRING" && p.expiringQty === 0) return false;
      if (status === "EXPIRED" && p.expiredQty === 0) return false;
      if (!q) return true;
      return [p.name, p.code, p.brand, p.supplier?.name, p.category?.name].some((v) => v?.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [products, q, categoryId, status]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Ürün adı, kod, marka veya tedarikçi…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "ALL")}>
            <SelectTrigger className="sm:w-48">
              <SelectValue>{(v: string) => (v === "ALL" ? "Tüm kategoriler" : v === "NONE" ? "Kategorisiz" : categories?.find((c) => c.id === v)?.name)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm kategoriler</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value="NONE">Kategorisiz</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={() => onEdit(EMPTY_PRODUCT)}>
              <Plus className="size-4" /> Ürün Ekle
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", "Tümü"],
              ["LOW", "Kritik seviyede"],
              ["OUT", "Tükenen"],
              ["EXPIRING", "SKT yaklaşan"],
              ["EXPIRED", "SKT geçmiş"],
            ] as [StatusFilter, string][]
          ).map(([v, l]) => (
            <Button key={v} size="xs" variant={status === v ? "default" : "outline"} onClick={() => setStatus(v)}>
              {l}
            </Button>
          ))}
          <span className="ml-auto self-center text-xs text-muted-foreground">{rows.length} ürün</span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !products || products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Boxes className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Henüz ürün yok. İlk malzemenizi ekleyerek stok takibine başlayın.</p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => onEdit(EMPTY_PRODUCT)}>
                <Plus className="size-4" /> İlk ürünü ekle
              </Button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Bu filtrelere uyan ürün yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="w-44">Stok</TableHead>
                  <TableHead>Son Kullanma</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-right">Stok Değeri</TableHead>
                  <TableHead>Tüketim</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p.id)}>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[p.code, p.brand, p.category?.name, p.supplier?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium tabular-nums">
                          {p.quantity} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
                        </span>
                        {p.status === "OUT" && <Badge variant="destructive">Tükendi</Badge>}
                        {p.status === "LOW" && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
                            Kritik
                          </Badge>
                        )}
                      </div>
                      <StockBar quantity={p.quantity} critical={p.criticalLevel} target={p.targetLevel} />
                    </TableCell>
                    <TableCell>
                      <ExpiryBadge date={p.nearestExpiry} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{money(p.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.value)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.used30 > 0 ? (
                        <>
                          {p.used30} / 30 gün
                          {p.daysLeft != null && (
                            <span className={`block ${p.daysLeft <= 14 ? "font-medium text-amber-600 dark:text-amber-400" : ""}`}>≈ {p.daysLeft} gün yeter</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-0.5">
                        {canWrite && (
                          <>
                            <Button size="icon" variant="ghost" aria-label="Stok girişi" title="Stok girişi" onClick={() => onAction({ kind: "in", product: toLite(p) })}>
                              <ArrowDownToLine className="size-4 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Stok çıkışı"
                              title="Stok çıkışı"
                              disabled={p.quantity === 0}
                              onClick={() => onAction({ kind: "out", product: toLite(p) })}
                            >
                              <ArrowUpFromLine className="size-4 text-sky-600" />
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label="Diğer" />}>
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpen(p.id)}>Detay ve geçmiş</DropdownMenuItem>
                            {canWrite && (
                              <>
                                <DropdownMenuItem onClick={() => onAction({ kind: "out", product: toLite(p), reason: "HASTA_KULLANIMI" })}>Hastaya kullanıldı</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction({ kind: "count", product: toLite(p) })}>Sayım yap</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onAction({ kind: "out", product: toLite(p), reason: "SKT_IMHA" })}>SKT imha / fire</DropdownMenuItem>
                              </>
                            )}
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    onEdit({
                                      id: p.id,
                                      name: p.name,
                                      code: p.code,
                                      brand: p.brand,
                                      unit: p.unit,
                                      categoryId: p.categoryId,
                                      supplierId: p.supplierId,
                                      criticalLevel: p.criticalLevel,
                                      targetLevel: p.targetLevel,
                                      unitPrice: p.unitPrice,
                                      note: p.note,
                                    })
                                  }
                                >
                                  <Pencil className="size-3.5" /> Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete({ id: p.id, name: p.name })}>
                                  <Trash2 className="size-3.5" /> Sil
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ürünü sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &quot;{confirmDelete?.name}&quot; listeden kaldırılacak. Geçmiş hareketleri raporlarda kalmaya devam eder.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => confirmDelete && remove.mutate({ id: confirmDelete.id })}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Product detail drawer

function ProductDrawer({ id, onClose, canWrite, onAction }: { id: string | null; onClose: () => void; canWrite: boolean; onAction: (a: StockAction) => void }) {
  const { data: p } = trpc.stock.product.get.useQuery({ id: id ?? "" }, { enabled: !!id });
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetTitle className="sr-only">Ürün detayı</SheetTitle>
        {!p ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : (
          <div className="space-y-5 p-1">
            <div>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-sm text-muted-foreground">
                {[p.code, p.brand, p.category?.name, p.branch.name].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Stok</p>
                <p className="text-lg font-semibold tabular-nums">
                  {p.quantity} <span className="text-xs font-normal">{p.unit}</span>
                </p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">Değer</p>
                <p className="text-lg font-semibold tabular-nums">{money(p.value)}</p>
              </div>
              <div className="rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground">30 gün tüketim</p>
                <p className="text-lg font-semibold tabular-nums">{p.used30}</p>
              </div>
            </div>
            <StockBar quantity={p.quantity} critical={p.criticalLevel} target={p.targetLevel} />
            <p className="-mt-3 text-xs text-muted-foreground">
              Kritik seviye {p.criticalLevel}
              {p.targetLevel ? ` · ideal ${p.targetLevel}` : ""}
              {p.daysLeft != null && ` · mevcut tüketimle ≈ ${p.daysLeft} gün yeter`}
            </p>

            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onAction({ kind: "in", product: toLite(p) })}>
                  <ArrowDownToLine className="size-4" /> Giriş
                </Button>
                <Button size="sm" variant="outline" disabled={p.quantity === 0} onClick={() => onAction({ kind: "out", product: toLite(p) })}>
                  <ArrowUpFromLine className="size-4" /> Çıkış
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction({ kind: "count", product: toLite(p) })}>
                  <ClipboardList className="size-4" /> Sayım
                </Button>
              </div>
            )}

            {p.supplier && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Tedarikçi</p>
                <p className="font-medium">{p.supplier.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.supplier.contactName, p.supplier.phone, p.supplier.email].filter(Boolean).join(" · ") || "İletişim bilgisi yok"}
                </p>
              </div>
            )}
            {p.note && <p className="rounded-lg bg-muted/50 p-3 text-sm">{p.note}</p>}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Partiler (SKT sırasıyla)</h3>
              {p.lots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Elde parti yok.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border text-sm">
                  {p.lots.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span>
                        <span className="font-medium tabular-nums">
                          {l.quantity} {p.unit}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {l.lotNo ?? "lotsuz"} · giriş {fmtDate(l.receivedAt)}
                          {l.unitCost != null && ` · ${money(l.unitCost)}`}
                        </span>
                      </span>
                      <ExpiryBadge date={l.expiryDate} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Son Hareketler</h3>
              {p.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz hareket yok.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border text-sm">
                  {p.movements.map((m) => (
                    <div key={m.id} className="space-y-0.5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <ReasonBadge reason={m.reason as Reason | null} type={m.type} />
                        <span className={`font-medium tabular-nums ${m.type === "GIRIS" ? "text-emerald-600" : "text-foreground"}`}>
                          {m.type === "GIRIS" ? "+" : "−"}
                          {m.quantity} {p.unit}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fmtDateTime(m.createdAt)} · {m.createdBy.name}
                        {m.patient && ` · ${m.patient.fullName}`}
                        {m.supplier && ` · ${m.supplier.name}`}
                        {m.invoiceNo && ` · fatura ${m.invoiceNo}`}
                        {m.expiryDate && ` · SKT ${fmtDate(m.expiryDate)}`}
                        {m.note && ` · ${m.note}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Movements

function MovementsTab() {
  const [reason, setReason] = useState<Reason | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 300);
  const input = {
    reason: reason === "ALL" ? undefined : reason,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    search: q || undefined,
    limit: 100,
  };
  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = trpc.stock.movement.list.useInfiniteQuery(input, {
    getNextPageParam: (l) => l.nextCursor,
  });
  const utils = trpc.useUtils();
  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  async function exportCsv() {
    try {
      const all = await utils.stock.movement.list.fetch({ ...input, limit: 500 });
      downloadCsv(`stok-hareketleri-${new Date().toISOString().slice(0, 10)}.csv`, [
        ["Tarih", "Ürün", "Kod", "Tür", "Sebep", "Miktar", "Birim", "Birim Maliyet", "Hasta", "Tedarikçi", "Fatura", "Lot", "SKT", "Şube", "Kullanıcı", "Not"],
        ...all.rows.map((m) => [
          fmtDateTime(m.createdAt),
          m.product.name,
          m.product.code,
          m.type === "GIRIS" ? "Giriş" : "Çıkış",
          m.reason ? REASON_META[m.reason as Reason].label : "",
          m.type === "GIRIS" ? m.quantity : -m.quantity,
          m.product.unit,
          m.unitCost != null ? (m.unitCost / 100).toFixed(2).replace(".", ",") : "",
          m.patient?.fullName,
          m.supplier?.name,
          m.invoiceNo,
          m.lotNo,
          m.expiryDate ? fmtDate(m.expiryDate) : "",
          m.branch.name,
          m.createdBy.name,
          m.note,
        ]),
      ]);
      if (all.nextCursor) toast.info("İlk 500 hareket aktarıldı. Daha fazlası için tarih aralığını daraltın.");
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Ürün, hasta, fatura, lot, not…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Excel (CSV)
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="xs" variant={reason === "ALL" ? "default" : "outline"} onClick={() => setReason("ALL")}>
            Tümü
          </Button>
          {(Object.keys(REASON_META) as Reason[]).map((r) => (
            <Button key={r} size="xs" variant={reason === r ? "default" : "outline"} onClick={() => setReason(r)}>
              {REASON_META[r].label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Bu filtrelere uyan hareket yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Ürün</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead>Detay</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(m.createdAt)}</TableCell>
                    <TableCell className="font-medium">{m.product.name}</TableCell>
                    <TableCell>
                      <ReasonBadge reason={m.reason as Reason | null} type={m.type} />
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${m.type === "GIRIS" ? "text-emerald-600" : ""}`}>
                      {m.type === "GIRIS" ? "+" : "−"}
                      {m.quantity} <span className="text-xs font-normal text-muted-foreground">{m.product.unit}</span>
                    </TableCell>
                    <TableCell className="max-w-72 text-xs text-muted-foreground">
                      {[
                        m.patient?.fullName,
                        m.supplier?.name,
                        m.invoiceNo && `Fatura ${m.invoiceNo}`,
                        m.lotNo && `Lot ${m.lotNo}`,
                        m.expiryDate && `SKT ${fmtDate(m.expiryDate)}`,
                        m.unitCost != null && money(m.unitCost),
                        m.note,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.createdBy.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {hasNextPage && (
          <div className="pt-3 text-center">
            <Button variant="outline" size="sm" disabled={isFetching} onClick={() => fetchNextPage()}>
              Daha Fazla
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reorder list

function ReorderTab({ canWrite, onAction }: { canWrite: boolean; onAction: (a: StockAction) => void }) {
  const { data, isLoading } = trpc.stock.reorder.useQuery();

  const copy = (g: NonNullable<typeof data>[number]) => {
    const text = [
      `Sipariş listesi — ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date())}`,
      g.supplier ? `Tedarikçi: ${g.supplier.name}` : "",
      "",
      ...g.items.map((p) => `• ${p.name}${p.code ? ` (${p.code})` : ""}: ${p.suggested} ${p.unit}`),
    ]
      .filter((l, i) => l || i > 1)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Sipariş listesi kopyalandı — tedarikçiye WhatsApp/e-posta ile gönderebilirsiniz.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Kritik seviyedeki ve tükenen ürünler, tedarikçiye göre gruplandı. Önerilen miktar ürünü ideal stoğa (yoksa kritik seviyenin 2 katına) tamamlar.
      </p>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Sipariş edilmesi gereken ürün yok. Stoklar yeterli. ✅</CardContent>
        </Card>
      ) : (
        data.map((g) => {
          const total = g.items.reduce((s, p) => s + p.estimatedCost, 0);
          return (
            <Card key={g.supplier?.id ?? "none"}>
              <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">{g.supplier?.name ?? "Tedarikçisi belirtilmemiş"}</CardTitle>
                  <CardDescription>
                    {g.supplier ? [g.supplier.contactName, g.supplier.phone, g.supplier.email].filter(Boolean).join(" · ") || "İletişim bilgisi yok" : "Ürünlere tedarikçi atayarak gruplamayı netleştirin."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {total > 0 && <span className="text-sm text-muted-foreground">Tahmini: {money(total)}</span>}
                  <Button size="sm" variant="outline" onClick={() => copy(g)}>
                    <ClipboardCopy className="size-4" /> Listeyi kopyala
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {g.items.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · elde {p.quantity} {p.unit} (kritik {p.criticalLevel})
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={p.status === "OUT" ? "destructive" : "outline"}>
                          Önerilen: {p.suggested} {p.unit}
                        </Badge>
                        {canWrite && (
                          <Button size="xs" variant="ghost" onClick={() => onAction({ kind: "in", product: toLite(p) })}>
                            <ArrowDownToLine className="size-3.5" /> Teslim alındı
                          </Button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports

function ReportsTab() {
  const [days, setDays] = useState(30);
  const { data } = trpc.stock.summary.useQuery({ days });
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {[30, 90, 180, 365].map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>
            Son {d === 365 ? "1 yıl" : `${d} gün`}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={ArrowDownToLine} label="Satın alma tutarı" value={money(data?.purchases ?? 0)} />
        <Kpi icon={ArrowUpFromLine} label="Tüketilen malzeme" value={money(data?.usedValue ?? 0)} />
        <Kpi icon={AlertTriangle} label="Fire + SKT imha kaybı" value={money(data?.lossValue ?? 0)} tone={data?.lossValue ? "bad" : undefined} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">En Çok Tüketilen Malzemeler</CardTitle>
          <CardDescription>Klinik ve hasta kullanımları, tutara göre.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.topUsed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu dönemde tüketim kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {data.topUsed.map((t) => {
                const max = data.topUsed[0].value || data.topUsed[0].qty || 1;
                const pct = Math.round(((t.value || t.qty) / max) * 100);
                return (
                  <div key={t.id} className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{t.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t.qty} {t.unit} · {money(t.value)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Definitions (categories + suppliers)

function DefinitionsTab() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.stock.category.list.useQuery();
  const { data: suppliers } = trpc.stock.supplier.list.useQuery();
  const [catName, setCatName] = useState("");
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [supplier, setSupplier] = useState<null | { id?: string; name: string; contactName: string; phone: string; email: string; address: string; taxNumber: string; note: string }>(null);

  const refresh = () => {
    utils.stock.category.list.invalidate();
    utils.stock.supplier.list.invalidate();
    utils.stock.product.list.invalidate();
  };
  const createCat = trpc.stock.category.create.useMutation({ onSuccess: () => { setCatName(""); refresh(); }, onError: (e) => toastError(e) });
  const updateCat = trpc.stock.category.update.useMutation({ onSuccess: () => { setEditCat(null); refresh(); }, onError: (e) => toastError(e) });
  const deleteCat = trpc.stock.category.delete.useMutation({ onSuccess: () => { toast.success("Kategori silindi."); refresh(); }, onError: (e) => toastError(e) });
  const saveSup = trpc.stock.supplier.create.useMutation({ onSuccess: () => { toast.success("Tedarikçi eklendi."); setSupplier(null); refresh(); }, onError: (e) => toastError(e) });
  const updateSup = trpc.stock.supplier.update.useMutation({ onSuccess: () => { toast.success("Tedarikçi güncellendi."); setSupplier(null); refresh(); }, onError: (e) => toastError(e) });
  const deleteSup = trpc.stock.supplier.delete.useMutation({ onSuccess: () => { toast.success("Tedarikçi silindi."); refresh(); }, onError: (e) => toastError(e) });

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kategoriler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (catName.trim()) createCat.mutate({ name: catName.trim() });
            }}
          >
            <Input placeholder="Yeni kategori" value={catName} onChange={(e) => setCatName(e.target.value)} />
            <Button type="submit" size="icon" disabled={!catName.trim()} aria-label="Ekle">
              <Plus className="size-4" />
            </Button>
          </form>
          <div className="divide-y divide-border">
            {categories?.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
                {editCat?.id === c.id ? (
                  <form
                    className="flex flex-1 gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      updateCat.mutate({ id: c.id, name: editCat.name });
                    }}
                  >
                    <Input className="h-7" value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} autoFocus />
                    <Button type="submit" size="xs">
                      Kaydet
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c._count.products} ürün</span>
                    <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => setEditCat({ id: c.id, name: c.name })}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => deleteCat.mutate({ id: c.id })}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {categories?.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Kategori yok.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tedarikçiler</CardTitle>
          <Button size="sm" onClick={() => setSupplier({ name: "", contactName: "", phone: "", email: "", address: "", taxNumber: "", note: "" })}>
            <Plus className="size-4" /> Tedarikçi Ekle
          </Button>
        </CardHeader>
        <CardContent>
          {suppliers?.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Tedarikçi yok.</p>
          ) : (
            <div className="divide-y divide-border">
              {suppliers?.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {s.name} <span className="text-xs font-normal text-muted-foreground">· {s._count.products} ürün</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{[s.contactName, s.phone, s.email, s.taxNumber && `VKN ${s.taxNumber}`].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Düzenle"
                      onClick={() =>
                        setSupplier({
                          id: s.id,
                          name: s.name,
                          contactName: s.contactName ?? "",
                          phone: s.phone ?? "",
                          email: s.email ?? "",
                          address: s.address ?? "",
                          taxNumber: s.taxNumber ?? "",
                          note: s.note ?? "",
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => deleteSup.mutate({ id: s.id })}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!supplier} onOpenChange={(o) => !o && setSupplier(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{supplier?.id ? "Tedarikçiyi Düzenle" : "Yeni Tedarikçi"}</DialogTitle>
          </DialogHeader>
          {supplier && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Firma Adı *"],
                  ["contactName", "Yetkili Kişi"],
                  ["phone", "Telefon"],
                  ["email", "E-posta"],
                  ["taxNumber", "Vergi No"],
                  ["address", "Adres"],
                ] as const
              ).map(([k, l]) => (
                <div key={k} className={`space-y-1.5 ${k === "address" ? "sm:col-span-2" : ""}`}>
                  <Label>{l}</Label>
                  <Input value={supplier[k]} onChange={(e) => setSupplier({ ...supplier, [k]: e.target.value })} />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Not</Label>
                <Input value={supplier.note} onChange={(e) => setSupplier({ ...supplier, note: e.target.value })} placeholder="Ödeme vadesi, teslim süresi…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplier(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={!supplier?.name.trim() || saveSup.isPending || updateSup.isPending}
              onClick={() => {
                if (!supplier) return;
                const { id, ...data } = supplier;
                if (id) updateSup.mutate({ id, ...data });
                else saveSup.mutate(data);
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function StockClient() {
  const { data: me } = trpc.user.me.useQuery();
  const { data: summary } = trpc.stock.summary.useQuery({ days: 30 });
  const [tab, setTab] = useState("urunler");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [action, setAction] = useState<StockAction | null>(null);
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const can = (c: Parameters<typeof hasCapability>[1]) => (me ? hasCapability(me.memberships.map((m) => m.role), c, me.capabilityOverrides) : false);
  const canManage = can("dental:stock:manage");
  const canWrite = can("dental:stock:write");

  const showStatus = (s: StatusFilter) => {
    setStatus(status === s ? "ALL" : s);
    setTab("urunler");
  };

  return (
    <div className="mx-auto w-full flex max-w-7xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Stok Takibi</h1>
        <p className="text-sm text-muted-foreground">Malzemeler, partiler, son kullanma tarihleri ve tüketim — tek yerde.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Boxes} label="Ürün" value={summary?.productCount ?? "—"} onClick={() => showStatus("ALL")} active={tab === "urunler" && status === "ALL"} />
        <Kpi icon={Wallet} label="Toplam stok değeri" value={summary ? money(summary.totalValue) : "—"} sub="Alış maliyetiyle" />
        <Kpi
          icon={AlertTriangle}
          label="Kritik / tükenen"
          value={summary ? `${summary.lowCount} / ${summary.outCount}` : "—"}
          tone={summary && summary.lowCount + summary.outCount > 0 ? "warn" : undefined}
          active={status === "LOW" || status === "OUT"}
          onClick={() => showStatus(summary?.outCount ? "OUT" : "LOW")}
        />
        <Kpi
          icon={CalendarX}
          label="SKT yaklaşan / geçmiş"
          value={summary ? `${summary.expiringCount} / ${summary.expiredCount}` : "—"}
          sub="60 gün içinde"
          tone={summary?.expiredCount ? "bad" : summary?.expiringCount ? "warn" : undefined}
          active={status === "EXPIRING" || status === "EXPIRED"}
          onClick={() => showStatus(summary?.expiredCount ? "EXPIRED" : "EXPIRING")}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="urunler">Ürünler</TabsTrigger>
            <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
            <TabsTrigger value="siparis">
              Sipariş Listesi
              {summary && summary.lowCount + summary.outCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{summary.lowCount + summary.outCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="raporlar">Raporlar</TabsTrigger>
            {canManage && <TabsTrigger value="tanimlar">Kategori & Tedarikçi</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="urunler">
          <ProductsTab canManage={canManage} canWrite={canWrite} status={status} setStatus={setStatus} onAction={setAction} onEdit={setEditing} onOpen={setOpenId} />
        </TabsContent>
        <TabsContent value="hareketler">
          <MovementsTab />
        </TabsContent>
        <TabsContent value="siparis">
          <ReorderTab canWrite={canWrite} onAction={setAction} />
        </TabsContent>
        <TabsContent value="raporlar">
          <ReportsTab />
        </TabsContent>
        {canManage && (
          <TabsContent value="tanimlar">
            <DefinitionsTab />
          </TabsContent>
        )}
      </Tabs>

      <ProductDrawer id={openId} onClose={() => setOpenId(null)} canWrite={canWrite} onAction={setAction} />
      <StockActionDialog action={action} onClose={() => setAction(null)} />
      <ProductFormDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
