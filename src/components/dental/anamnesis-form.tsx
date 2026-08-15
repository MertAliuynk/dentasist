"use client";

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANAMNESIS_SECTIONS,
  type AnamnesisAnswers,
  type BooleanDetailAnswer,
} from "@/lib/dental/anamnesis-questions";

const BOOLEAN_OPTIONS: { value: BooleanDetailAnswer["value"]; label: string }[] = [
  { value: "HAYIR", label: "Hayır" },
  { value: "EVET", label: "Evet" },
  { value: "BILMIYOR", label: "Bilmiyorum" },
];

function BooleanDetailField({
  label,
  detailPlaceholder,
  value,
  onChange,
}: {
  label: string;
  detailPlaceholder?: string;
  value: BooleanDetailAnswer;
  onChange: (next: BooleanDetailAnswer) => void;
}) {
  return (
    <div className="space-y-1.5 py-2">
      <p className="text-sm">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {BOOLEAN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ ...value, value: opt.value })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              value.value === opt.value
                ? opt.value === "EVET"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value.value === "EVET" && (
        <Input
          className="mt-1"
          placeholder={detailPlaceholder ?? "Detay (opsiyonel)"}
          value={value.detail ?? ""}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
        />
      )}
    </div>
  );
}

// Every "Evet" answer is highlighted amber so a clinician scanning the
// accordion can spot clinically-relevant flags without opening every
// section — matches how real dental intake software surfaces risk items.
function sectionFlagCount(section: (typeof ANAMNESIS_SECTIONS)[number], answers: AnamnesisAnswers) {
  return section.questions.filter((q) => {
    const a = answers[q.id];
    return typeof a === "object" && a?.value === "EVET";
  }).length;
}

export function AnamnesisForm({
  answers,
  onChange,
}: {
  answers: AnamnesisAnswers;
  onChange: (next: AnamnesisAnswers) => void;
}) {
  function setAnswer(id: string, value: AnamnesisAnswers[string]) {
    onChange({ ...answers, [id]: value });
  }

  return (
    <Accordion multiple className="rounded-md border border-border px-3">
      {ANAMNESIS_SECTIONS.map((section) => {
        const flagCount = sectionFlagCount(section, answers);
        return (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {section.title}
                {flagCount > 0 && (
                  <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {flagCount} evet
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col divide-y divide-border">
                {section.questions.map((q) => {
                  if (q.type === "boolean_detail") {
                    const current = (answers[q.id] as BooleanDetailAnswer | undefined) ?? { value: "HAYIR" };
                    return (
                      <BooleanDetailField
                        key={q.id}
                        label={q.label}
                        detailPlaceholder={q.detailPlaceholder}
                        value={current}
                        onChange={(next) => setAnswer(q.id, next)}
                      />
                    );
                  }
                  if (q.type === "select") {
                    const current = (answers[q.id] as string | undefined) ?? "";
                    return (
                      <div key={q.id} className="space-y-1.5 py-2">
                        <p className="text-sm">{q.label}</p>
                        <Select value={current} onValueChange={(v) => setAnswer(q.id, v ?? "")}>
                          <SelectTrigger className="w-full sm:w-64">
                            <SelectValue placeholder="Seçin">{(v: string) => v}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {q.options.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  const current = (answers[q.id] as string | undefined) ?? "";
                  return (
                    <div key={q.id} className="space-y-1.5 py-2">
                      <p className="text-sm">{q.label}</p>
                      <Input
                        placeholder={q.placeholder}
                        value={current}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
