"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Send, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { hasCapability } from "@/server/rbac/permissions";

type Channel = "SMS" | "WHATSAPP";

const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{ad}", label: "Hasta Adı" },
  { token: "{randevu_tarihi}", label: "Randevu Tarihi" },
  { token: "{randevu_saati}", label: "Randevu Saati" },
  { token: "{hekim}", label: "Hekim Adı" },
  { token: "{klinik}", label: "Klinik Adı" },
];

const CHANNEL_META: Record<
  Channel,
  { title: string; accent: string; sendLabel: string; description: string; charLimit?: number }
> = {
  SMS: {
    title: "SMS Hizmetleri",
    accent: "text-sky-600 dark:text-sky-400",
    sendLabel: "SMS Gönder",
    description: "Hastalarınıza randevu hatırlatma ve bilgilendirme SMS'leri için şablon oluşturun.",
    charLimit: 160,
  },
  WHATSAPP: {
    title: "WhatsApp Hizmetleri",
    accent: "text-emerald-600 dark:text-emerald-400",
    sendLabel: "WhatsApp Gönder",
    description: "Hastalarınıza WhatsApp üzerinden randevu hatırlatma ve bilgilendirme mesajları için şablon oluşturun.",
  },
};

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
  const meta = CHANNEL_META[channel];

  const create = trpc.messageTemplate.create.useMutation({
    onSuccess: () => {
      toast.success("Şablon eklendi.");
      utils.messageTemplate.list.invalidate({ channel });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.messageTemplate.update.useMutation({
    onSuccess: () => {
      toast.success("Şablon güncellendi.");
      utils.messageTemplate.list.invalidate({ channel });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function insertPlaceholder(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
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
              placeholder="Sayın {ad}, {randevu_tarihi} tarihinde saat {randevu_saati}'te {klinik} adresindeki randevunuzu hatırlatırız."
            />
            {meta.charLimit && (
              <p className="text-xs text-muted-foreground">
                {body.length} / {meta.charLimit} karakter {body.length > meta.charLimit && "(birden fazla SMS olarak gönderilir)"}
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

function SendTab({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  const [patientSearch, setPatientSearch] = useState("");
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [customBody, setCustomBody] = useState("");

  const { data: templates } = trpc.messageTemplate.list.useQuery({ channel });
  const { data: me } = trpc.user.me.useQuery();
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: patientSearch.trim().length > 0 && !patient },
  );

  const template = templates?.find((t) => t.id === templateId);
  const rawBody = templateId ? (template?.body ?? "") : customBody;
  const preview = rawBody
    .replaceAll("{ad}", patient?.fullName ?? "{ad}")
    .replaceAll("{klinik}", me?.organizationName || "{klinik}");

  function handleSend() {
    if (!patient || !rawBody.trim()) return;
    toast.info(`${meta.sendLabel} entegrasyonu yakında aktif olacak — bu bir önizlemedir, mesaj gönderilmedi.`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mesaj Gönder</CardTitle>
        <CardDescription>
          Bir hasta ve şablon seçerek önizleyin.{" "}
          <span className="font-medium">Gönderim entegrasyonu henüz aktif değil.</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Hasta</Label>
          {patient ? (
            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              <span>{patient.fullName}</span>
              <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
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
                        setPatient(p);
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
            <button
              type="button"
              onClick={() => setTemplateId("")}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                templateId === "" ? "border-foreground bg-foreground text-background" : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              Serbest metin
            </button>
            {templates?.map((t) => (
              <button
                key={t.id}
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
            <Textarea value={customBody} onChange={(e) => setCustomBody(e.target.value)} rows={4} />
          </div>
        )}

        {rawBody.trim() && (
          <div className="space-y-2 rounded-md border border-dashed border-input p-3">
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary">Önizleme</Badge>
              <span className="text-xs text-muted-foreground">{preview.length} karakter</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{preview}</p>
            {(rawBody.includes("{randevu_tarihi}") || rawBody.includes("{randevu_saati}") || rawBody.includes("{hekim}")) && (
              <p className="text-xs text-muted-foreground">
                Randevu tarihi / saati / hekim bilgileri, gerçek gönderim sırasında ilgili randevudan otomatik doldurulacaktır.
              </p>
            )}
          </div>
        )}

        <Button className="w-full" disabled={!patient || !rawBody.trim()} onClick={handleSend}>
          <Send className="size-4" />
          {meta.sendLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function MessagingClient({ channel }: { channel: Channel }) {
  const meta = CHANNEL_META[channel];
  const { data: me } = trpc.user.me.useQuery();
  const canManage = me
    ? hasCapability(me.memberships.map((m) => m.role), "dental:messaging:manage", me.capabilityOverrides)
    : false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className={`text-base ${meta.accent}`}>{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="sablonlar">
        <TabsList>
          <TabsTrigger value="sablonlar">Şablonlar</TabsTrigger>
          <TabsTrigger value="gonder">Gönder</TabsTrigger>
        </TabsList>
        <TabsContent value="sablonlar">
          <TemplatesTab channel={channel} canManage={canManage} />
        </TabsContent>
        <TabsContent value="gonder">
          <SendTab channel={channel} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
