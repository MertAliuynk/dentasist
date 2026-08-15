"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(date));
}

export default function CallbacksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientBranchId, setPatientBranchId] = useState<string | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const { data: followUps } = trpc.followUp.list.useQuery({});
  const { data: patientResults } = trpc.patient.list.useQuery(
    { search: patientSearch, limit: 6 },
    { enabled: patientSearch.trim().length > 0 },
  );

  const utils = trpc.useUtils();
  const create = trpc.followUp.create.useMutation({
    onSuccess: () => {
      toast.success("Takip kaydı eklendi.");
      utils.followUp.list.invalidate();
      setDialogOpen(false);
      setPatientId(null);
      setPatientBranchId(null);
      setPatientLabel("");
      setPatientSearch("");
      setReason("");
      setNote("");
    },
    onError: (e) => toast.error(e.message),
  });

  const resolve = trpc.followUp.resolve.useMutation({
    onSuccess: () => {
      toast.success("Çözüldü olarak işaretlendi.");
      utils.followUp.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = followUps?.filter((f) => f.status === "PENDING") ?? [];
  const done = followUps?.filter((f) => f.status === "DONE") ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div>
            <CardTitle className="text-base">Geri Dönüşler</CardTitle>
            <CardDescription>Takip edilmesi gereken hastalar.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Ekle
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Bekleyen ({pending.length})</p>
            {pending.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Bekleyen kayıt yok.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {pending.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-medium">{f.patient.fullName}</p>
                      <p className="text-muted-foreground">{f.reason}</p>
                      {f.note && <p className="text-xs text-muted-foreground">{f.note}</p>}
                      <p className="text-xs text-muted-foreground">{formatDate(f.createdAt)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: f.id })}>
                      Çözüldü
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {done.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Çözülenler ({done.length})</p>
              <div className="flex flex-col divide-y divide-border opacity-60">
                {done.map((f) => (
                  <div key={f.id} className="py-2 text-sm">
                    <p>{f.patient.fullName}</p>
                    <p className="text-muted-foreground">{f.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Takip Kaydı Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                  <Input
                    placeholder="Hasta ara…"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientResults && patientResults.patients.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-input">
                      {patientResults.patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientBranchId(p.branchId);
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
              <Label>Neden</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ör. Gelmeyen randevu, kontrol araması"
              />
            </div>
            <div className="space-y-2">
              <Label>Not (opsiyonel)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={!patientId || !patientBranchId || !reason.trim() || create.isPending}
              onClick={() =>
                patientId &&
                patientBranchId &&
                create.mutate({
                  patientId,
                  branchId: patientBranchId,
                  reason: reason.trim(),
                  note: note || undefined,
                })
              }
            >
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
