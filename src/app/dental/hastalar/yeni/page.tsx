"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { PhoneInput } from "@/components/shared/phone-input";
import { AnamnesisForm } from "@/components/dental/anamnesis-form";
import type { AnamnesisAnswers } from "@/lib/dental/anamnesis-questions";

function isDoctorOnlyClient(roles: string[]) {
  const set = new Set(roles);
  return set.size === 1 && set.has("DOKTOR");
}

export default function NewPatientPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [primaryDoctorId, setPrimaryDoctorId] = useState("");
  const [tcKimlikNo, setTcKimlikNo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [anamnesisAnswers, setAnamnesisAnswers] = useState<AnamnesisAnswers>({});
  const [companionName, setCompanionName] = useState("");
  const [companionPhone, setCompanionPhone] = useState("");

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const doctorOnly = me ? isDoctorOnlyClient(me.memberships.map((m) => m.role)) : false;
  const myDoctor = doctors?.find((d) => d.user.id === me?.id);

  // Single-branch orgs and doctor-only accounts have nothing to choose —
  // auto-assign instead of making the user pick the only valid option.
  const effectiveBranchId =
    branches && branches.length === 1 ? branches[0].id : doctorOnly && myDoctor ? myDoctor.branchId : branchId;
  const effectivePrimaryDoctorId = doctorOnly && myDoctor ? myDoctor.id : primaryDoctorId;

  const create = trpc.patient.create.useMutation({
    onSuccess: (patient) => {
      toast.success("Hasta eklendi.");
      router.push(`/dental/hastalar/${patient.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni Hasta Ekle</CardTitle>
          <CardDescription>Zorunlu alanlar: ad soyad, telefon ve şube.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ad Soyad</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <PhoneInput onChange={setPhone} />
          </div>
          {branches && branches.length > 1 && (
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Şube seçin">
                    {(value: string) => branches?.find((b) => b.id === value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!doctorOnly && (
            <div className="space-y-2">
              <Label>İlgili Doktor (opsiyonel)</Label>
              <Select value={primaryDoctorId} onValueChange={(v) => setPrimaryDoctorId(v ?? "")}>
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
          )}
          <div className="space-y-2">
            <Label>TC Kimlik No (opsiyonel)</Label>
            <Input value={tcKimlikNo} onChange={(e) => setTcKimlikNo(e.target.value)} maxLength={11} />
          </div>
          <div className="space-y-2">
            <Label>Doğum Tarihi (opsiyonel)</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="space-y-2 rounded-md border border-border p-3">
            <Label>Refakatçi (opsiyonel)</Label>
            <Input
              placeholder="Ad Soyad"
              value={companionName}
              onChange={(e) => setCompanionName(e.target.value)}
            />
            <PhoneInput onChange={setCompanionPhone} placeholder="Refakatçi telefonu" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anamnez</CardTitle>
          <CardDescription>Hastanın tıbbi geçmişini bölüm bölüm işaretleyin (tümü opsiyoneldir).</CardDescription>
        </CardHeader>
        <CardContent>
          <AnamnesisForm answers={anamnesisAnswers} onChange={setAnamnesisAnswers} />
        </CardContent>
      </Card>

      <Button
        disabled={create.isPending || !fullName.trim() || !phone.trim() || !effectiveBranchId}
        onClick={() =>
          create.mutate({
            fullName: fullName.trim(),
            phone: phone.trim(),
            branchId: effectiveBranchId,
            primaryDoctorId: effectivePrimaryDoctorId || undefined,
            tcKimlikNo: tcKimlikNo || undefined,
            birthDate: birthDate || undefined,
            anamnesisAnswers: Object.keys(anamnesisAnswers).length > 0 ? anamnesisAnswers : undefined,
            companions: companionName.trim()
              ? [{ fullName: companionName.trim(), phone: companionPhone || undefined }]
              : undefined,
          })
        }
      >
        Hasta Ekle
      </Button>
    </div>
  );
}
