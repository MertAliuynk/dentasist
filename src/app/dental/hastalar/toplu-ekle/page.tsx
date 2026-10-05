"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ClipboardPaste, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Row = { id: number; fullName: string; phone: string; tc: string };

const MAX_ROWS = 100;
const NO_DOCTOR = "__none";

let nextId = 0;
const makeRow = (r: Partial<Omit<Row, "id">> = {}): Row => ({ id: ++nextId, fullName: "", phone: "", tc: "", ...r });

/** Digits only, without a leading 0 / 90 for Turkish numbers. */
function phoneDigits(v: string) {
  const d = v.replace(/\D/g, "");
  if (v.trim().startsWith("+") && !d.startsWith("90")) return d; // foreign, keep as is
  if (d.startsWith("90") && d.length >= 12) return d.slice(2);
  if (d.startsWith("0")) return d.slice(1);
  return d;
}

/** "5321234567" → "532 123 45 67" while typing. */
function formatTrPhone(d: string) {
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return p.join(" ");
}

function isForeign(v: string) {
  return v.trim().startsWith("+") && !v.replace(/\D/g, "").startsWith("90");
}

/** What gets stored: "+90 532 123 45 67" (or "+<foreign digits>"). */
function phoneForSave(v: string) {
  if (isForeign(v)) return `+${v.replace(/\D/g, "")}`;
  return `+90 ${formatTrPhone(phoneDigits(v))}`;
}

function validTc(v: string) {
  if (!/^\d{11}$/.test(v)) return false;
  const d = v.split("").map(Number);
  if (d[0] === 0) return false;
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  return (odd * 7 - even) % 10 === d[9] && (odd + even + d[9]) % 10 === d[10];
}

type RowCheck = { empty: boolean; ok: boolean; errors: Partial<Record<"fullName" | "phone" | "tc", string>> };

function checkRow(r: Row, dupPhones: Set<string>): RowCheck {
  const empty = !r.fullName.trim() && !r.phone.trim() && !r.tc.trim();
  if (empty) return { empty, ok: false, errors: {} };
  const errors: RowCheck["errors"] = {};
  if (r.fullName.trim().length < 2) errors.fullName = "Ad soyad girin";
  const digits = phoneDigits(r.phone);
  if (!r.phone.trim()) errors.phone = "Telefon girin";
  else if (isForeign(r.phone) ? digits.length < 8 || digits.length > 15 : digits.length !== 10) errors.phone = "Telefon 10 haneli olmalı";
  else if (dupPhones.has(digits)) errors.phone = "Listede tekrar ediyor";
  if (r.tc.trim() && !validTc(r.tc.trim())) errors.tc = "Geçersiz TC";
  return { empty, ok: Object.keys(errors).length === 0, errors };
}

/** Lines of "Ad Soyad <tab|;|,> Telefon <sep> TC" (as copied from Excel). */
function parsePasted(text: string): Omit<Row, "id">[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(/\t|;|,(?=\s*[+\d])/).map((c) => c.trim());
      const out = { fullName: "", phone: "", tc: "" };
      for (const c of cells) {
        const digits = c.replace(/\D/g, "");
        if (/^\d{11}$/.test(c) && validTc(c)) out.tc = c;
        else if (digits.length >= 10 && /^[+\d\s()-]+$/.test(c)) out.phone = c;
        else if (!out.fullName && /\p{L}/u.test(c)) out.fullName = c;
      }
      return out;
    })
    .filter((r) => r.fullName || r.phone);
}

