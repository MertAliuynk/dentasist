"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const STATUS_LABEL: Record<string, string> = { OPEN: "Açık", ANSWERED: "Yanıtlandı", CLOSED: "Kapalı" };
const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  OPEN: "destructive",
  ANSWERED: "secondary",
  CLOSED: "outline",
};

const PRIORITY_LABEL: Record<string, string> = { DUSUK: "Düşük", NORMAL: "Normal", YUKSEK: "Yüksek", ACIL: "Acil" };
const PRIORITY_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  DUSUK: "outline",
  NORMAL: "secondary",
  YUKSEK: "outline",
  ACIL: "destructive",
};
const CATEGORY_LABEL: Record<string, string> = {
  TEKNIK: "Teknik Destek",
  FATURALAMA: "Faturalama",
  OZELLIK_TALEBI: "Özellik Talebi",
  DIGER: "Diğer",
};

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export function SupportTicketClient() {
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<string>("NORMAL");
  const [category, setCategory] = useState<string>("DIGER");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: tickets } = trpc.supportTicket.list.useQuery();
  const utils = trpc.useUtils();

  const create = trpc.supportTicket.create.useMutation({
    onSuccess: () => {
      toast.success("Destek talebiniz oluşturuldu.");
      utils.supportTicket.list.invalidate();
      setNewOpen(false);
      setSubject("");
      setMessage("");
      setPriority("NORMAL");
      setCategory("DIGER");
    },
    onError: (e) => toast.error(e.message),
  });

  const reply = trpc.supportTicket.reply.useMutation({
    onSuccess: () => {
      toast.success("Mesaj gönderildi.");
      utils.supportTicket.list.invalidate();
      setReplyBody("");
    },
    onError: (e) => toast.error(e.message),
  });

  const openTicket = tickets?.find((t) => t.id === openTicketId);

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="size-4" />
              Destek Talepleri
            </CardTitle>
            <CardDescription>Bir sorun mu var? Destek talebi açın, ekibimiz size dönüş yapsın.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            Yeni Talep
          </Button>
        </CardHeader>
        <CardContent>
          {!tickets || tickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henüz destek talebiniz yok.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm hover:bg-accent"
                  onClick={() => setOpenTicketId(t.id)}
                >
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[t.category] ?? t.category} · {formatDateTime(t.updatedAt)} · {t.messages.length} mesaj
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={PRIORITY_VARIANT[t.priority]}>{PRIORITY_LABEL[t.priority] ?? t.priority}</Badge>
                    <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Destek Talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Konu" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hizmet</Label>
                <Select value={category} onValueChange={(v) => setCategory(v ?? "DIGER")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => CATEGORY_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Önem Derecesi</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? "NORMAL")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(value: string) => PRIORITY_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Textarea
              placeholder="Sorununuzu kısaca anlatın…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!subject.trim() || !message.trim() || create.isPending}
              onClick={() =>
                create.mutate({
                  subject: subject.trim(),
                  message: message.trim(),
                  priority: priority as "DUSUK" | "NORMAL" | "YUKSEK" | "ACIL",
                  category: category as "TEKNIK" | "FATURALAMA" | "OZELLIK_TALEBI" | "DIGER",
                })
              }
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openTicketId} onOpenChange={(o) => !o && setOpenTicketId(null)}>
        <DialogContent className="sm:max-w-lg">
          {openTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {openTicket.subject}
                  <Badge variant={STATUS_VARIANT[openTicket.status]}>{STATUS_LABEL[openTicket.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
                {openTicket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-2.5 text-sm ${m.authorPlatformUser ? "bg-accent" : "bg-muted"}`}
                  >
                    <p>{m.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.authorPlatformUser ? `${m.authorPlatformUser.name} (Destek Ekibi)` : m.authorUser?.name} ·{" "}
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Yanıt yazın…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <Button
                  disabled={!replyBody.trim() || reply.isPending}
                  onClick={() => {
                    reply.mutate({ ticketId: openTicket.id, body: replyBody.trim() });
                  }}
                >
                  Gönder
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
