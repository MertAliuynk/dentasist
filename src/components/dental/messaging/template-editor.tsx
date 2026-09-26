"use client";

import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { AlertTriangle, Copy, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { MESSAGE_TOKENS, renderSample, smsSegments, usedTokens, type TokenGroup } from "@/lib/message-render";
import { TRIGGER_META, TRIGGERS } from "@/lib/sms-automation";

export type Channel = "SMS" | "WHATSAPP";

const TOKEN_BY_TEXT = new Map(MESSAGE_TOKENS.map((t) => [t.token, t]));
const GROUPS: TokenGroup[] = ["Hasta", "Randevu", "Klinik"];

const TR_MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
const stripTurkish = (s: string) => s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c);

/** Body with {tokens} drawn as labelled chips — used on template cards and rule cards. */
export function TokenizedText({ body, className = "" }: { body: string; className?: string }) {
  const parts = body.split(/(\{[a-z_]+\})/g);
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => {
        const t = TOKEN_BY_TEXT.get(part);
        if (!t) return <Fragment key={i}>{part}</Fragment>;
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded bg-sky-500/15 px-1.5 py-px text-[0.8em] font-medium text-sky-700 dark:text-sky-300"
            title={t.token}
          >
            {t.label}
          </span>
        );
      })}
    </p>
  );
}

