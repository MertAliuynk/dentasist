"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { AlertTriangle, CalendarClock, History, Pencil, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { needsAppointment, renderSample, smsSegments } from "@/lib/message-render";
import {
  AUTOMATION_PRESETS,
  TRIGGER_META,
  TRIGGERS,
  describeTiming,
  type AutomationTrigger,
  type TimingMode,
} from "@/lib/sms-automation";
import { SegmentInfo, TemplateEditor, TokenizedText } from "@/components/dental/messaging/template-editor";

const fmtTime = (d: string | Date) => new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(d));
const fmtDay = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(d));
const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

type Unit = "min" | "hour" | "day";
const UNIT_MIN: Record<Unit, number> = { min: 1, hour: 60, day: 1440 };
function splitMinutes(total: number): [number, Unit] {
  if (total > 0 && total % 1440 === 0) return [total / 1440, "day"];
  if (total > 0 && total % 60 === 0) return [total / 60, "hour"];
  return [total, "min"];
}

type RuleForm = {
  id?: string;
  name: string;
  trigger: AutomationTrigger;
  templateId: string | null;
  timingMode: TimingMode;
  offsetMinutes: number;
  dayOffset: number;
  sendTime: string | null;
  recallDays: number | null;
  enabled: boolean;
};

const EMPTY_RULE: RuleForm = {
  name: "",
  trigger: "APPOINTMENT_BEFORE",
  templateId: null,
  timingMode: "FIXED_TIME",
  offsetMinutes: 120,
  dayOffset: 1,
  sendTime: "18:00",
  recallDays: 180,
  enabled: true,
};

