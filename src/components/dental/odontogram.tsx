"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PERMANENT_UPPER, PERMANENT_LOWER, BABY_UPPER, BABY_LOWER } from "@/lib/dental/teeth";

type ChartView = "UST" | "ALT" | "PERMANENT" | "BABY";

const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "UST", label: "Üst Çene" },
  { value: "ALT", label: "Alt Çene" },
  { value: "PERMANENT", label: "Sürekli Dişler" },
  { value: "BABY", label: "Süt Dişleri" },
];

function Tooth({
  number,
  selected,
  onClick,
  flipped,
}: {
  number: number;
  selected: boolean;
  onClick: () => void;
  flipped?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${flipped ? "flex-col-reverse" : "flex-col"} items-center gap-1`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-md border text-xs transition-colors ${
          selected
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-foreground hover:bg-accent"
        }`}
        style={{ clipPath: "polygon(15% 0%, 85% 0%, 100% 70%, 50% 100%, 0% 70%)" }}
      >
        <span className={flipped ? "mb-2" : "mt-2"}>{number}</span>
      </span>
    </button>
  );
}

export function Odontogram({
  selectedTeeth,
  onToggleTooth,
}: {
  selectedTeeth: number[];
  onToggleTooth: (tooth: number) => void;
}) {
  const [view, setView] = useState<ChartView>("PERMANENT");

  const showUpper = view === "UST" || view === "PERMANENT" || view === "BABY";
  const showLower = view === "ALT" || view === "PERMANENT" || view === "BABY";
  const isBaby = view === "BABY";

  const upperRow = isBaby ? BABY_UPPER : PERMANENT_UPPER;
  const lowerRow = isBaby ? BABY_LOWER : PERMANENT_LOWER;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {VIEW_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={view === opt.value ? "default" : "outline"}
            onClick={() => setView(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-6">
        {showUpper && (
          <div className="mb-6 flex flex-wrap justify-center gap-1.5">
            {upperRow.map((n, i) => (
              <div key={n} className="flex items-center">
                {i === upperRow.length / 2 && <div className="mx-1.5 h-9 w-px bg-border" />}
                <Tooth number={n} selected={selectedTeeth.includes(n)} onClick={() => onToggleTooth(n)} />
              </div>
            ))}
          </div>
        )}
        {showUpper && showLower && <div className="mb-6 h-px w-full bg-border" />}
        {showLower && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {lowerRow.map((n, i) => (
              <div key={n} className="flex items-center">
                {i === lowerRow.length / 2 && <div className="mx-1.5 h-9 w-px bg-border" />}
                <Tooth number={n} selected={selectedTeeth.includes(n)} onClick={() => onToggleTooth(n)} flipped />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Seçili Dişler: {selectedTeeth.length === 0 ? "Yok" : selectedTeeth.sort((a, b) => a - b).join(", ")}
      </p>
    </div>
  );
}

export function JawPicker({
  selectedJaw,
  onSelectJaw,
}: {
  selectedJaw: "UST" | "ALT" | null;
  onSelectJaw: (jaw: "UST" | "ALT") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["UST", "ALT"] as const).map((jaw) => (
        <button
          key={jaw}
          type="button"
          onClick={() => onSelectJaw(jaw)}
          className={`rounded-lg border p-6 text-center text-sm font-medium transition-colors ${
            selectedJaw === jaw
              ? "border-foreground bg-foreground text-background"
              : "border-border hover:bg-accent"
          }`}
        >
          {jaw === "UST" ? "Üst Çene" : "Alt Çene"}
        </button>
      ))}
    </div>
  );
}
