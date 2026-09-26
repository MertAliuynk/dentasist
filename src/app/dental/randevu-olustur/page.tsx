"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// A quick, dedicated appointment-creation page — separate from the calendar
// for staff who just want to book a slot without opening the full takvim.
export default function CreateAppointmentPage() {
  const router = useRouter();
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [endsAt, setEndsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 90 * 60 * 1000)));
  const [note, setNote] = useState("");

  const { data: doctors } = trpc.doctor.list.useQuery();
  const { data: rooms } = trpc.room.list.useQuery();
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: patientSearch.trim().length > 0 },
  );

  const selectedDoctor = doctors?.find((d) => d.id === doctorId);
  const branchRooms = rooms?.filter((r) => r.branchId === selectedDoctor?.branchId) ?? [];

  const create = trpc.appointment.create.useMutation({
    onSuccess: () => {
      toast.success("Randevu oluşturuldu.");
      router.push("/dental/randevu-takvimi");
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Randevu Oluştur</CardTitle>
          <CardDescription>Takvimi açmadan hızlıca bir randevu oluşturun.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Hasta</Label>
            {patientId ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span>{patientLabel}</span>
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
                          setPatientLabel(p.fullName);
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
            <Label>Doktor</Label>
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Doktor seçin">
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

          {branchRooms.length > 0 && (
            <div className="space-y-2">
              <Label>Oda (opsiyonel)</Label>
              <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Oda seçin">
                    {(value: string) => branchRooms.find((r) => r.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branchRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <Button
            className="w-full"
            disabled={!patientId || !doctorId || create.isPending}
            onClick={() => {
              if (!patientId || !selectedDoctor) return;
              create.mutate({
                patientId,
                doctorId,
                branchId: selectedDoctor.branchId,
                roomId: roomId || undefined,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                note: note || undefined,
              });
            }}
          >
            Randevu Oluştur
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
