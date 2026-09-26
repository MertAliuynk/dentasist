"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toastError } from "@/lib/error-report";
import { FileSignature, Printer, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { CONSENT_FORM_CATEGORIES, CONSENT_FORM_TEMPLATES } from "@/lib/dental/consent-form-templates";
import { ConsentFormPrintView } from "@/components/dental/consent-form-print-view";

function PatientPicker({
  patientId,
  onSelect,
}: {
  patientId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: patient } = trpc.patient.getById.useQuery({ id: patientId ?? "" }, { enabled: !!patientId });
  const { data: results } = trpc.patient.list.useQuery(
    { search, limit: 8 },
    { enabled: search.trim().length > 0 && !patientId },
  );

  if (patientId && patient) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
        <div>
          <p className="font-medium">{patient.fullName}</p>
          <p className="text-xs text-muted-foreground">{patient.phone}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Değiştir
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Hasta ara…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {results && results.patients.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-input">
          {results.patients.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                onSelect(p.id);
                setSearch("");
              }}
            >
              <span>{p.fullName}</span>
              <span className="text-muted-foreground">{p.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OnamFormuClient() {
  const searchParams = useSearchParams();
  const [patientId, setPatientId] = useState<string | null>(searchParams.get("patientId"));
  const [templateKey, setTemplateKey] = useState<string | null>(null);

  const { data: patient } = trpc.patient.getById.useQuery({ id: patientId ?? "" }, { enabled: !!patientId });
  const { data: me } = trpc.user.me.useQuery();
  const { data: branches } = trpc.branch.list.useQuery();
  const utils = trpc.useUtils();

  const branch = branches?.find((b) => b.id === patient?.branchId);
  const template = CONSENT_FORM_TEMPLATES.find((t) => t.key === templateKey);

  const create = trpc.patientConsentForm.create.useMutation({
    onSuccess: () => {
      if (patientId) utils.patientConsentForm.list.invalidate({ patientId });
    },
    onError: (e) => toastError(e),
  });

  function handlePrint() {
    if (!patientId || !templateKey) return;
    create.mutate({ patientId, templateKey });
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="mx-auto w-full flex max-w-4xl flex-col gap-4">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Onam Formları</CardTitle>
          <CardDescription>
            Hasta seçin, uygulanacak tedaviye uygun onam formunu belirleyin; hastanın bilgileri forma otomatik eklenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Hasta</label>
            <PatientPicker patientId={patientId} onSelect={setPatientId} />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Onam Formu Türü</label>
            {CONSENT_FORM_CATEGORIES.map((category) => (
              <div key={category}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{category}</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONSENT_FORM_TEMPLATES.filter((t) => t.category === category).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      title={t.summary}
                      onClick={() => setTemplateKey(t.key)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        templateKey === t.key
                          ? "border-foreground bg-foreground text-background"
                          : "border-input text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" disabled={!patientId || !templateKey} onClick={handlePrint}>
            <Printer className="size-4" />
            Formu Oluştur ve Yazdır
          </Button>
        </CardContent>
      </Card>

      {patient && template ? (
        <ConsentFormPrintView
          organizationName={me?.organizationName ?? ""}
          branch={branch}
          patient={patient}
          template={template}
        />
      ) : (
        <Card className="print:hidden">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FileSignature className="size-8" />
            Önizlemeyi görmek için bir hasta ve onam formu türü seçin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ConsentFormPage() {
  return (
    <Suspense>
      <OnamFormuClient />
    </Suspense>
  );
}
