"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(date));
}

export function CloseSlotDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [reason, setReason] = useState("");

  const { data: doctors } = trpc.doctor.list.useQuery(undefined, { enabled: open });
  const { data: rooms } = trpc.room.list.useQuery(undefined, { enabled: open });
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 1);
  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 3);
  const { data: blocks } = trpc.appointmentBlock.listRange.useQuery(
    { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    { enabled: open },
  );

  const utils = trpc.useUtils();
  const selectedDoctor = doctors?.find((d) => d.id === doctorId);

  const create = trpc.appointmentBlock.create.useMutation({
    onSuccess: () => {
      toast.success("Saat kapatıldı.");
      utils.appointmentBlock.listRange.invalidate();
      setReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.appointmentBlock.delete.useMutation({
    onSuccess: () => {
      toast.success("Kapatma kaldırıldı.");
      utils.appointmentBlock.listRange.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saat Kapat</DialogTitle>
          <DialogDescription>
            Bir hekim ve/veya odanın belirli bir zaman aralığını randevuya kapatın.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Hekim (opsiyonel)</Label>
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tüm hekimler">
                  {(value: string) => doctors?.find((d) => d.id === value)?.user.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {doctors?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Oda (opsiyonel)</Label>
            <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tüm odalar">
                  {(value: string) => rooms?.find((r) => r.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {rooms?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Neden (opsiyonel)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ör. İzin, tatil, tadilat" />
          </div>

          <Button
            className="w-full"
            disabled={!doctorId && !roomId}
            onClick={() =>
              create.mutate({
                branchId: selectedDoctor?.branchId ?? rooms?.find((r) => r.id === roomId)?.branchId ?? "",
                doctorId: doctorId || undefined,
                roomId: roomId || undefined,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                reason: reason || undefined,
              })
            }
          >
            Kapat
          </Button>

          {blocks && blocks.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">Mevcut Kapatmalar</p>
              <div className="flex max-h-48 flex-col divide-y divide-border overflow-y-auto">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div>
                      <p className="font-medium">
                        {formatDateTime(b.startsAt)} – {formatDateTime(b.endsAt)}
                      </p>
                      <p className="text-muted-foreground">
                        {[b.doctor?.user.name, b.room?.name, b.reason].filter(Boolean).join(" · ") || "Genel"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Kaldır"
                      onClick={() => remove.mutate({ id: b.id })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
