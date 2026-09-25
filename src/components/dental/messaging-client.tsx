"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/trpc/routers/_app";

type Channel = "SMS" | "WHATSAPP";

const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{ad}", label: "Hasta Adı" },
  { token: "{randevu_tarihi}", label: "Randevu Tarihi" },
  { token: "{randevu_saati}", label: "Randevu Saati" },
  { token: "{hekim}", label: "Hekim Adı" },
  { token: "{klinik}", label: "Klinik Adı" },
];

const CHANNEL_META: Record<Channel, { title: string; accent: string; sendLabel: string; description: string }> = {
  SMS: {
    title: "SMS Hizmetleri",
    accent: "text-sky-600 dark:text-sky-400",
    sendLabel: "SMS Gönder",
    description:
      "NetGSM hesabınız üzerinden hastalarınıza SMS gönderin; randevu hatırlatmaları otomatik gider. SMS ücreti NetGSM hesabınızdan düşer.",
  },
  WHATSAPP: {
    title: "WhatsApp Hizmetleri",
    accent: "text-emerald-600 dark:text-emerald-400",
    sendLabel: "WhatsApp'ta Aç",
    description:
      "Mesaj hazır doldurulmuş olarak WhatsApp'ta (Web veya telefon) açılır; siz sadece Gönder'e basarsınız. Ek ücret veya kurulum gerekmez.",
  },
};

const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
const fmtTime = (d: string | Date) => new Intl.DateTimeFormat("tr-TR", { timeStyle: "short" }).format(new Date(d));
const fmtDay = (d: string | Date) => new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(d));

/**
 * window.open after an await gets popup-blocked, so open a blank tab
 * synchronously on click and point it at wa.me once the server answers.
 */
