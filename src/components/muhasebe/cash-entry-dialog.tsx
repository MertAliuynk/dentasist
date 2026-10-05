"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
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
import { MoneyInput, emptyMoney, moneyResult, type MoneyValue } from "@/components/shared/money-input";
import { decimalInput, formatCurrency } from "@/lib/currency";

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
  branches,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "GELIR" | "GIDER";
  date: string;
  branches: { id: string; name: string }[];
}) {
  const [kind, setKind] = useState<IncomeKind | ExpenseKind>(type === "GELIR" ? "HASTA" : "HEKIM");
  const [entryDate, setEntryDate] = useState(date);
  const [method, setMethod] = useState<string>("NAKIT");
  const [money, setMoney] = useState<MoneyValue>(emptyMoney());
  const [pickedBranchId, setPickedBranchId] = useState("");
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
  const { data: debt } = trpc.cashRegister.patientDebt.useQuery(
    { patientId: patientId ?? "" },
    { enabled: isPatientIncome && !!patientId },
  );
  const result = moneyResult(money);
  const amountKurus = result.tlKurus ?? 0;
  const overDebt = isPatientIncome && !!debt && amountKurus > debt.outstanding;
  // Patient income is booked on the patient's branch (server enforces it);
  // other entries go to the picked branch, or the only one.
  const branchId = pickedBranchId || (branches.length === 1 ? branches[0].id : "");
  const needsBranch = !isPatientIncome && branches.length > 1;
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: isPatientIncome && patientSearch.trim().length > 0 },
  );
  const utils = trpc.useUtils();

  const create = trpc.cashRegister.create.useMutation({
    onSuccess: () => {
      toast.success(type === "GELIR" ? "Gelir eklendi." : "Gider eklendi.");
      utils.cashRegister.listByDate.invalidate();
      utils.cashRegister.patientDebt.invalidate();
      utils.paymentPlan.listForPatient.invalidate();
      onOpenChange(false);
      setMoney(emptyMoney());
      setDescription("");
      setCategoryId("");
      setDoctorId("");
      setPatientId(null);
      setPatientLabel("");
      setPatientSearch("");
    },
    onError: (e) => toastError(e),
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
                  <div className="rounded-md border border-input px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{patientLabel}</span>
                      <Button variant="ghost" size="sm" onClick={() => setPatientId(null)}>
                        Değiştir
                      </Button>
                    </div>
                    {debt ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Kalan borç:{" "}
                          <b className={debt.outstanding > 0 ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"}>
                            {formatCurrency(debt.outstanding)}
                          </b>
                        </span>
                        <span>Şube: {debt.branchName}</span>
                        {debt.outstanding > 0 && (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => setMoney(emptyMoney(decimalInput(debt.outstanding / 100)))}
                          >
                            Tamamını gir
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Borç bilgisi yükleniyor…</p>
                    )}
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

            {needsBranch && (
              <div className="space-y-2">
                <Label>Şube</Label>
                <Select value={pickedBranchId} onValueChange={(v) => setPickedBranchId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Şube seçin">
                      {(value: string) => branches.find((b) => b.id === value)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tutar</Label>
              <MoneyInput value={money} onChange={setMoney} side={type === "GELIR" ? "buying" : "selling"} />
              {overDebt && (
                <p className="text-xs text-destructive">
                  {debt!.outstanding > 0
                    ? `Tutar hastanın kalan borcundan (${formatCurrency(debt!.outstanding)}) fazla olamaz.`
                    : "Bu hastanın ödenmemiş borcu yok."}
                </p>
              )}
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
              amountKurus <= 0 ||
              overDebt ||
              (needsBranch && !branchId) ||
              (money.currency !== "TRY" && (!result.foreignAmount || !result.exchangeRate)) ||
              (isPatientIncome && !patientId) ||
              (isDoctorExpense && !doctorId) ||
              (type === "GIDER" && !categoryId) ||
              create.isPending
            }
            onClick={() =>
              create.mutate({
                branchId: branchId || branches[0].id,
                type,
                method: method as "NAKIT" | "HAVALE" | "KREDI_KARTI",
                amount: amountKurus,
                currency: result.currency,
                foreignAmount: result.foreignAmount,
                exchangeRate: result.exchangeRate,
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