export function SegmentInfo({ text, compact = false }: { text: string; compact?: boolean }) {
  const s = smsSegments(text);
  if (s.length === 0) return null;
  const enc = s.encoding === "GSM" ? "Standart" : s.encoding === "TR" ? "Türkçe karakterli" : "Özel karakter (emoji vb.)";
  return (
    <span className={`text-xs ${s.segments > 1 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
      {s.length} karakter · <b>{s.segments} SMS</b>
      {!compact && ` · ${enc} (SMS başına ${s.perSegment})`}
    </span>
  );
}

function TemplateEditorDialog({
  channel,
  open,
  onOpenChange,
  editing,
  clinicName,
  onSaved,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: { id?: string; name: string; body: string } | null;
  clinicName?: string;
  onSaved?: (id: string) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const done = (msg: string, id: string) => {
    toast.success(msg);
    utils.messageTemplate.list.invalidate({ channel });
    utils.messaging.automations.invalidate();
    onSaved?.(id);
    onOpenChange(false);
  };
  const create = trpc.messageTemplate.create.useMutation({ onSuccess: (t) => done("Şablon eklendi.", t.id), onError: (e) => toastError(e) });
  const update = trpc.messageTemplate.update.useMutation({
    onSuccess: () => done("Şablon güncellendi.", editing?.id ?? ""),
    onError: (e) => toastError(e),
  });

  function insert(token: string) {
    const el = textareaRef.current;
    if (!el) return setBody((b) => `${b}${token}`);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    // Keep a space between a token and adjacent words.
    const before = body.slice(0, start);
    const pad = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${pad}${token}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + pad.length + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const unknown = [...new Set(body.match(/\{[^}\s]*\}/g) ?? [])].filter((t) => !TOKEN_BY_TEXT.has(t));
  const needsAppt = usedTokens(body).filter((t) => t.needs === "appointment");
  const preview = renderSample(body, clinicName);
  const hasTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(body);
  const seg = smsSegments(preview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Şablonu Düzenle" : "Yeni Mesaj Şablonu"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Şablon Adı</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. Randevu Hatırlatma" />
            </div>

            {!editing?.id && !body && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hazır metinle başla</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TRIGGERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="rounded-full border border-input px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                      onClick={() => {
                        setBody(TRIGGER_META[t].defaultText);
                        if (!name) setName(TRIGGER_META[t].label.replace(/ \(.*\)$/, ""));
                      }}
                    >
                      {TRIGGER_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Hastaya özel bilgiler — tıklayın, imlecin olduğu yere eklensin</Label>
              <div className="space-y-2 rounded-md border border-dashed border-input p-2.5">
                {GROUPS.map((g) => (
                  <div key={g} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{g}</span>
                    {MESSAGE_TOKENS.filter((t) => t.group === g).map((t) => (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => insert(t.token)}
                        className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-500/25 dark:text-sky-300"
                        title={`${t.token} → örn. "${t.sample}"`}
                      >
                        + {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mesaj Metni</Label>
              <Textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Sayın {ad}, {randevu_tarihi} saat {randevu_saati} randevunuzu hatırlatırız."
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {channel === "SMS" ? <SegmentInfo text={preview} /> : <span className="text-xs text-muted-foreground">{preview.length} karakter</span>}
                {channel === "SMS" && hasTurkish && (
                  <Button type="button" size="xs" variant="ghost" onClick={() => setBody(stripTurkish(body))}>
                    <Wand2 className="size-3" /> Türkçe karakterleri dönüştür (ç→c, ş→s…)
                  </Button>
                )}
              </div>
            </div>

            {(unknown.length > 0 || needsAppt.length > 0 || (channel === "SMS" && seg.segments > 2)) && (
              <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                {unknown.length > 0 && (
                  <p className="flex gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                    Tanınmayan alan: {unknown.join(", ")} — olduğu gibi gönderilir. Yukarıdaki butonları kullanın.
                  </p>
                )}
                {needsAppt.length > 0 && (
                  <p className="flex gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                    {needsAppt.map((t) => t.label).join(", ")} randevu bilgisi gerektirir — doğum günü ve kontrol hatırlatması gibi randevusuz mesajlarda kullanılamaz.
                  </p>
                )}
                {channel === "SMS" && seg.segments > 2 && (
                  <p className="flex gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                    Bu mesaj her hasta için {seg.segments} SMS olarak ücretlendirilir.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Önizleme</Label>
            <div className="rounded-[1.6rem] border-4 border-foreground/80 bg-muted/40 p-3 shadow-sm">
              <p className="mb-2 text-center text-[10px] text-muted-foreground">Örnek hasta: Ayşe Yılmaz</p>
              <div
                className={`ml-auto w-fit max-w-full rounded-2xl rounded-br-sm px-3 py-2 text-sm shadow-sm ${
                  channel === "SMS" ? "bg-sky-500 text-white" : "bg-emerald-500 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{preview || "Mesajınız burada görünecek…"}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Gönderimde her hasta kendi adı, randevu saati ve hekimiyle alır.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!name.trim() || !body.trim() || create.isPending || update.isPending}
            onClick={() =>
              editing?.id
                ? update.mutate({ id: editing.id, name: name.trim(), body: body.trim() })
                : create.mutate({ channel, name: name.trim(), body: body.trim() })
            }
          >
            {editing?.id ? "Kaydet" : "Şablonu Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mounts the editor fresh on each open so its fields start from `editing`. */
export function TemplateEditor(props: Parameters<typeof TemplateEditorDialog>[0]) {
  if (!props.open) return null;
  return <TemplateEditorDialog key={props.editing?.id ?? "new"} {...props} />;
}

export function TemplatesTab({ channel, canManage, clinicName }: { channel: Channel; canManage: boolean; clinicName?: string }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; name: string; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { data: templates, isLoading } = trpc.messageTemplate.list.useQuery({ channel });
  const utils = trpc.useUtils();

  const remove = trpc.messageTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success("Şablon silindi.");
      setConfirmDelete(null);
      utils.messageTemplate.list.invalidate({ channel });
    },
    onError: (e) => {
      setConfirmDelete(null);
      toastError(e);
    },
  });

  const open = (t: { id?: string; name: string; body: string } | null) => {
    setEditing(t);
    setEditorOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-base">Mesaj Şablonları</CardTitle>
          <CardDescription>
            Mavi alanlar gönderimde her hastanın kendi bilgisiyle dolar.{channel === "SMS" && " Otomatik mesajlar bu şablonları kullanır."}
          </CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => open(null)}>
            <Plus className="size-4" /> Yeni Şablon
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
        ) : !templates || templates.length === 0 ? (
          <div className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Henüz şablon yok.</p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => open(null)}>
                İlk şablonunuzu oluşturun
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    {channel === "SMS" && <SegmentInfo text={renderSample(t.body, clinicName)} compact />}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-0.5">
                      <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => open({ id: t.id, name: t.name, body: t.body })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Kopyala" onClick={() => open({ name: `${t.name} (kopya)`, body: t.body })}>
                        <Copy className="size-3.5" />
                      </Button>
                      {confirmDelete === t.id ? (
                        <Button variant="destructive" size="xs" disabled={remove.isPending} onClick={() => remove.mutate({ id: t.id })}>
                          Sil?
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => setConfirmDelete(t.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <TokenizedText body={t.body} className="text-sm text-muted-foreground" />
                {t.automations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.automations.map((a) => (
                      <Badge key={a.id} variant={a.enabled ? "secondary" : "outline"} className="text-[10px]">
                        ⚡ {a.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <TemplateEditor
        channel={channel}
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        clinicName={clinicName}
      />
    </Card>
  );
}
