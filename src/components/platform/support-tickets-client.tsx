"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { AlertTriangle, ArrowLeft, Camera, CameraOff, ExternalLink, Inbox, RotateCcw, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { platformTrpc } from "@/lib/platform-trpc/client";
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

type StatusTab = TicketStatus | "ALL";
type Sort = "WAITING" | "PRIORITY" | "RECENT";

const SORT_LABEL: Record<Sort, string> = { WAITING: "En uzun bekleyen", PRIORITY: "Önceliğe göre", RECENT: "Son hareket" };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function waitTone(since: string | Date) {
  const h = (Date.now() - new Date(since).getTime()) / 3_600_000;
  if (h >= 24) return "text-red-600 dark:text-red-400 font-medium";
  if (h >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function SupportTicketsClient({ initialTicketId }: { initialTicketId?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("OPEN");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [sort, setSort] = useState<Sort>("WAITING");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 300);
  const [selected, setSelected] = useState<string | null>(initialTicketId ?? null);

  const { data, isLoading } = platformTrpc.supportTicket.list.useQuery(
    {
      status: tab === "ALL" ? undefined : tab,
      category: category || undefined,
      priority: priority || undefined,
      search: debounced || undefined,
      sort,
    },
    { refetchInterval: 30_000 },
  );

  const select = (id: string | null) => {
    setSelected(id);
    router.replace(id ? `/admin/destek-talepleri?talep=${id}` : "/admin/destek-talepleri", { scroll: false });
  };

  const counts = data?.counts;
  const tabs: { value: StatusTab; label: string; count?: number }[] = [
    { value: "OPEN", label: "Yanıt Bekliyor", count: counts?.OPEN },
    { value: "ANSWERED", label: "Yanıtlandı", count: counts?.ANSWERED },
    { value: "CLOSED", label: "Kapalı", count: counts?.CLOSED },
    { value: "ALL", label: "Tümü" },
  ];

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] sm:-m-6">
      {/* ---- Inbox ---- */}
      <aside className={`flex w-full flex-col border-r border-border lg:w-104 lg:shrink-0 ${selected ? "hidden lg:flex" : "flex"}`}>
        <div className="space-y-2.5 border-b border-border p-3">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  tab === t.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {t.value !== "ALL" && <span className={`size-2 rounded-full ${STATUS_META[t.value].dot}`} />}
                {t.label}
                {t.count !== undefined && <span className="tabular-nums opacity-70">{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8" placeholder="Konu, klinik, kişi veya e-posta…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(CATEGORY_META) as TicketCategory[]).map((c) => {
              const M = CATEGORY_META[c];
              const on = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(on ? "" : c)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    on ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <M.icon className={`size-3 ${M.color}`} />
                  {M.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Select value={priority || "ALL"} onValueChange={(v) => setPriority(!v || v === "ALL" ? "" : (v as TicketPriority))}>
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue>{(v: string) => (v === "ALL" ? "Tüm öncelikler" : PRIORITY_META[v as TicketPriority].label)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tüm öncelikler</SelectItem>
                {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort((v as Sort) ?? "WAITING")}>
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue>{(v: string) => SORT_LABEL[v as Sort]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Inbox className="size-8 opacity-40" />
              {tab === "OPEN" ? "Bekleyen talep yok. Her şey yolunda 🎉" : "Talep bulunamadı."}
            </div>
          ) : (
            data.items.map((t) => {
              const Cat = CATEGORY_META[t.category].icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t.id)}
                  className={`relative flex w-full gap-3 border-b border-border py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-accent/50 ${
                    selected === t.id ? "bg-accent" : ""
                  }`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_META[t.priority].bar}`} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      {t.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Okunmadı" />}
                      <p className={`truncate text-sm ${t.unread ? "font-semibold" : "font-medium"}`}>{t.subject}</p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.organization.name} · {t.createdByName}
                    </p>
                    {t.lastMessage && (
                      <p className="truncate text-xs text-muted-foreground/80">
                        {t.lastMessage.fromStaff && "Siz: "}
                        {t.lastMessage.body || "📷 Görsel"}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-xs tabular-nums ${t.waitingSince ? waitTone(t.waitingSince) : "text-muted-foreground"}`}>
                      {t.waitingSince ? `${relativeTime(t.waitingSince)} bekliyor` : relativeTime(t.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      {t.fromError && <AlertTriangle className="size-3.5 text-red-500" aria-label="Hata raporu" />}
                      {t.attachmentsAllowed && <Camera className="size-3.5 text-muted-foreground" aria-label="Görsel izni açık" />}
                      <Cat className={`size-3.5 ${CATEGORY_META[t.category].color}`} />
                      {(t.priority === "ACIL" || t.priority === "YUKSEK") && (
                        <span className={`rounded px-1 text-[10px] font-medium ${PRIORITY_META[t.priority].chip}`}>{PRIORITY_META[t.priority].label}</span>
                      )}
                      {tab === "ALL" && <span className={`size-2 rounded-full ${STATUS_META[t.status].dot}`} />}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ---- Conversation ---- */}
      <section className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden lg:flex"}`}>
        {selected ? (
          <TicketDetail key={selected} id={selected} onBack={() => select(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Inbox className="size-10 opacity-30" />
            Soldan bir talep seçin.
          </div>
        )}
      </section>
    </div>
  );
}

function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const utils = platformTrpc.useUtils();
  const { data: t, isLoading } = platformTrpc.supportTicket.get.useQuery({ id }, { refetchInterval: 20_000 });
  const [closeAfter, setCloseAfter] = useState(false);

  // Opening a ticket marks it read → refresh list dots and the sidebar badge.
  useEffect(() => {
    if (t) {
      utils.supportTicket.list.invalidate();
      utils.supportTicket.unread.invalidate();
    }
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => {
    utils.supportTicket.get.invalidate({ id });
    utils.supportTicket.list.invalidate();
    utils.supportTicket.unread.invalidate();
  };
  const requestUpload = platformTrpc.supportTicket.requestUpload.useMutation();
  const reply = platformTrpc.supportTicket.reply.useMutation({
    onSuccess: () => {
      toast.success(closeAfter ? "Yanıt gönderildi ve talep kapatıldı." : "Yanıt gönderildi.");
      setCloseAfter(false);
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const setAttach = platformTrpc.supportTicket.setAttachmentsAllowed.useMutation({
    onSuccess: (_r, v) => {
      toast.success(v.allowed ? "Görsel gönderimi açıldı, müşteriye bildirildi." : "Görsel gönderimi kapatıldı.");
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const update = platformTrpc.supportTicket.update.useMutation({ onSuccess: refresh, onError: (e) => toastError(e) });

  if (isLoading || !t) return <p className="py-24 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  const closed = t.status === "CLOSED";
  const ec = t.errorContext;
  const sub = t.organization.subscription;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="space-y-2 border-b border-border p-3 sm:px-5">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Geri">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{t.subject}</h2>
            <p className="text-xs text-muted-foreground">
              <Link href={`/admin/organizasyonlar/${t.organization.id}`} className="font-medium text-foreground hover:underline">
                {t.organization.name}
              </Link>
              {sub && ` · ${sub.plan.name}`} · {t.createdBy.name} · {t.createdBy.email}
              {t.createdBy.phone && ` · ${t.createdBy.phone}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              #{t.id.slice(-6)} · {fmtDateTime(t.createdAt)}
              {t.createdIp && ` · IP ${t.createdIp}`}
              {t.otherTickets > 0 && ` · bu klinikten ${t.otherTickets} talep daha`}
              {t.recentErrors > 0 && (
                <>
                  {" · "}
                  <Link href={`/admin/organizasyonlar/${t.organization.id}?sekme=kayitlar&hatalar=1`} className="text-red-600 hover:underline">
                    son 7 günde {t.recentErrors} hata
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_META[t.status].chip}`}>{STATUS_META[t.status].staff}</span>
          <Select value={t.priority} onValueChange={(v) => v && update.mutate({ ticketId: t.id, priority: v as TicketPriority })}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue>{(v: string) => `Öncelik: ${PRIORITY_META[v as TicketPriority].label}`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_META) as TicketPriority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={t.category} onValueChange={(v) => v && update.mutate({ ticketId: t.id, category: v as TicketCategory })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue>{(v: string) => CATEGORY_META[v as TicketCategory].label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_META) as TicketCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_META[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {!closed && (
            <Button
              size="sm"
              variant={t.attachmentsAllowed ? "secondary" : "outline"}
              disabled={setAttach.isPending}
              onClick={() => setAttach.mutate({ ticketId: t.id, allowed: !t.attachmentsAllowed })}
            >
              {t.attachmentsAllowed ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
              {t.attachmentsAllowed ? "Görsel iznini kapat" : "Görsel göndermeyi aç"}
            </Button>
          )}
          {closed ? (
            <Button size="sm" variant="outline" onClick={() => update.mutate({ ticketId: t.id, status: "OPEN" })}>
              <RotateCcw className="size-3.5" /> Yeniden Aç
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => update.mutate({ ticketId: t.id, status: "CLOSED" })}>
              <XCircle className="size-3.5" /> Kapat
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {ec && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="size-4" /> Hata ekranından açıldı
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {ec.ref && (<><dt className="text-muted-foreground">Referans</dt><dd className="font-mono">{ec.ref}</dd></>)}
              {ec.code && (<><dt className="text-muted-foreground">Kod</dt><dd className="font-mono">{ec.code}</dd></>)}
              {ec.operation && (<><dt className="text-muted-foreground">İşlem</dt><dd className="font-mono">{ec.operation}</dd></>)}
              {ec.path && (<><dt className="text-muted-foreground">Sayfa</dt><dd className="font-mono">{ec.path}</dd></>)}
              {ec.message && (<><dt className="text-muted-foreground">Mesaj</dt><dd>{ec.message}</dd></>)}
            </dl>
            {ec.ref && (
              <Link
                href={`/admin/organizasyonlar/${t.organization.id}?sekme=kayitlar&ara=${encodeURIComponent(ec.ref)}`}
                className="mt-2 inline-flex items-center gap-1 font-medium text-red-700 hover:underline dark:text-red-300"
              >
                İşlem kaydında gör (gönderilen veri + teknik hata) <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        )}
        <TicketThread messages={t.messages} viewer="staff" showIp />
      </div>

      <div className="border-t border-border p-3 sm:px-5">
        <TicketComposer
          canAttach
          pending={reply.isPending}
          placeholder={closed ? "Talep kapalı — yazarsanız yanıt olarak gider." : "Yanıtınızı yazın… (ekran görüntüsü yapıştırabilirsiniz)"}
          requestUpload={(f) => requestUpload.mutateAsync({ ticketId: t.id, ...f })}
          onSend={(d) => reply.mutateAsync({ ticketId: t.id, ...d, closeAfter })}
          extra={
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={closeAfter} onCheckedChange={(v) => setCloseAfter(!!v)} /> Gönder ve kapat
            </label>
          }
        />
      </div>
    </div>
  );
}
