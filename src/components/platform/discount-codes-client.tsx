"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(date));
}

export function DiscountCodesClient() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: codes } = platformTrpc.discountCode.list.useQuery();
  const utils = platformTrpc.useUtils();

  const create = platformTrpc.discountCode.create.useMutation({
    onSuccess: () => {
      toast.success("İndirim kodu oluşturuldu.");
      utils.discountCode.list.invalidate();
      setOpen(false);
      setCode("");
      setValue("10");
      setMaxUses("");
      setExpiresAt("");
    },
    onError: (e) => toastError(e),
  });

  const toggle = platformTrpc.discountCode.toggle.useMutation({
    onSuccess: () => {
      toast.success("Güncellendi.");
      utils.discountCode.list.invalidate();
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">İndirim Kodları</CardTitle>
            <CardDescription>Kayıt sayfasında kullanılabilecek indirim kodları.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Kod Oluştur
          </Button>
        </CardHeader>
        <CardContent>
          {!codes || codes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz indirim kodu yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {c.code}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {c.type === "PERCENT" ? `%${c.value}` : `${(c.value / 100).toFixed(2)} ₺`}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.usedCount}
                      {c.maxUses ? `/${c.maxUses}` : ""} kullanım
                      {c.expiresAt && ` · ${formatDate(c.expiresAt)} tarihinde sona erer`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.active ? "secondary" : "outline"}>{c.active ? "Aktif" : "Pasif"}</Badge>
                    <Switch checked={c.active} onCheckedChange={(checked) => toggle.mutate({ id: c.id, active: checked })} />
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
            <DialogTitle>İndirim Kodu Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kod</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="YENIYIL2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tür</Label>
                <Select value={type} onValueChange={(v) => setType((v as "PERCENT" | "AMOUNT") ?? "PERCENT")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => (v === "PERCENT" ? "Yüzde" : "Tutar")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Yüzde (%)</SelectItem>
                    <SelectItem value="AMOUNT">Tutar (₺)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Değer</Label>
                <Input type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Maks. Kullanım (opsiyonel)</Label>
                <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Son Kullanım Tarihi (opsiyonel)</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!code.trim() || !value || create.isPending}
              onClick={() =>
                create.mutate({
                  code: code.trim(),
                  type,
                  value: type === "PERCENT" ? Number(value) : Math.round(Number(value) * 100),
                  maxUses: maxUses ? Number(maxUses) : undefined,
                  expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                })
              }
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
