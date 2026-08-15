"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const METHOD_OPTIONS = [
  { value: "NAKIT", label: "Nakit" },
  { value: "HAVALE", label: "Havale" },
  { value: "KREDI_KARTI", label: "Kredi Kartı" },
] as const;

type IncomeKind = "HASTA" | "KLINIK";
type ExpenseKind = "HEKIM" | "KLINIK";

const INCOME_KINDS: { value: IncomeKind; title: string; subtitle: string }[] = [
  { value: "HASTA", title: "Hasta Geliri", subtitle: "Hasta ile ilgili gelirler" },
  { value: "KLINIK", title: "Klinik Geliri", subtitle: "Kliniğe ait gelirler" },
];

const EXPENSE_KINDS: { value: ExpenseKind; title: string; subtitle: string }[] = [
  { value: "HEKIM", title: "Hekim Gideri", subtitle: "Hekim ile ilgili giderler" },
  { value: "KLINIK", title: "Klinik Gideri", subtitle: "Kliniğe ait giderler" },
];

export function CashEntryDialog({
  open,
  onOpenChange,
  type,
  date,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "GELIR" | "GIDER";
  date: string;
  branchId: string;
}) {
  const [kind, setKind] = useState<IncomeKind | ExpenseKind>(type === "GELIR" ? "HASTA" : "HEKIM");
  const [entryDate, setEntryDate] = useState(date);
  const [method, setMethod] = useState<string>("NAKIT");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [description, setDescription] = useState("");

  const isPatientIncome = type === "GELIR" && kind === "HASTA";
  const isDoctorExpense = type === "GIDER" && kind === "HEKIM";

  const { data: categories } = trpc.expenseCategory.list.useQuery(undefined, { enabled: type === "GIDER" });
  const { data: doctors } = trpc.doctor.list.useQuery(undefined, { enabled: isDoctorExpense });
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: isPatientIncome && patientSearch.trim().length > 0 },
  );
  const utils = trpc.useUtils();

  const create = trpc.cashRegister.create.useMutation({
    onSuccess: () => {
      toast.success(type === "GELIR" ? "Gelir eklendi." : "Gider eklendi.");
      utils.cashRegister.listByDate.invalidate();
      onOpenChange(false);
      setAmount("");
      setDescription("");
      setCategoryId("");
      setDoctorId("");
      setPatientId(null);
      setPatientLabel("");
      setPatientSearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  const kinds = type === "GELIR" ? INCOME_KINDS : EXPENSE_KINDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${type === "GELIR" ? "bg-emerald-500" : "bg-destructive"}`} />
            {type === "GELIR" ? "Yeni Gelir Ekle" : "Yeni Gider Ekle"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
          <div className="flex flex-row gap-2 sm:flex-col">
            {kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors sm:flex-none ${
                  kind === k.value ? "border-foreground bg-accent" : "border-transparent hover:bg-accent"
                }`}
              >
                <span className="block font-medium">{k.title}</span>
                <span className="block text-xs text-muted-foreground">{k.subtitle}</span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {isPatientIncome && (
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
                    <Input
                      placeholder="Hasta ara…"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    {patientResults && patientResults.patients.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded-md border border-input">
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

            {isDoctorExpense && (
              <div className="space-y-2">
                <Label>Hekim</Label>
                <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Hekim seçin">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ödeme Tarihi</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ödeme Tipi</Label>
                <Select value={method} onValueChange={(v) => setMethod(v ?? "NAKIT")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => METHOD_OPTIONS.find((m) => m.value === value)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type === "GIDER" && (
              <div className="space-y-2">
                <Label>Gider Kalemi</Label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kalem seçin">
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
            )}

            <div className="space-y-2">
              <Label>Miktar (₺)</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Not</Label>
              <Input
                placeholder="Gerekliyse kısa bir açıklama girebilirsiniz."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={
              !amount ||
              Number(amount) <= 0 ||
              (isPatientIncome && !patientId) ||
              (isDoctorExpense && !doctorId) ||
              (type === "GIDER" && !categoryId) ||
              create.isPending
            }
            onClick={() =>
              create.mutate({
                branchId,
                type,
                method: method as "NAKIT" | "HAVALE" | "KREDI_KARTI",
                amount: Math.round(Number(amount) * 100),
                categoryId: categoryId || undefined,
                doctorId: isDoctorExpense ? doctorId || undefined : undefined,
                patientId: isPatientIncome ? patientId ?? undefined : undefined,
                description: description || undefined,
                entryDate: new Date(entryDate).toISOString(),
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
