"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { AlertTriangle, CheckCircle2, ExternalLink, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";
import { MESSAGE_TOKENS } from "@/lib/message-render";
import { SegmentInfo, TemplatesTab, type Channel } from "@/components/dental/messaging/template-editor";
import { AutomationsTab, PlanTab } from "@/components/dental/messaging/sms-automations";
import { SmsAccountTab, SmsSetup } from "@/components/dental/messaging/sms-account";

const CHANNEL_META: Record<Channel, { title: string; accent: string; sendLabel: string; description: string }> = {
  SMS: {
    title: "SMS Hizmetleri",
    accent: "text-sky-600 dark:text-sky-400",
    sendLabel: "SMS Gönder",
    description:
      "NetGSM hesabınız üzerinden hastalarınıza SMS gönderin; hatırlatma, onay, doğum günü ve kontrol mesajları otomatik gitsin.",
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
          toastError(e);
        },
      });
    },
  };
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Send

function SendTab({ channel, initialPatientId }: { channel: Channel; initialPatientId?: string }) {
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
    onError: (e) => toastError(e),
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
        <CardDescription>Tek bir hastaya şablondan veya serbest metinle mesaj gönderin.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          {preview?.patient.smsOptOut && channel === "SMS" && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="size-3.5" /> Bu hasta otomatik SMS almak istemediğini belirtmiş. Manuel gönderim yine de mümkün.
            </p>
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
            <div className="flex flex-wrap gap-1">
              {MESSAGE_TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => setCustomBody((b) => `${b}${b && !/\s$/.test(b) ? " " : ""}${t.token}`)}
                  className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-700 hover:bg-sky-500/25 dark:text-sky-300"
                >
                  + {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {patientId && hasContent && preview && (
          <div className="space-y-2 rounded-md border border-dashed border-input p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Önizleme</Badge>
              {previewLoading ? (
                <span className="text-xs text-muted-foreground">güncelleniyor…</span>
              ) : channel === "SMS" ? (
                <SegmentInfo text={preview.text} />
              ) : null}
            </div>
            {preview.error ? (
              <p className="text-sm text-destructive">{preview.error}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{preview.text}</p>
            )}
            {preview.appointment && (
              <p className="text-xs text-muted-foreground">
                Randevu bilgisi: {fmtDateTime(preview.appointment.startsAt)} · {preview.appointment.doctorName}
              </p>
            )}
          </div>
        )}

        <Button className="w-full" disabled={!canSend || sendSms.isPending || wa.isPending} onClick={handleSend}>
          {channel === "SMS" ? <Send className="size-4" /> : <ExternalLink className="size-4" />}
          {meta.sendLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp: one-click reminders for upcoming appointments

function WhatsappRemindersTab() {
  const [days, setDays] = useState(1);
  const [templateId, setTemplateId] = useState("");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.messaging.upcoming.useQuery({ days });
  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel: "WHATSAPP" });
  const wa = useWhatsappOpener();

  const groups = new Map<string, NonNullable<typeof data>>();
  for (const a of data ?? []) {
    const key = new Date(a.startsAt).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const pending = data?.filter((a) => !a.lastWhatsapp && a.phoneValid).length ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Randevu Hatırlatmaları</CardTitle>
          <CardDescription>
            Her randevu için tek tıkla hatırlatma mesajını WhatsApp&apos;ta açın.{pending > 0 && ` ${pending} hastaya henüz hatırlatma yapılmadı.`}
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
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Kullanılacak mesaj:</span>
          <Select value={templateId || "DEFAULT"} onValueChange={(v) => setTemplateId(!v || v === "DEFAULT" ? "" : v)}>
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

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !data || data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu aralıkta planlanmış randevu yok.</p>
        ) : (
          [...groups.entries()].map(([key, items]) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{fmtDay(items[0].startsAt)}</p>
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {items.map((a) => (
                  <div key={a.id} className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p>
                        <span className="font-mono tabular-nums">{fmtTime(a.startsAt)}</span> <span className="font-medium">{a.patient.fullName}</span>
                        <span className="text-muted-foreground"> · {a.doctorName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.patient.phone}
                        {!a.phoneValid && <span className="text-destructive"> · geçerli cep numarası değil</span>}
                        {a.lastSms?.status === "SENT" && <span> · SMS hatırlatması gitti</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.lastWhatsapp && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3" /> Açıldı {fmtTime(a.lastWhatsapp.createdAt)}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant={a.lastWhatsapp ? "outline" : "default"}
                        disabled={!a.phoneValid || wa.isPending}
                        onClick={() =>
                          wa.run(
                            {
                              patientId: a.patient.id,
                              appointmentId: a.id,
                              kind: "REMINDER",
                              ...(templateId ? { templateId } : { reminder: true }),
                            },
                            () => utils.messaging.upcoming.invalidate(),
                          )
                        }
                      >
                        <ExternalLink className="size-3.5" /> WhatsApp&apos;tan Hatırlat
                      </Button>
                    </div>
                  </div>
                ))}
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

const KIND_LABEL = { MANUAL: "Manuel", REMINDER: "Hatırlatma", TEST: "Test", AUTOMATION: "Otomatik" } as const;
const STATUS_META = {
  SENT: { label: "Gönderildi", variant: "secondary" },
  OPENED: { label: "Açıldı", variant: "secondary" },
  FAILED: { label: "Başarısız", variant: "destructive" },
  SKIPPED: { label: "Atlandı", variant: "outline" },
} as const;
type StatusKey = keyof typeof STATUS_META;

function HistoryTab({
  channel,
  automationId,
  onClearAutomation,
}: {
  channel: Channel;
  automationId?: string;
  onClearAutomation: () => void;
}) {
  const [status, setStatus] = useState<StatusKey | "">("");
  const { data: rules } = trpc.messaging.automations.useQuery(undefined, { enabled: !!automationId });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = trpc.messaging.history.useInfiniteQuery(
    { channel, limit: 50, status: status || undefined, automationId },
    { getNextPageParam: (last) => last.nextCursor },
  );
  const logs = data?.pages.flatMap((p) => p.logs) ?? [];
  const ruleName = rules?.find((r) => r.id === automationId)?.name;
  const filters: (StatusKey | "")[] = channel === "SMS" ? ["", "SENT", "FAILED", "SKIPPED"] : ["", "OPENED"];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Gönderim Geçmişi</CardTitle>
          <CardDescription>
            {channel === "SMS" ? "Gönderilen, başarısız olan ve atlanan tüm SMS'ler." : "WhatsApp'ta açılan mesajlar (gönderimi telefonda siz onaylarsınız)."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {automationId && (
            <Button size="sm" variant="secondary" onClick={onClearAutomation}>
              ⚡ {ruleName ?? "Kural"} ✕
            </Button>
          )}
          {filters.map((s) => (
            <Button key={s || "all"} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
              {s ? STATUS_META[s].label : "Tümü"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Kayıt yok.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {logs.map((l) => (
              <div key={l.id} className="space-y-1 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmtDateTime(l.createdAt)}</span>
                  <span className="font-medium">{l.patient?.fullName ?? l.phone}</span>
                  <Badge variant="outline">{l.automation ? `⚡ ${l.automation.name}` : KIND_LABEL[l.kind]}</Badge>
                  <Badge variant={STATUS_META[l.status].variant}>{STATUS_META[l.status].label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {l.sentBy?.name ?? (l.kind === "AUTOMATION" || l.kind === "REMINDER" ? "Sistem" : "")}
                  </span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{l.body}</p>
                {l.errorMessage && (
                  <p className={`text-xs ${l.status === "SKIPPED" ? "text-muted-foreground" : "text-destructive"}`}>{l.errorMessage}</p>
                )}
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

export function MessagingClient({ channel, initialPatientId }: { channel: Channel; initialPatientId?: string }) {
  const meta = CHANNEL_META[channel];
  const { data: me } = trpc.user.me.useQuery();
  const { data: smsStatus } = trpc.messaging.smsStatus.useQuery(undefined, { enabled: channel === "SMS" });
  const [tab, setTab] = useState<string | null>(null);
  const [historyRule, setHistoryRule] = useState<string | undefined>();

  if (!me || (channel === "SMS" && !smsStatus)) {
    return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  const can = (cap: Parameters<typeof hasCapability>[1]) =>
    hasCapability(me.memberships.map((m) => m.role), cap, me.capabilityOverrides);
  const canManage = can("dental:messaging:manage");
  const canSend = can("dental:messaging:send");
  const canSettings = can("dental:messaging:settings");
  const clinicName = me.organizationName || undefined;

  const header = (
    <Card>
      <CardHeader>
        <CardTitle className={`flex flex-wrap items-center gap-2 text-base ${meta.accent}`}>
          {meta.title}
          {channel === "SMS" && smsStatus?.connected && (
            <Badge variant="secondary" className="gap-1 font-normal">
              <CheckCircle2 className="size-3 text-emerald-600" /> {smsStatus.msgheader}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
    </Card>
  );

  // SMS: nothing but the setup until an account is connected.
  if (channel === "SMS" && !smsStatus?.connected) {
    return (
      <div className="mx-auto w-full flex max-w-5xl flex-col gap-4">
        {header}
        <SmsSetup canSettings={canSettings} />
      </div>
    );
  }

  const showHistoryFor = (id: string) => {
    setHistoryRule(id);
    setTab("gecmis");
  };

  const tabs: { value: string; label: string; show: boolean; node: React.ReactNode }[] =
    channel === "SMS"
      ? [
          { value: "otomatik", label: "Otomatik Mesajlar", show: canSettings, node: <AutomationsTab clinicName={clinicName} onShowHistory={showHistoryFor} /> },
          { value: "planlanan", label: "Planlanan", show: canSettings, node: <PlanTab /> },
          { value: "gonder", label: "Gönder", show: canSend, node: <SendTab channel={channel} initialPatientId={initialPatientId} /> },
          { value: "sablonlar", label: "Şablonlar", show: true, node: <TemplatesTab channel={channel} canManage={canManage} clinicName={clinicName} /> },
          {
            value: "gecmis",
            label: "Geçmiş",
            show: canSend,
            node: <HistoryTab channel={channel} automationId={historyRule} onClearAutomation={() => setHistoryRule(undefined)} />,
          },
          { value: "hesap", label: "Hesap", show: canSettings, node: <SmsAccountTab /> },
        ]
      : [
          { value: "hatirlatmalar", label: "Hatırlatmalar", show: canSend, node: <WhatsappRemindersTab /> },
          { value: "gonder", label: "Gönder", show: canSend, node: <SendTab channel={channel} initialPatientId={initialPatientId} /> },
          { value: "sablonlar", label: "Şablonlar", show: true, node: <TemplatesTab channel={channel} canManage={canManage} clinicName={clinicName} /> },
          { value: "gecmis", label: "Geçmiş", show: canSend, node: <HistoryTab channel={channel} onClearAutomation={() => undefined} /> },
        ];
  const visible = tabs.filter((t) => t.show);
  const defaultTab = initialPatientId && canSend ? "gonder" : visible[0]?.value;

  return (
    <div className="mx-auto w-full flex max-w-5xl flex-col gap-4">
      {header}
      <Tabs value={tab ?? defaultTab} onValueChange={(v) => setTab(v as string)}>
        <div className="overflow-x-auto">
          <TabsList>
            {visible.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {visible.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.node}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