export default function BulkPatientImportPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [makeRow(), makeRow(), makeRow()]);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [touched, setTouched] = useState(false);
  const nameRefs = useRef(new Map<number, HTMLInputElement>());

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const effectiveBranchId = branches?.length === 1 ? branches[0].id : branchId;
  const branchDoctors = doctors?.filter((d) => d.branchId === effectiveBranchId && !d.klinikId) ?? [];

  const bulkCreate = trpc.patient.bulkCreate.useMutation({
    onSuccess: (result) => {
      if (result.skipped.length) {
        toast.warning(`${result.count} hasta eklendi. ${result.skipped.length} kişi zaten kayıtlı olduğu için atlandı: ${result.skipped.join(", ")}`, {
          duration: 10000,
        });
      } else {
        toast.success(`${result.count} hasta eklendi.`);
      }
      router.push("/dental/hasta-listesi");
    },
    onError: (e) => toastError(e),
  });

  const checks = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const d = phoneDigits(r.phone);
      if (d.length >= 8) seen.set(d, (seen.get(d) ?? 0) + 1);
    }
    const dup = new Set([...seen].filter(([, n]) => n > 1).map(([d]) => d));
    return new Map(rows.map((r) => [r.id, checkRow(r, dup)]));
  }, [rows]);

  const filled = rows.filter((r) => !checks.get(r.id)!.empty);
  const valid = filled.filter((r) => checks.get(r.id)!.ok);
  const invalidCount = filled.length - valid.length;

  function update(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow(focus = true) {
    if (rows.length >= MAX_ROWS) return;
    const row = makeRow();
    setRows((prev) => [...prev, row]);
    if (focus) requestAnimationFrame(() => nameRefs.current.get(row.id)?.focus());
  }

  function applyPaste() {
    const parsed = parsePasted(pasteText);
    if (parsed.length === 0) {
      toast.error("Yapıştırılan metinde hasta bulunamadı.");
      return;
    }
    setRows((prev) => {
      const kept = prev.filter((r) => !checks.get(r.id)?.empty);
      const room = MAX_ROWS - kept.length;
      if (parsed.length > room) toast.warning(`En fazla ${MAX_ROWS} satır eklenebilir; ${parsed.length - room} satır alınmadı.`);
      return [...kept, ...parsed.slice(0, room).map((p) => makeRow(p))];
    });
    setPasteText("");
    setShowPaste(false);
    setTouched(true);
  }

  function submit() {
    setTouched(true);
    if (invalidCount > 0) {
      toast.error(`${invalidCount} satırda hata var. Kırmızı alanları düzeltin ya da satırı silin.`);
      return;
    }
    bulkCreate.mutate({
      branchId: effectiveBranchId,
      primaryDoctorId: doctorId || null,
      patients: valid.map((r) => ({ fullName: r.fullName.trim(), phone: phoneForSave(r.phone), tcKimlikNo: r.tc.trim() })),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Toplu Hasta Ekleme
            </CardTitle>
            <CardDescription>
              {`Tek seferde en fazla ${MAX_ROWS} hasta. Satırları elle doldurabilir ya da Excel'den kopyalayıp yapıştırabilirsiniz.`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPaste((v) => !v)}>
            <ClipboardPaste className="size-4" /> {"Excel\u2019den Yapıştır"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showPaste && (
            <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
              <p className="text-sm">
                Her satıra bir hasta: <b>Ad Soyad</b>, <b>Telefon</b>, <b>TC</b> (opsiyonel). Sütunlar sekme, noktalı virgül veya virgülle
                ayrılabilir.
              </p>
              <Textarea
                rows={6}
                autoFocus
                className="font-mono text-xs"
                placeholder={"Ayşe Yılmaz\t0532 123 45 67\t12345678901\nMehmet Demir\t5441234567"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowPaste(false)}>
                  Vazgeç
                </Button>
                <Button size="sm" disabled={!pasteText.trim()} onClick={applyPaste}>
                  Satırlara Aktar
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {branches && branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Şube *</Label>
                <Select
                  value={branchId}
                  onValueChange={(v) => {
                    setBranchId(v ?? "");
                    setDoctorId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Şube seçin">{(value: string) => branches.find((b) => b.id === value)?.name}</SelectValue>
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
            <div className="space-y-1.5">
              <Label>Sorumlu Hekim (opsiyonel)</Label>
              <Select value={doctorId || NO_DOCTOR} onValueChange={(v) => setDoctorId(!v || v === NO_DOCTOR ? "" : v)} disabled={!effectiveBranchId}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (value === NO_DOCTOR ? "Atanmasın" : branchDoctors.find((d) => d.id === value)?.user.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DOCTOR}>Atanmasın</SelectItem>
                  {branchDoctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title ? `${d.title} ` : ""}
                      {d.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="hidden grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_2.5rem] gap-2 border-b border-border bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span className="text-center">#</span>
              <span>Ad Soyad *</span>
              <span>Telefon *</span>
              <span>TC Kimlik No</span>
              <span />
            </div>
            <div className="divide-y divide-border">
              {rows.map((row, idx) => {
                const c = checks.get(row.id)!;
                const show = touched || !c.empty;
                const err = (k: keyof RowCheck["errors"]) => (show && touched ? c.errors[k] : undefined);
                const foreign = isForeign(row.phone);
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-start gap-2 px-2 py-2 md:grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_2.5rem]",
                      touched && !c.empty && !c.ok && "bg-destructive/5",
                    )}
                  >
                    <span className="flex h-9 items-center justify-center text-xs text-muted-foreground">
                      {!c.empty && c.ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : idx + 1}
                    </span>

                    <div className="col-span-1 grid gap-2 md:col-span-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
                      <div>
                        <Input
                          ref={(el) => {
                            if (el) nameRefs.current.set(row.id, el);
                            else nameRefs.current.delete(row.id);
                          }}
                          aria-label="Ad Soyad"
                          placeholder="Ad Soyad"
                          aria-invalid={!!err("fullName")}
                          value={row.fullName}
                          onChange={(e) => update(row.id, { fullName: e.target.value })}
                        />
                        {err("fullName") && <p className="mt-0.5 text-[11px] text-destructive">{err("fullName")}</p>}
                      </div>
                      <div>
                        <div className="flex">
                          <span className="inline-flex h-9 shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                            {foreign ? "🌐" : "+90"}
                          </span>
                          <Input
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            aria-label="Telefon"
                            placeholder="5xx xxx xx xx"
                            aria-invalid={!!err("phone")}
                            className="rounded-l-none tabular-nums"
                            value={row.phone}
                            onChange={(e) => {
                              const v = e.target.value;
                              // Turkish numbers get spaced as you type; anything starting with "+" is left as typed.
                              update(row.id, { phone: v.trim().startsWith("+") ? v : formatTrPhone(phoneDigits(v).slice(0, 10)) });
                            }}
                          />
                        </div>
                        {err("phone") && <p className="mt-0.5 text-[11px] text-destructive">{err("phone")}</p>}
                      </div>
                      <div>
                        <Input
                          inputMode="numeric"
                          aria-label="TC Kimlik No"
                          placeholder="TC (opsiyonel)"
                          maxLength={11}
                          aria-invalid={!!err("tc")}
                          className="tabular-nums"
                          value={row.tc}
                          onChange={(e) => update(row.id, { tc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && idx === rows.length - 1) {
                              e.preventDefault();
                              addRow();
                            }
                          }}
                        />
                        {err("tc") && <p className="mt-0.5 text-[11px] text-destructive">{err("tc")}</p>}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Satırı sil"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={rows.length === 1}
                      onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={rows.length >= MAX_ROWS} onClick={() => addRow()}>
              <Plus className="size-4" /> Satır Ekle
            </Button>
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <b className="text-foreground">{valid.length}</b> hazır
              </span>
              {invalidCount > 0 && touched && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="size-3.5" /> {invalidCount} hatalı
                </span>
              )}
              <span>
                {rows.length} / {MAX_ROWS} satır
              </span>
            </p>
          </div>

          <Button
            className="w-full"
            disabled={bulkCreate.isPending || !effectiveBranchId || filled.length === 0}
            onClick={submit}
          >
            {bulkCreate.isPending ? "Ekleniyor…" : valid.length > 0 ? `${valid.length} Hastayı Ekle` : "Hastaları Ekle"}
          </Button>
          {!effectiveBranchId && branches && branches.length > 1 && (
            <p className="-mt-2 text-center text-xs text-muted-foreground">Önce şube seçin.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