function Seg({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border border-input p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-xs transition-colors ${
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RuleDialogBody({ initial, onClose, clinicName }: { initial: RuleForm; onClose: () => void; clinicName?: string }) {
  const utils = trpc.useUtils();
  const [f, setF] = useState<RuleForm>(initial);
  const [amount, setAmount] = useState(() => splitMinutes(initial.offsetMinutes)[0]);
  const [unit, setUnit] = useState<Unit>(() => splitMinutes(initial.offsetMinutes)[1]);
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel: "SMS" });

  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const meta = TRIGGER_META[f.trigger];
  const offsetMinutes = Math.max(0, Math.round(amount * UNIT_MIN[unit]));
  const effective = { ...f, offsetMinutes };

  const changeTrigger = (t: AutomationTrigger) => {
    const m = TRIGGER_META[t];
    setF((p) => ({
      ...p,
      trigger: t,
      timingMode: m.modes.includes(p.timingMode) ? p.timingMode : m.modes[0],
      sendTime: p.sendTime ?? (t === "BIRTHDAY" ? "10:00" : "11:00"),
      name: p.name && !Object.values(TRIGGER_META).some((x) => x.label === p.name) ? p.name : m.label,
    }));
    if (t === "APPOINTMENT_CREATED") {
      setAmount(0);
      setUnit("min");
    }
  };

  const template = templates?.find((t) => t.id === f.templateId);
  const text = template?.body ?? meta.defaultText;
  const apptOnlyWarning = (f.trigger === "BIRTHDAY" || f.trigger === "RECALL") && needsAppointment(text);

  const onSuccess = () => {
    toast.success(f.id ? "Kural güncellendi." : "Otomatik mesaj oluşturuldu.");
    utils.messaging.automations.invalidate();
    utils.messaging.automationPlan.invalidate();
    utils.messageTemplate.list.invalidate({ channel: "SMS" });
    onClose();
  };
  const create = trpc.messaging.automationCreate.useMutation({ onSuccess, onError: (e) => toastError(e) });
  const update = trpc.messaging.automationUpdate.useMutation({ onSuccess, onError: (e) => toastError(e) });

  const payload = {
    name: f.name.trim(),
    trigger: f.trigger,
    templateId: f.templateId,
    timingMode: f.timingMode,
    offsetMinutes,
    dayOffset: f.dayOffset,
    sendTime: f.sendTime,
    recallDays: f.recallDays,
    enabled: f.enabled,
  };

  const dayWord = f.trigger === "APPOINTMENT_BEFORE" ? "önce" : "sonra";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{f.id ? "Otomatik Mesajı Düzenle" : "Yeni Otomatik Mesaj"}</DialogTitle>
      </DialogHeader>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>1. Ne zaman tetiklensin?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {TRIGGERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => changeTrigger(t)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  f.trigger === t ? "border-sky-500 bg-sky-500/10" : "border-border hover:bg-accent/50"
                }`}
              >
                <p className="text-sm font-medium">{TRIGGER_META[t].label}</p>
                <p className="text-xs text-muted-foreground">{TRIGGER_META[t].description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>2. Zamanlama</Label>
          {meta.modes.length > 1 && (
            <Seg
              value={f.timingMode}
              onChange={(v) => set("timingMode", v as TimingMode)}
              options={[
                { value: "RELATIVE", label: `Belirli süre ${dayWord}` },
                { value: "FIXED_TIME", label: "Belirli gün ve saatte" },
              ]}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {f.trigger === "RECALL" && (
              <>
                <span>Son ziyaretten</span>
                <Input
                  type="number"
                  min={7}
                  className="w-20"
                  value={f.recallDays ?? 180}
                  onChange={(e) => set("recallDays", Number(e.target.value) || 0)}
                />
                <span>gün sonra</span>
                {[90, 180, 365].map((d) => (
                  <Button key={d} type="button" size="xs" variant={f.recallDays === d ? "default" : "outline"} onClick={() => set("recallDays", d)}>
                    {d === 90 ? "3 ay" : d === 180 ? "6 ay" : "1 yıl"}
                  </Button>
                ))}
              </>
            )}

            {f.timingMode === "RELATIVE" && (
              <>
                {f.trigger === "APPOINTMENT_CREATED" && (
                  <Button type="button" size="xs" variant={offsetMinutes === 0 ? "default" : "outline"} onClick={() => setAmount(0)}>
                    Hemen
                  </Button>
                )}
                <span>{f.trigger === "APPOINTMENT_CREATED" ? "ya da" : f.trigger === "NO_SHOW" ? "Randevu saatinden" : f.trigger === "APPOINTMENT_AFTER" ? "Randevu bitiminden" : "Randevudan"}</span>
                <Input type="number" min={0} className="w-20" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
                <Select value={unit} onValueChange={(v) => setUnit((v as Unit) ?? "hour")}>
                  <SelectTrigger className="w-28">
                    <SelectValue>{(v: string) => ({ min: "dakika", hour: "saat", day: "gün" })[v as Unit]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">dakika</SelectItem>
                    <SelectItem value="hour">saat</SelectItem>
                    <SelectItem value="day">gün</SelectItem>
                  </SelectContent>
                </Select>
                <span>{dayWord}</span>
                {f.trigger === "APPOINTMENT_BEFORE" && (
                  <span className="flex gap-1">
                    {[
                      [1, "hour"],
                      [2, "hour"],
                      [3, "hour"],
                      [1, "day"],
                    ].map(([a, u]) => (
                      <Button
                        key={`${a}${u}`}
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setAmount(a as number);
                          setUnit(u as Unit);
                        }}
                      >
                        {a} {u === "hour" ? "sa" : "gün"}
                      </Button>
                    ))}
                  </span>
                )}
              </>
            )}

            {f.timingMode === "FIXED_TIME" && f.trigger !== "BIRTHDAY" && f.trigger !== "RECALL" && (
              <>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={f.dayOffset}
                  onChange={(e) => set("dayOffset", Math.max(0, Number(e.target.value) || 0))}
                />
                <span>gün {dayWord}</span>
                <span className="text-xs text-muted-foreground">(0 = randevu günü)</span>
              </>
            )}

            {f.timingMode === "FIXED_TIME" && (
              <>
                <span>saat</span>
                <Input type="time" className="w-28" value={f.sendTime ?? "09:00"} onChange={(e) => set("sendTime", e.target.value)} />
              </>
            )}
          </div>

          <p className="flex items-center gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-sm">
            <CalendarClock className="size-4 text-sky-600" />
            {describeTiming(effective)}
          </p>
          {(f.trigger === "APPOINTMENT_AFTER" || f.trigger === "NO_SHOW") && f.timingMode === "RELATIVE" && (
            <p className="text-xs text-muted-foreground">Gece 21:00 – sabah 09:00 arasına denk gelen mesajlar sabah 09:00&apos;a ertelenir.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>3. Hangi mesaj gitsin?</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={f.templateId ?? "DEFAULT"} onValueChange={(v) => set("templateId", !v || v === "DEFAULT" ? null : v)}>
              <SelectTrigger className="w-72">
                <SelectValue>{(v: string) => (v === "DEFAULT" ? "Varsayılan metin" : templates?.find((t) => t.id === v)?.name)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFAULT">Varsayılan metin</SelectItem>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Plus className="size-3.5" /> Yeni şablon yaz
            </Button>
          </div>
          <div className="space-y-1.5 rounded-md border border-border p-3">
            <TokenizedText body={text} className="text-sm" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5">
              <span className="text-xs text-muted-foreground">Örnek: {renderSample(text, clinicName).slice(0, 80)}…</span>
              <SegmentInfo text={renderSample(text, clinicName)} compact />
            </div>
          </div>
          {apptOnlyWarning && (
            <p className="flex gap-1.5 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              Bu metinde randevu bilgisi var ama bu tetikleyicide randevu olmaz — mesajlar gönderilmez. Randevu alanları olmayan bir şablon seçin.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label>4. Kural adı</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ör. Akşam hatırlatması" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} /> Aktif
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Kural açıldığı andan itibaren geçerlidir; geçmişte kaçırılan olaylar için toplu mesaj atılmaz. &quot;Otomatik SMS almak
          istemiyor&quot; işaretli hastalara gönderilmez.
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          disabled={!f.name.trim() || create.isPending || update.isPending || apptOnlyWarning}
          onClick={() => (f.id ? update.mutate({ id: f.id, data: payload }) : create.mutate(payload))}
        >
          {f.id ? "Kaydet" : "Oluştur"}
        </Button>
      </DialogFooter>
      <TemplateEditor
        channel="SMS"
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editing={{ name: f.name || meta.label, body: text }}
        clinicName={clinicName}
        onSaved={(id) => id && set("templateId", id)}
      />
    </>
  );
}

export function AutomationsTab({ clinicName, onShowHistory }: { clinicName?: string; onShowHistory: (automationId: string) => void }) {
  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.messaging.automations.useQuery();
  const [dialog, setDialog] = useState<RuleForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = () => {
    utils.messaging.automations.invalidate();
    utils.messaging.automationPlan.invalidate();
  };
  const toggle = trpc.messaging.automationSetEnabled.useMutation({
    onSuccess: (_r, v) => {
      toast.success(v.enabled ? "Otomatik mesaj açıldı." : "Otomatik mesaj durduruldu.");
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const remove = trpc.messaging.automationDelete.useMutation({
    onSuccess: () => {
      toast.success("Kural silindi.");
      setConfirmDelete(null);
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const fromPreset = trpc.messaging.automationFromPreset.useMutation({
    onSuccess: (r) => {
      toast.success(`"${r.name}" eklendi ve aktif. Metni Şablonlar sekmesinden düzenleyebilirsiniz.`);
      refresh();
      utils.messageTemplate.list.invalidate({ channel: "SMS" });
    },
    onError: (e) => toastError(e),
  });

  const usedNames = new Set(rules?.map((r) => r.name));
  const presets = AUTOMATION_PRESETS.filter((p) => !usedNames.has(p.name));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-amber-500" /> Otomatik Mesajlar
            </CardTitle>
            <CardDescription>Kurduğunuz kurallar her 5 dakikada bir kontrol edilir; zamanı gelen SMS&apos;ler siz bir şey yapmadan gider.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialog(EMPTY_RULE)}>
            <Plus className="size-4" /> Yeni Kural
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !rules || rules.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Henüz otomatik mesaj yok. Aşağıdaki hazır kurallardan başlayabilirsiniz.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rules.map((r) => {
                const text = r.template?.body ?? TRIGGER_META[r.trigger].defaultText;
                return (
                  <div key={r.id} className={`rounded-lg border p-3 ${r.enabled ? "border-border" : "border-dashed border-border opacity-70"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {r.name}
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {TRIGGER_META[r.trigger].label}
                          </Badge>
                        </p>
                        <p className="flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-300">
                          <CalendarClock className="size-3.5" /> {describeTiming(r)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Switch checked={r.enabled} disabled={toggle.isPending} onCheckedChange={(enabled) => toggle.mutate({ id: r.id, enabled })} />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Düzenle"
                          onClick={() =>
                            setDialog({
                              id: r.id,
                              name: r.name,
                              trigger: r.trigger,
                              templateId: r.templateId,
                              timingMode: r.timingMode,
                              offsetMinutes: r.offsetMinutes,
                              dayOffset: r.dayOffset,
                              sendTime: r.sendTime,
                              recallDays: r.recallDays,
                              enabled: r.enabled,
                            })
                          }
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {confirmDelete === r.id ? (
                          <Button variant="destructive" size="xs" disabled={remove.isPending} onClick={() => remove.mutate({ id: r.id })}>
                            Sil?
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => setConfirmDelete(r.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 rounded-md bg-muted/50 p-2">
                      <p className="mb-1 text-[11px] text-muted-foreground">{r.template ? `Şablon: ${r.template.name}` : "Varsayılan metin"}</p>
                      <TokenizedText body={text} className="line-clamp-3 text-sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Son 30 gün:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{r.stats30d.sent} gönderildi</span>
                      {r.stats30d.failed > 0 && <span className="text-destructive">{r.stats30d.failed} başarısız</span>}
                      {r.stats30d.skipped > 0 && <span>{r.stats30d.skipped} atlandı</span>}
                      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onShowHistory(r.id)}>
                        <History className="size-3" /> Geçmişi gör
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {presets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" /> Hazır Kurallar
            </CardTitle>
            <CardDescription>Tek tıkla ekleyin — metni ve zamanlamayı sonra istediğiniz gibi değiştirebilirsiniz.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {presets.map((p) => (
              <div key={p.key} className="flex flex-col justify-between gap-2 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.hint}</p>
                </div>
                <Button size="sm" variant="outline" disabled={fromPreset.isPending} onClick={() => fromPreset.mutate({ key: p.key })}>
                  <Plus className="size-3.5" /> Ekle
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          {dialog && <RuleDialogBody key={dialog.id ?? "new"} initial={dialog} onClose={() => setDialog(null)} clinicName={clinicName} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PlanTab() {
  const [hours, setHours] = useState(48);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, refetch, isFetching } = trpc.messaging.automationPlan.useQuery({ hours });

  const sendable = data?.filter((p) => !p.warning) ?? [];
  const credits = sendable.reduce((sum, p) => sum + (p.text ? smsSegments(p.text).segments : 0), 0);
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const p of data ?? []) {
    const key = new Date(p.sendAt).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Planlanan Gönderimler</CardTitle>
          <CardDescription>
            Otomatik mesajların kime, ne zaman, hangi metinle gideceği. Randevular değiştikçe liste de güncellenir.
          </CardDescription>
        </div>
        <div className="flex gap-1.5">
          {[
            [24, "24 saat"],
            [48, "48 saat"],
            [168, "7 gün"],
          ].map(([h, l]) => (
            <Button key={h} size="sm" variant={hours === h ? "default" : "outline"} onClick={() => setHours(h as number)}>
              {l}
            </Button>
          ))}
          <Button size="sm" variant="ghost" disabled={isFetching} onClick={() => refetch()}>
            Yenile
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data && data.length > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md border border-border p-2">
              <p className="text-xl font-semibold tabular-nums">{sendable.length}</p>
              <p className="text-xs text-muted-foreground">gidecek SMS</p>
            </div>
            <div className="rounded-md border border-border p-2">
              <p className="text-xl font-semibold tabular-nums">{credits}</p>
              <p className="text-xs text-muted-foreground">tahmini kredi</p>
            </div>
            <div className="rounded-md border border-border p-2">
              <p className="text-xl font-semibold tabular-nums">{data.length - sendable.length}</p>
              <p className="text-xs text-muted-foreground">atlanacak</p>
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Hesaplanıyor…</p>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu aralıkta planlanmış otomatik mesaj yok.</p>
        ) : (
          [...groups.entries()].map(([key, items]) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fmtDay(items[0].sendAt)}</p>
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {items.map((p) => {
                  const id = `${p.automationId}-${p.patient.id}-${String(p.sendAt)}`;
                  return (
                    <div key={id}>
                      <button className="flex w-full flex-col gap-1 px-3 py-2 text-left text-sm hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between" onClick={() => setExpanded(expanded === id ? null : id)}>
                        <span className="min-w-0">
                          <span className="font-mono tabular-nums">{p.due ? "Sırada" : fmtTime(p.sendAt)}</span>{" "}
                          <span className="font-medium">{p.patient.fullName}</span>
                          <span className="text-muted-foreground"> · {p.patient.phone}</span>
                          {p.appointment && <span className="text-muted-foreground"> · randevu {fmtDateTime(p.appointment.startsAt)}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {p.ruleName}
                          </Badge>
                          {p.warning && (
                            <Badge variant="destructive" className="text-[10px]">
                              {p.warning}
                            </Badge>
                          )}
                        </span>
                      </button>
                      {expanded === id && p.text && <p className="border-t border-border bg-muted/40 px-3 py-2 text-sm">{p.text}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
