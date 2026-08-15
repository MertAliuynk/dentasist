"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { platformTrpc } from "@/lib/platform-trpc/client";

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

export function SupportTicketsClient() {
  const [status, setStatus] = useState<string>("");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: tickets } = platformTrpc.supportTicket.list.useQuery({
    status: (status || undefined) as "OPEN" | "ANSWERED" | "CLOSED" | undefined,
  });
  const utils = platformTrpc.useUtils();

  const reply = platformTrpc.supportTicket.reply.useMutation({
    onSuccess: () => {
      toast.success("Yanıt gönderildi.");
      utils.supportTicket.list.invalidate();
      setReplyBody("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = platformTrpc.supportTicket.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Durum güncellendi.");
      utils.supportTicket.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openTicket = tickets?.find((t) => t.id === openTicketId);

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">Destek Talepleri</CardTitle>
            <CardDescription>Tüm kliniklerden gelen destek talepleri.</CardDescription>
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tüm Durumlar">{(value: string) => STATUS_LABEL[value]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!tickets || tickets.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
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
                    <p className="font-medium">
                      {t.subject} <span className="font-normal text-muted-foreground">· {t.organization.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[t.category] ?? t.category} · {t.createdBy.name} · {t.createdIp ?? "IP yok"} ·{" "}
                      {formatDateTime(t.updatedAt)}
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

      <Dialog open={!!openTicketId} onOpenChange={(o) => !o && setOpenTicketId(null)}>
        <DialogContent className="sm:max-w-lg">
          {openTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {openTicket.subject}
                  <Badge variant={PRIORITY_VARIANT[openTicket.priority]}>{PRIORITY_LABEL[openTicket.priority]}</Badge>
                  <Badge variant={STATUS_VARIANT[openTicket.status]}>{STATUS_LABEL[openTicket.status]}</Badge>
                </DialogTitle>
                <DialogDescription>
                  {openTicket.organization.name} · {openTicket.createdBy.name} ({openTicket.createdBy.email}) · IP:{" "}
                  {openTicket.createdIp ?? "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                {openTicket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-2.5 text-sm ${m.authorPlatformUser ? "bg-accent" : "bg-muted"}`}
                  >
                    <p>{m.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.authorPlatformUser ? `${m.authorPlatformUser.name} (Destek Ekibi)` : m.authorUser?.name} ·{" "}
                      {formatDateTime(m.createdAt)}
                      {m.createdIp && ` · IP: ${m.createdIp}`}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Input placeholder="Yanıt yazın…" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                <Button
                  disabled={!replyBody.trim() || reply.isPending}
                  onClick={() => reply.mutate({ ticketId: openTicket.id, body: replyBody.trim() })}
                >
                  Gönder
                </Button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                {openTicket.status !== "CLOSED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ ticketId: openTicket.id, status: "CLOSED" })}
                  >
                    Talebi Kapat
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