function useWhatsappOpener() {
  const open = trpc.messaging.openWhatsapp.useMutation();
  return {
    isPending: open.isPending,
    run: (input: Parameters<typeof open.mutate>[0], onDone?: () => void) => {
      const win = window.open("about:blank", "_blank");
      open.mutate(input, {
        onSuccess: ({ url }) => {
          if (win) win.location.href = url;
          else window.location.href = url;
          onDone?.();
        },
        onError: (e) => {
          win?.close();
          toast.error(e.message);
        },
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Templates

function TemplateDialog({
  channel,
  open,
  onOpenChange,
  editing,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: { id: string; name: string; body: string } | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const onSaved = (msg: string) => {
    toast.success(msg);
    utils.messageTemplate.list.invalidate({ channel });
    onOpenChange(false);
  };
  const create = trpc.messageTemplate.create.useMutation({ onSuccess: () => onSaved("Şablon eklendi."), onError: (e) => toast.error(e.message) });
  const update = trpc.messageTemplate.update.useMutation({ onSuccess: () => onSaved("Şablon güncellendi."), onError: (e) => toast.error(e.message) });

  function insertPlaceholder(token: string) {
    const el = textareaRef.current;
    if (!el) return setBody((b) => `${b}${token}`);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function handleOpenChange(o: boolean) {
    if (o) {
      setName(editing?.name ?? "");
      setBody(editing?.body ?? "");
    }
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Şablonu Düzenle" : "Yeni Mesaj Şablonu"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Şablon Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. Randevu Hatırlatma" />
          </div>
          <div className="space-y-2">
            <Label>Mesaj İçeriği</Label>
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Sayın {ad}, {randevu_tarihi} günü saat {randevu_saati} {klinik} randevunuzu hatırlatırız."
            />
            {channel === "SMS" && (
              <p className="text-xs text-muted-foreground">
                {body.length} karakter · ~155 karakteri aşan mesajlar birden fazla SMS olarak ücretlendirilir (değişkenler dolunca metin uzar).
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" />
              Tıklayarak ekleyin
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => insertPlaceholder(p.token)}
                  className="rounded-full border border-dashed border-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  {p.token} <span className="text-muted-foreground/70">· {p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!name.trim() || !body.trim() || create.isPending || update.isPending}
            onClick={() =>
              editing
                ? update.mutate({ id: editing.id, name: name.trim(), body: body.trim() })
                : create.mutate({ channel, name: name.trim(), body: body.trim() })
            }
          >
            {editing ? "Kaydet" : "Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesTab({ channel, canManage }: { channel: Channel; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; body: string } | null>(null);
  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel });
  const utils = trpc.useUtils();

  const remove = trpc.messageTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success("Şablon silindi.");
      utils.messageTemplate.list.invalidate({ channel });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Mesaj Şablonları</CardTitle>
          <CardDescription>Sık kullanılan mesajları şablon olarak kaydedin.</CardDescription>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Yeni Şablon
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!templates || templates.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Henüz şablon eklenmemiş.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{t.name}</p>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Düzenle"
                        onClick={() => {
                          setEditing({ id: t.id, name: t.name, body: t.body });
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove.mutate({ id: t.id })}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <TemplateDialog
        channel={channel}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Send

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SendTab({ channel, initialPatientId, smsConnected }: { channel: Channel; initialPatientId?: string; smsConnected: boolean | null }) {
  const meta = CHANNEL_META[channel];
  const utils = trpc.useUtils();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(initialPatientId ?? null);
  const [templateId, setTemplateId] = useState("");
  const [customBody, setCustomBody] = useState("");
  const debouncedBody = useDebounced(customBody, 300);

  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel });
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: patientSearch.trim().length > 0 && !patientId },
  );
  const hasContent = templateId !== "" || debouncedBody.trim() !== "";
  const { data: preview, isFetching: previewLoading } = trpc.messaging.preview.useQuery(
    { patientId: patientId ?? "", templateId: templateId || undefined, body: templateId ? undefined : debouncedBody },
    { enabled: !!patientId, placeholderData: (prev) => prev },
  );

  const sendSms = trpc.messaging.sendSms.useMutation({
    onSuccess: () => {
      toast.success("SMS gönderildi.");
      setCustomBody("");
      utils.messaging.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const wa = useWhatsappOpener();

  const canSend = !!patientId && hasContent && !!preview?.text && !preview.error && preview.phoneValid;

  function handleSend() {
    if (!patientId) return;
    const input = { patientId, templateId: templateId || undefined, body: templateId ? undefined : customBody };
    if (channel === "SMS") sendSms.mutate(input);
    else wa.run(input, () => utils.messaging.history.invalidate());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mesaj Gönder</CardTitle>
        <CardDescription>
          Hasta ve şablon seçin; {"{randevu_*}"} alanları hastanın yaklaşan randevusundan otomatik doldurulur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {channel === "SMS" && smsConnected === false && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>SMS gönderebilmek için önce <b>Ayarlar</b> sekmesinden NetGSM hesabınızı bağlayın.</span>
          </div>
        )}
        <div className="space-y-2">
          <Label>Hasta</Label>
          {patientId ? (
            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              <span>
                {preview?.patient.fullName ?? "…"}
                <span className="ml-2 text-muted-foreground">{preview?.patient.phone}</span>
                {preview && !preview.phoneValid && <span className="ml-2 text-xs text-destructive">(geçerli cep numarası değil)</span>}
              </span>
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
                        setPatientSearch("");
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

        <div className="space-y-2">
          <Label>Şablon</Label>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "", name: "Serbest metin" }, ...(templates ?? [])].map((t) => (
              <button
                key={t.id || "free"}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  templateId === t.id ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {templateId === "" && (
          <div className="space-y-2">
            <Label>Mesaj</Label>
            <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={4} placeholder="Sayın {ad}, …" />
          </div>
        )}

        {patientId && hasContent && preview && (
          <div className="space-y-2 rounded-md border border-dashed border-input p-3">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary">Önizleme</Badge>
              <span className="text-xs text-muted-foreground">
                {previewLoading ? "güncelleniyor…" : `${preview.text.length} karakter`}
              </span>
            </div>
            {preview.error ? (
              <p className="text-sm text-destructive">{preview.error}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{preview.text}</p>
            )}
            {preview.appointment && (
              <p className="text-xs text-muted-foreground">
                Randevu: {fmtDateTime(preview.appointment.startsAt)} · {preview.appointment.doctorName}
              </p>
            )}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!canSend || sendSms.isPending || wa.isPending || (channel === "SMS" && smsConnected === false)}
          onClick={handleSend}
        >
          {channel === "SMS" ? <Send className="size-4" /> : <ExternalLink className="size-4" />}
          {meta.sendLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reminders (upcoming appointments)

function RemindersTab({ channel, smsConnected, remindersEnabled }: { channel: Channel; smsConnected: boolean | null; remindersEnabled: boolean | null }) {
  const [days, setDays] = useState(1);
  const [waTemplateId, setWaTemplateId] = useState("");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.messaging.upcoming.useQuery({ days });
  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel: "WHATSAPP" }, { enabled: channel === "WHATSAPP" });
  const wa = useWhatsappOpener();

  const sendSms = trpc.messaging.sendSms.useMutation({
    onSuccess: () => {
      toast.success("Hatırlatma SMS'i gönderildi.");
      utils.messaging.upcoming.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Group by day for a readable list.
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const a of data ?? []) {
    const key = new Date(a.startsAt).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Yaklaşan Randevular</CardTitle>
          <CardDescription>
            {channel === "SMS"
              ? remindersEnabled
                ? "Otomatik SMS hatırlatması açık — randevudan önce ayarladığınız sürede kendiliğinden gönderilir."
                : "Otomatik SMS hatırlatması kapalı. Ayarlar sekmesinden açabilir veya aşağıdan tek tek gönderebilirsiniz."
              : "Her randevu için tek tıkla hatırlatma mesajını WhatsApp'ta açın."}
          </CardDescription>
        </div>
        <div className="flex gap-1.5">
          {[
            { d: 0, label: "Bugün" },
            { d: 1, label: "Yarına kadar" },
            { d: 7, label: "7 gün" },
          ].map((o) => (
            <Button key={o.d} size="sm" variant={days === o.d ? "default" : "outline"} onClick={() => setDays(o.d)}>
              {o.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {channel === "WHATSAPP" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Kullanılacak mesaj:</span>
            <Select value={waTemplateId || "DEFAULT"} onValueChange={(v) => setWaTemplateId(!v || v === "DEFAULT" ? "" : v)}>
              <SelectTrigger className="w-64">
                <SelectValue>{(v: string) => (v === "DEFAULT" ? "Varsayılan hatırlatma" : templates?.find((t) => t.id === v)?.name)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFAULT">Varsayılan hatırlatma</SelectItem>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu aralıkta planlanmış randevu yok.</p>
        ) : (
          [...groups.entries()].map(([key, items]) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fmtDay(items[0].startsAt)}</p>
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {items.map((a) => {
                  const last = channel === "SMS" ? a.lastSms : a.lastWhatsapp;
                  return (
                    <div key={a.id} className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p>
                          <span className="font-mono tabular-nums">{fmtTime(a.startsAt)}</span>{" "}
                          <span className="font-medium">{a.patient.fullName}</span>
                          <span className="text-muted-foreground"> · {a.doctorName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.patient.phone}
                          {!a.phoneValid && <span className="text-destructive"> · geçerli cep numarası değil</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {last?.status === "SENT" && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="size-3" /> {last.kind === "REMINDER" ? "Otomatik gönderildi" : "Gönderildi"} {fmtTime(last.createdAt)}
                          </Badge>
                        )}
                        {last?.status === "OPENED" && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="size-3" /> Açıldı {fmtTime(last.createdAt)}
                          </Badge>
                        )}
                        {last?.status === "FAILED" && (
                          <Badge variant="destructive" title={last.errorMessage ?? ""}>
                            Başarısız
                          </Badge>
                        )}
                        {channel === "SMS" && !last && remindersEnabled && smsConnected && a.phoneValid && (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="size-3" /> Otomatik gidecek
                          </Badge>
                        )}
                        {channel === "SMS" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!smsConnected || !a.phoneValid || sendSms.isPending}
                            onClick={() => sendSms.mutate({ patientId: a.patient.id, appointmentId: a.id, reminder: true })}
                          >
                            <Send className="size-3.5" /> {last ? "Tekrar Gönder" : "Şimdi Gönder"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={last ? "outline" : "default"}
                            disabled={!a.phoneValid || wa.isPending}
                            onClick={() =>
                              wa.run(
                                {
                                  patientId: a.patient.id,
                                  appointmentId: a.id,
                                  kind: "REMINDER",
                                  ...(waTemplateId ? { templateId: waTemplateId } : { reminder: true }),
                                },
                                () => utils.messaging.upcoming.invalidate(),
                              )
                            }
                          >
                            <ExternalLink className="size-3.5" /> WhatsApp&apos;tan Hatırlat
                          </Button>
                        )}
                      </div>
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

// ---------------------------------------------------------------------------
// History

const KIND_LABEL = { MANUAL: "Manuel", REMINDER: "Hatırlatma", TEST: "Test" } as const;

function HistoryTab({ channel }: { channel: Channel }) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = trpc.messaging.history.useInfiniteQuery(
    { channel, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor },
  );
  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gönderim Geçmişi</CardTitle>
        <CardDescription>
          {channel === "SMS" ? "Gönderilen ve başarısız olan tüm SMS'ler." : "WhatsApp'ta açılan mesajlar (gönderimi telefonda siz onaylarsınız)."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Henüz gönderim yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {logs.map((l) => (
              <div key={l.id} className="space-y-1 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(l.createdAt)}</span>
                  <span className="font-medium">{l.patient?.fullName ?? l.phone}</span>
                  <Badge variant="outline">{KIND_LABEL[l.kind]}</Badge>
                  <Badge variant={l.status === "FAILED" ? "destructive" : "secondary"}>
                    {l.status === "SENT" ? "Gönderildi" : l.status === "OPENED" ? "Açıldı" : "Başarısız"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{l.sentBy?.name ?? (l.kind === "REMINDER" ? "Sistem" : "")}</span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{l.body}</p>
                {l.errorMessage && <p className="text-xs text-destructive">{l.errorMessage}</p>}
              </div>
            ))}
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
// SMS settings (NetGSM)

type SmsSettingsData = inferRouterOutputs<AppRouter>["messaging"]["smsSettings"];

function SmsSettingsTab() {
  const { data: s, isLoading } = trpc.messaging.smsSettings.useQuery();
  if (isLoading || !s) return <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  // Remount the form whenever the saved settings change so its fields
  // start from the stored values.
  return <SmsSettingsPanel key={`${s.connected}-${String(s.lastVerifiedAt)}-${s.reminderTemplateId}`} s={s} />;
}

function SmsSettingsPanel({ s }: { s: SmsSettingsData }) {
  const utils = trpc.useUtils();
  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel: "SMS" });

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(s.username);
  const [password, setPassword] = useState("");
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [msgheader, setMsgheader] = useState(s.msgheader);
  const [hours, setHours] = useState(s.reminderHoursBefore);
  const [templateId, setTemplateId] = useState<string | null>(s.reminderTemplateId);
  const [testPhone, setTestPhone] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refresh = () => utils.messaging.smsSettings.invalidate();
  const fetchHeaders = trpc.messaging.smsFetchHeaders.useMutation({
    onSuccess: ({ headers }) => {
      setHeaders(headers);
      if (headers.length === 0) toast.warning("Bağlantı başarılı ama hesabınızda onaylı SMS başlığı bulunamadı. Başlığı elle yazabilirsiniz.");
      else {
        toast.success("Bağlantı başarılı.");
        if (!headers.includes(msgheader)) setMsgheader(headers[0]);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const save = trpc.messaging.smsSave.useMutation({
    onSuccess: () => {
      toast.success("SMS ayarları kaydedildi.");
      setEditing(false);
      setPassword("");
      setHeaders(null);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const setReminders = trpc.messaging.smsSetReminders.useMutation({
    onSuccess: (_r, v) => {
      toast.success(v.enabled ? "Otomatik hatırlatma açıldı." : "Otomatik hatırlatma kapatıldı.");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const sendTest = trpc.messaging.smsSendTest.useMutation({
    onSuccess: () => toast.success("Test SMS'i gönderildi."),
    onError: (e) => toast.error(e.message),
  });
  const disconnect = trpc.messaging.smsDisconnect.useMutation({
    onSuccess: () => {
      toast.success("SMS hesabı bağlantısı kaldırıldı.");
      setConfirmDisconnect(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const showForm = !s.connected || editing;

  return (
    <div className="flex flex-col gap-4">
      {s.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" /> NetGSM Bağlı
            </CardTitle>
            <CardDescription>
              Kullanıcı: {s.username} · Başlık: <b>{s.msgheader}</b>
              {s.lastVerifiedAt && ` · Son doğrulama: ${fmtDateTime(s.lastVerifiedAt)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
              <span>
                <span className="font-medium">Otomatik randevu hatırlatma</span>
                <span className="block text-xs text-muted-foreground">
                  Randevudan {s.reminderHoursBefore} saat önce, planlanmış (gelmedi/iptal olmayan) randevulara SMS gider.
                </span>
              </span>
              <Switch
                checked={s.remindersEnabled}
                disabled={setReminders.isPending}
                onCheckedChange={(enabled) => setReminders.mutate({ enabled })}
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Test SMS&apos;i gönder</Label>
                <Input className="w-48" placeholder="05xx xxx xx xx" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
              </div>
              <Button variant="outline" disabled={testPhone.length < 10 || sendTest.isPending} onClick={() => sendTest.mutate({ phone: testPhone })}>
                <Send className="size-4" /> Test Gönder
              </Button>
              <div className="flex-1" />
              {!editing && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Düzenle
                </Button>
              )}
              {!confirmDisconnect ? (
                <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDisconnect(true)}>
                  Bağlantıyı Kaldır
                </Button>
              ) : (
                <span className="flex items-center gap-1">
                  <Button variant="destructive" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                    Evet, kaldır
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                    Vazgeç
                  </Button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{s.connected ? "Ayarları Düzenle" : "NetGSM Hesabını Bağla"}</CardTitle>
            <CardDescription>
              SMS&apos;ler kliniğinizin kendi NetGSM hesabından, onaylı başlığınızla gönderilir; ücret NetGSM kredinizden düşer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!s.connected && (
              <ol className="list-decimal space-y-1 rounded-md bg-muted/50 p-3 pl-7 text-xs text-muted-foreground">
                <li>netgsm.com.tr üzerinden bir SMS paketi alın ve SMS başlığınızı (gönderen adı) onaylatın.</li>
                <li>NetGSM panelinde API erişimi açık bir kullanıcı oluşturun (güvenlik için ana hesap yerine API alt kullanıcısı önerilir). IP kısıtlaması varsa sunucu IP&apos;mizi ekleyin.</li>
                <li>Kullanıcı adı (genelde 850… ile başlayan abone no) ve şifreyi aşağıya girip &quot;Bağlan&quot;a basın.</li>
              </ol>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Kullanıcı Adı</Label>
                <Input value={username} autoComplete="off" onChange={(e) => { setUsername(e.target.value); setHeaders(null); }} />
              </div>
              <div className="space-y-1">
                <Label>Şifre</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={s.connected ? "Değiştirmeyecekseniz boş bırakın" : ""}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setHeaders(null); }}
                />
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={!username.trim() || (!s.connected && !password) || fetchHeaders.isPending}
              onClick={() => fetchHeaders.mutate({ username: username.trim(), password: password || undefined })}
            >
              {fetchHeaders.isPending ? "Bağlanıyor…" : "Bağlan ve Başlıkları Getir"}
            </Button>

            {(headers !== null || s.connected) && (
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>SMS Başlığı</Label>
                  {headers && headers.length > 0 ? (
                    <Select value={msgheader} onValueChange={(v) => setMsgheader(v ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={msgheader} maxLength={20} onChange={(e) => setMsgheader(e.target.value)} />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Hatırlatma Zamanı</Label>
                  <Select value={String(hours)} onValueChange={(v) => setHours(Number(v ?? 24))}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: string) => `Randevudan ${v} saat önce`}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 4, 12, 24, 48].map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          Randevudan {h} saat önce
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Hatırlatma Mesajı</Label>
                  <Select value={templateId ?? "DEFAULT"} onValueChange={(v) => setTemplateId(!v || v === "DEFAULT" ? null : v)}>
                    <SelectTrigger className="w-full">
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
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Mesaj: {templateId ? templates?.find((t) => t.id === templateId)?.body : s.defaultReminderText}
                </p>
                <div className="flex gap-2 sm:col-span-3">
                  <Button
                    disabled={!username.trim() || !msgheader.trim() || save.isPending}
                    onClick={() =>
                      save.mutate({
                        username: username.trim(),
                        password: password || undefined,
                        msgheader: msgheader.trim(),
                        reminderHoursBefore: hours,
                        reminderTemplateId: templateId,
                      })
                    }
                  >
                    {save.isPending ? "Doğrulanıyor…" : "Kaydet"}
                  </Button>
                  {s.connected && (
                    <Button variant="ghost" onClick={() => { setEditing(false); setHeaders(null); setPassword(""); }}>
                      Vazgeç
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Randevu hatırlatmaları &quot;bilgilendirme&quot; mesajı olarak gönderilir ve İYS onayı gerektirmez. Kampanya/tanıtım
        amaçlı toplu SMS için İYS kaydı gerekir — bu ekrandan kampanya mesajı göndermeyin.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MessagingClient({ channel, initialPatientId }: { channel: Channel; initialPatientId?: string }) {
  const meta = CHANNEL_META[channel];
  const { data: me } = trpc.user.me.useQuery();
  const can = (cap: Parameters<typeof hasCapability>[1]) =>
    me ? hasCapability(me.memberships.map((m) => m.role), cap, me.capabilityOverrides) : false;
  const canManage = can("dental:messaging:manage");
  const canSend = can("dental:messaging:send");
  const canSettings = can("dental:messaging:settings");

  const { data: smsSettings } = trpc.messaging.smsSettings.useQuery(undefined, { enabled: channel === "SMS" && canSettings });
  // Only settings-capable users can read the account; for others assume
  // connected and let the server report a missing account on send.
  const smsConnected = channel !== "SMS" ? null : canSettings ? (smsSettings ? smsSettings.connected : null) : true;
  const remindersEnabled = canSettings ? (smsSettings?.remindersEnabled ?? null) : null;

  const defaultTab = canSend ? (initialPatientId ? "gonder" : channel === "SMS" && canSettings && smsSettings && !smsSettings.connected ? "ayarlar" : "hatirlatmalar") : "sablonlar";
  const [tab, setTab] = useState<string | null>(null);

  if (!me) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className={`text-base ${meta.accent}`}>{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={tab ?? defaultTab} onValueChange={(v) => setTab(v as string)}>
        <div className="overflow-x-auto">
          <TabsList>
            {canSend && <TabsTrigger value="hatirlatmalar">Hatırlatmalar</TabsTrigger>}
            {canSend && <TabsTrigger value="gonder">Gönder</TabsTrigger>}
            <TabsTrigger value="sablonlar">Şablonlar</TabsTrigger>
            {canSend && <TabsTrigger value="gecmis">Geçmiş</TabsTrigger>}
            {channel === "SMS" && canSettings && (
              <TabsTrigger value="ayarlar">
                Ayarlar
                {smsSettings && !smsSettings.connected && <span className="ml-1 size-1.5 rounded-full bg-amber-500" />}
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        {canSend && (
          <TabsContent value="hatirlatmalar">
            <RemindersTab channel={channel} smsConnected={smsConnected} remindersEnabled={remindersEnabled} />
          </TabsContent>
        )}
        {canSend && (
          <TabsContent value="gonder">
            <SendTab channel={channel} initialPatientId={initialPatientId} smsConnected={smsConnected} />
          </TabsContent>
        )}
        <TabsContent value="sablonlar">
          <TemplatesTab channel={channel} canManage={canManage} />
        </TabsContent>
        {canSend && (
          <TabsContent value="gecmis">
            <HistoryTab channel={channel} />
          </TabsContent>
        )}
        {channel === "SMS" && canSettings && (
          <TabsContent value="ayarlar">
            <SmsSettingsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
