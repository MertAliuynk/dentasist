"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { AlertTriangle, ArrowLeft, CheckCircle2, Inbox, LifeBuoy, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import {
  CATEGORY_META,
  PRIORITY_META,
  STATUS_META,
  fmtDateTime,
  relativeTime,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/components/support/support-meta";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketComposer } from "@/components/support/ticket-composer";

export type ErrorPrefill = { ref?: string; code?: string; path?: string; operation?: string; message?: string };

const STATUS_HELP: Record<TicketStatus, string> = {
  OPEN: "Talebiniz destek ekibimizde. En kısa sürede yanıt vereceğiz; yanıt geldiğinde sağ üstteki zilde bildirim görürsünüz.",
  ANSWERED: "Destek ekibi yanıtladı. Sorununuz çözüldüyse talebi kapatabilir, değilse yanıt yazabilirsiniz.",
  CLOSED: "Bu talep kapalı. Yeni bir mesaj yazarsanız talep yeniden açılır.",
};

export function SupportTicketClient({ initialTicketId, errorPrefill }: { initialTicketId?: string; errorPrefill?: ErrorPrefill }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<"ACTIVE" | "CLOSED" | "ALL">("ACTIVE");
  const [selected, setSelected] = useState<string | null>(initialTicketId ?? null);
  const [newOpen, setNewOpen] = useState(!!errorPrefill);
  const { data: tickets, isLoading } = trpc.supportTicket.list.useQuery(undefined, { refetchInterval: 30_000 });

  const select = (id: string | null) => {
    setSelected(id);
    router.replace(id ? `${pathname}?talep=${id}` : pathname, { scroll: false });
  };

  const visible = (tickets ?? []).filter((t) => (filter === "ALL" ? true : filter === "CLOSED" ? t.status === "CLOSED" : t.status !== "CLOSED"));
  const activeCount = tickets?.filter((t) => t.status !== "CLOSED").length ?? 0;

  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <LifeBuoy className="size-5" /> Destek Merkezi
          </h1>
          <p className="text-sm text-muted-foreground">Bir sorun mu yaşıyorsunuz? Talep açın, ekibimiz size buradan yanıt versin.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" /> Yeni Talep
        </Button>
      </div>

      <Card className="flex h-[calc(100vh-13rem)] min-h-112 flex-row gap-0 overflow-hidden p-0">
        <aside className={`flex w-full flex-col border-r border-border md:w-80 md:shrink-0 ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="flex gap-1 border-b border-border p-2">
            {[
              { v: "ACTIVE" as const, l: `Aktif${activeCount ? ` (${activeCount})` : ""}` },
              { v: "CLOSED" as const, l: "Kapalı" },
              { v: "ALL" as const, l: "Tümü" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setFilter(o.v)}
                className={`rounded-md px-2.5 py-1 text-sm ${filter === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
                <Inbox className="size-8 opacity-40" />
                {tickets?.length ? "Bu filtrede talep yok." : "Henüz destek talebiniz yok."}
              </div>
            ) : (
              visible.map((t) => {
                const Cat = CATEGORY_META[t.category].icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select(t.id)}
                    className={`flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${selected === t.id ? "bg-accent" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {t.unread && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                      <p className={`min-w-0 flex-1 truncate text-sm ${t.unread ? "font-semibold" : "font-medium"}`}>{t.subject}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(t.updatedAt)}</span>
                    </div>
                    {t.lastMessage && (
                      <p className="truncate text-xs text-muted-foreground">
                        {t.lastMessage.fromStaff ? "Destek: " : ""}
                        {t.lastMessage.body || "📷 Görsel"}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-px text-[10px] font-medium ${STATUS_META[t.status].chip}`}>{STATUS_META[t.status].customer}</span>
                      <Cat className={`size-3 ${CATEGORY_META[t.category].color}`} />
                      <span className="text-[11px] text-muted-foreground">{CATEGORY_META[t.category].label}</span>
                      {t.fromError && <AlertTriangle className="size-3 text-red-500" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
          {selected ? (
            <CustomerTicket key={selected} id={selected} onBack={() => select(null)} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              <LifeBuoy className="size-10 opacity-30" />
              <p>Bir talep seçin ya da yeni bir talep oluşturun.</p>
              <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="size-4" /> Yeni Talep
              </Button>
            </div>
          )}
        </section>
      </Card>

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        errorPrefill={errorPrefill}
        onCreated={(id) => {
          setFilter("ACTIVE");
          select(id);
        }}
      />
    </div>
  );
}

function CustomerTicket({ id, onBack }: { id: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: t, isLoading, error } = trpc.supportTicket.get.useQuery({ id }, { refetchInterval: 20_000 });

  useEffect(() => {
    if (t) {
      utils.supportTicket.list.invalidate();
      utils.supportTicket.unread.invalidate();
    }
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    utils.supportTicket.get.invalidate({ id });
    utils.supportTicket.list.invalidate();
  };
  const requestUpload = trpc.supportTicket.requestUpload.useMutation();
  const reply = trpc.supportTicket.reply.useMutation({
    onSuccess: () => {
      toast.success("Mesajınız iletildi.");
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const close = trpc.supportTicket.close.useMutation({
    onSuccess: () => {
      toast.success("Talep kapatıldı. İyi çalışmalar!");
      refresh();
    },
    onError: (e) => toastError(e),
  });

  if (error) return <p className="py-24 text-center text-sm text-muted-foreground">{error.message}</p>;
  if (isLoading || !t) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-1.5 border-b border-border p-3 sm:px-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Geri">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{t.subject}</h2>
            <p className="text-xs text-muted-foreground">
              #{t.id.slice(-6)} · {CATEGORY_META[t.category].label} · Öncelik: {PRIORITY_META[t.priority].label} · {t.createdByName} ·{" "}
              {fmtDateTime(t.createdAt)}
            </p>
          </div>
          {t.status !== "CLOSED" && (
            <Button size="sm" variant="outline" disabled={close.isPending} onClick={() => close.mutate({ id: t.id })}>
              <CheckCircle2 className="size-3.5" /> Sorunum çözüldü
            </Button>
          )}
        </div>
        <p className={`rounded-md px-2.5 py-1.5 text-xs ${STATUS_META[t.status].chip}`}>
          <b>{STATUS_META[t.status].customer}:</b> {STATUS_HELP[t.status]}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <TicketThread messages={t.messages} viewer="customer" />
      </div>
      <div className="border-t border-border p-3">
        <TicketComposer
          canAttach={t.attachmentsAllowed}
          attachHint="Görsel göndermeniz gerekirse destek ekibi bu talep için açacaktır."
          pending={reply.isPending}
          placeholder={t.attachmentsAllowed ? "Mesajınızı yazın… Ekran görüntüsünü yapıştırabilir veya sürükleyebilirsiniz." : "Mesajınızı yazın…"}
          requestUpload={(f) => requestUpload.mutateAsync({ ticketId: t.id, ...f })}
          onSend={(d) => reply.mutateAsync({ ticketId: t.id, ...d })}
        />
      </div>
    </div>
  );
}

function buildErrorMessage(e: ErrorPrefill) {
  return [
    "Aşağıdaki hatayı aldım.",
    "",
    "Ne yapmaya çalışıyordum: ",
    "",
    "— Otomatik eklenen bilgiler —",
    e.path && `Sayfa: ${e.path}`,
    e.operation && `İşlem: ${e.operation}`,
    e.code && `Hata kodu: ${e.code}`,
    e.ref && `Referans: ${e.ref}`,
    e.message && `Hata: ${e.message}`,
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");
}

function NewTicketDialog({
  open,
  onOpenChange,
  errorPrefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  errorPrefill?: ErrorPrefill;
  onCreated: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState(errorPrefill ? `Hata: ${errorPrefill.path ?? "uygulama"}` : "");
  const [message, setMessage] = useState(errorPrefill ? buildErrorMessage(errorPrefill) : "");
  const [category, setCategory] = useState<TicketCategory>(errorPrefill ? "TEKNIK" : "TEKNIK");
  const [priority, setPriority] = useState<TicketPriority>(errorPrefill ? "YUKSEK" : "NORMAL");
  const [attachError, setAttachError] = useState(!!errorPrefill);

  const create = trpc.supportTicket.create.useMutation({
    onSuccess: (t) => {
      toast.success("Destek talebiniz oluşturuldu. Yanıt geldiğinde bildirim alacaksınız.");
      utils.supportTicket.list.invalidate();
      onOpenChange(false);
      setSubject("");
      setMessage("");
      onCreated(t.id);
    },
    onError: (e) => toastError(e),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Destek Talebi</DialogTitle>
          <DialogDescription>Sorunu ne kadar net anlatırsanız o kadar hızlı çözeriz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {errorPrefill && (
            <label className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-xs">
              <input type="checkbox" className="mt-0.5" checked={attachError} onChange={(e) => setAttachError(e.target.checked)} />
              <span>
                <b className="text-red-700 dark:text-red-300">Hata bilgisi eklensin</b> — destek ekibi hatanın tam olarak nerede ve nasıl
                oluştuğunu görebilir. {errorPrefill.ref && <span className="font-mono">({errorPrefill.ref})</span>}
              </span>
            </label>
          )}
          <div className="space-y-1.5">
            <Label>Konu</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ör. Randevu kaydedilmiyor" />
          </div>
          <div className="space-y-1.5">
            <Label>Konu türü</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(CATEGORY_META) as TicketCategory[]).map((c) => {
                const M = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                      category === c ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <M.icon className={`size-4 ${M.color}`} /> {M.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Önem derecesi</Label>
            <div className="inline-flex rounded-md border border-input p-0.5">
              {(["DUSUK", "NORMAL", "YUKSEK", "ACIL"] as TicketPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`rounded px-3 py-1 text-xs ${priority === p ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
            {priority === "ACIL" && <p className="text-xs text-muted-foreground">Acil: kliniğin çalışmasını durduran sorunlar için kullanın.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Mesaj</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Ne yapmaya çalışırken, ne oldu?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={subject.trim().length < 3 || message.trim().length < 3 || create.isPending}
            onClick={() =>
              create.mutate({
                subject: subject.trim(),
                message: message.trim(),
                category,
                priority,
                errorContext: errorPrefill && attachError ? errorPrefill : undefined,
              })
            }
          >
            Talebi Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
