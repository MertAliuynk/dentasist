"use client";

import { useState } from "react";
import { Printer, Search, FileHeart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import {
  ANAMNESIS_SECTIONS,
  type AnamnesisAnswers,
  type BooleanDetailAnswer,
} from "@/lib/dental/anamnesis-questions";

const BOOLEAN_LABEL: Record<BooleanDetailAnswer["value"], string> = {
  EVET: "Evet",
  HAYIR: "Hayır",
  BILMIYOR: "Bilmiyorum",
};

function isMeaningfulAnswer(value: AnamnesisAnswers[string] | undefined): value is AnamnesisAnswers[string] {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return value.value !== "HAYIR" || !!value.detail;
}

function AnamnesisReport({ answers }: { answers: AnamnesisAnswers }) {
  const sectionsWithAnswers = ANAMNESIS_SECTIONS.map((section) => ({
    section,
    questions: section.questions.filter((q) => isMeaningfulAnswer(answers[q.id])),
  })).filter((s) => s.questions.length > 0);

  if (sectionsWithAnswers.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Bu hasta için doldurulmuş anamnez kaydı yok.</p>;
  }

  return (
    <div className="space-y-5">
      {sectionsWithAnswers.map(({ section, questions }) => (
        <div key={section.key}>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{section.title}</h3>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {questions.map((q) => {
              const a = answers[q.id];
              return (
                <div key={q.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                  <span>{q.label}</span>
                  <span className="font-medium">
                    {typeof a === "string"
                      ? a
                      : `${BOOLEAN_LABEL[a.value]}${a.detail ? ` · ${a.detail}` : ""}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnamnezFormlariPage() {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);

  const { data: results } = trpc.patient.list.useQuery(
    { search, limit: 8 },
    { enabled: search.trim().length > 0 && !patientId },
  );
  const { data: patient } = trpc.patient.getById.useQuery({ id: patientId ?? "" }, { enabled: !!patientId });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Anamnez Formları</CardTitle>
          <CardDescription>
            Bir hasta seçerek Hasta Ekle sırasında doldurulan yapılandırılmış anamnez kaydını görüntüleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {patientId && patient ? (
            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{patient.fullName}</p>
                <p className="text-xs text-muted-foreground">{patient.phone}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPatientId(null)}>
                Değiştir
              </Button>
            </div>
          ) : (
            <>
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
                        setPatientId(p.id);
                        setSearch("");
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
        </CardContent>
      </Card>

      {patient ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{patient.fullName} · Anamnez</CardTitle>
              <CardDescription>Telefon: {patient.phone}</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
              <Printer className="size-4" />
              Yazdır
            </Button>
          </CardHeader>
          <CardContent>
            <AnamnesisReport answers={(patient.anamnesisAnswers as AnamnesisAnswers | null) ?? {}} />
            {patient.anamnesis && (
              <div className="mt-5 border-t border-border pt-3">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Eski Not (Serbest Metin)</h3>
                <p className="text-sm">{patient.anamnesis}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="print:hidden">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FileHeart className="size-8" />
            Anamnez kaydını görüntülemek için bir hasta seçin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
