"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { Odontogram, JawPicker } from "@/components/dental/odontogram";
import { scopeLabel } from "@/lib/dental/treatment-labels";
import { Trash2, Star } from "lucide-react";

type CartItem = {
  key: string;
  treatmentTypeId: string;
  name: string;
  scope: "DIS_BAZLI" | "CENE_BAZLI";
  toothNumber?: number;
  jaw?: "UST" | "ALT";
  price?: number;
};

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

function isDoctorOnlyClient(roles: string[]) {
  const set = new Set(roles);
  return set.size === 1 && set.has("DOKTOR");
}

export function AddTreatmentClient({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { data: patient } = trpc.patient.getById.useQuery({ id: patientId });
  const { data: types } = trpc.treatmentType.list.useQuery();
  const { data: categories } = trpc.treatmentCategory.list.useQuery();
  const { data: favoriteIds } = trpc.favoriteTreatmentType.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const utils = trpc.useUtils();

  const [doctorId, setDoctorId] = useState<string>("");
  const [category, setCategory] = useState<string>("ALL");
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [selectedJaw, setSelectedJaw] = useState<"UST" | "ALT" | null>(null);
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const doctorOnly = me ? isDoctorOnlyClient(me.memberships.map((m) => m.role)) : false;
  const myDoctor = doctors?.find((d) => d.user.id === me?.id);
  // Doctor accounts always treat themselves as the treating doctor — no
  // picker, no ambiguity. Everyone else falls back to the patient's usual
  // doctor, then whatever they've explicitly picked.
  const effectiveDoctorId = doctorOnly && myDoctor ? myDoctor.id : doctorId || patient?.primaryDoctorId || "";

  const filteredTypes = useMemo(() => {
    if (!types) return [];
    if (category === "ALL") return types;
    if (category === "FAVORITES") return types.filter((t) => favoriteIds?.includes(t.id));
    return types.filter((t) => t.categoryId === category);
  }, [types, category, favoriteIds]);
  const activeType = types?.find((t) => t.id === activeTypeId);

  const createBulk = trpc.treatment.createBulk.useMutation({
    onSuccess: () => {
      toast.success("Tedaviler eklendi.");
      utils.patient.getById.invalidate({ id: patientId });
      router.push(`/dental/hastalar/${patientId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleFavorite = trpc.favoriteTreatmentType.toggle.useMutation({
    onSuccess: () => utils.favoriteTreatmentType.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  function selectType(id: string) {
    setActiveTypeId(id);
    setSelectedTeeth([]);
    setSelectedJaw(null);
  }

  function toggleTooth(n: number) {
    setSelectedTeeth((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function addToCart() {
    if (!activeType) return;
    const priceKurus = activeType.defaultPrice ?? undefined;

    if (activeType.scope === "DIS_BAZLI") {
      if (selectedTeeth.length === 0) {
        toast.error("Lütfen en az bir diş seçin.");
        return;
      }
      setCart((prev) => [
        ...prev,
        ...selectedTeeth.map((tooth) => ({
          key: `${activeType.id}-${tooth}-${Date.now()}-${Math.random()}`,
          treatmentTypeId: activeType.id,
          name: activeType.name,
          scope: activeType.scope,
          toothNumber: tooth,
          price: priceKurus,
        })),
      ]);
      setSelectedTeeth([]);
    } else {
      if (!selectedJaw) {
        toast.error("Lütfen çene seçin.");
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          key: `${activeType.id}-${selectedJaw}-${Date.now()}`,
          treatmentTypeId: activeType.id,
          name: activeType.name,
          scope: activeType.scope,
          jaw: selectedJaw,
          price: priceKurus,
        },
      ]);
      setSelectedJaw(null);
    }
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((item) => item.key !== key));
  }

  function submitCart() {
    if (!effectiveDoctorId) {
      toast.error("Lütfen doktor seçin.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Listeye en az bir tedavi ekleyin.");
      return;
    }
    createBulk.mutate({
      items: cart.map((item) => ({
        patientId,
        doctorId: effectiveDoctorId,
        treatmentTypeId: item.treatmentTypeId,
        name: item.name,
        toothNumber: item.toothNumber,
        jaw: item.jaw,
        notes: note || undefined,
      })),
    });
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price ?? 0), 0);

  if (!patient) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">{patient.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {patient.tcKimlikNo && `TC: ${patient.tcKimlikNo} · `}Tel: {patient.phone}
            </p>
          </div>
          {!doctorOnly && (
            <div className="w-56">
              <Select value={effectiveDoctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Doktor seçin">
                    {(value: string) => doctors?.find((d) => d.id === value)?.user.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Kategori</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={category === "ALL" ? "default" : "outline"}
                onClick={() => setCategory("ALL")}
              >
                Tümü
              </Button>
              <Button
                size="sm"
                variant={category === "FAVORITES" ? "default" : "outline"}
                onClick={() => setCategory("FAVORITES")}
              >
                <Star className="size-3.5" />
                Favorilerim
              </Button>
              {categories?.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={category === c.id ? "default" : "outline"}
                  onClick={() => setCategory(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Tedavi</p>
              <div className="flex max-h-96 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
                {filteredTypes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {category === "FAVORITES" ? "Henüz favori tedaviniz yok." : "Bu kategoride tedavi türü yok."}
                  </p>
                ) : (
                  filteredTypes.map((t) => {
                    const isFavorite = favoriteIds?.includes(t.id) ?? false;
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                          activeTypeId === t.id ? "bg-foreground text-background" : "hover:bg-accent"
                        }`}
                      >
                        <button type="button" className="flex-1 text-left" onClick={() => selectType(t.id)}>
                          <span className="block">{t.name}</span>
                          <span
                            className={`block text-xs ${
                              activeTypeId === t.id ? "text-background/70" : "text-muted-foreground"
                            }`}
                          >
                            {scopeLabel(t.scope)}
                            {t.defaultPrice != null && ` · ${formatMoney(t.defaultPrice)}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
                          className="p-1"
                          onClick={() => toggleFavorite.mutate({ treatmentTypeId: t.id })}
                        >
                          <Star
                            className={`size-4 ${isFavorite ? "fill-current text-amber-500" : "text-muted-foreground"}`}
                          />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Not (opsiyonel)</label>
              <Textarea
                placeholder="Tedavi ile ilgili notlar…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            {!activeType ? (
              <p className="py-24 text-center text-sm text-muted-foreground">
                Devam etmek için soldan bir tedavi seçin.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm">
                  Seçili tedavi: <span className="font-medium">{activeType.name}</span> ·{" "}
                  {activeType.category?.name ?? "Kategorisiz"} · {scopeLabel(activeType.scope)}
                  {activeType.defaultPrice != null && (
                    <span className="text-muted-foreground"> · Birim tutar: {formatMoney(activeType.defaultPrice)}</span>
                  )}
                </p>

                {activeType.scope === "DIS_BAZLI" ? (
                  <Odontogram selectedTeeth={selectedTeeth} onToggleTooth={toggleTooth} />
                ) : (
                  <JawPicker selectedJaw={selectedJaw} onSelectJaw={setSelectedJaw} />
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {activeType.defaultPrice != null && (
                    <p className="text-sm text-muted-foreground">
                      {activeType.scope === "DIS_BAZLI"
                        ? `${selectedTeeth.length || 1} diş × ${formatMoney(activeType.defaultPrice)}`
                        : `${selectedJaw ? 1 : 0} çene × ${formatMoney(activeType.defaultPrice)}`}
                    </p>
                  )}
                  <Button onClick={addToCart}>Listeye Ekle</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eklenecek Tedaviler ({cart.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Henüz tedavi eklenmedi.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {cart.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {item.name}
                    {item.toothNumber != null && ` · Diş ${item.toothNumber}`}
                    {item.jaw && ` · ${item.jaw === "UST" ? "Üst Çene" : "Alt Çene"}`}
                  </span>
                  <div className="flex items-center gap-3">
                    {item.price != null && (
                      <span className="text-muted-foreground">{formatMoney(item.price)}</span>
                    )}
                    <Button variant="ghost" size="icon" aria-label="Kaldır" onClick={() => removeFromCart(item.key)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm font-medium">Toplam: {formatMoney(cartTotal)}</p>
            <Button disabled={cart.length === 0 || createBulk.isPending} onClick={submitCart}>
              Tedavileri Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
