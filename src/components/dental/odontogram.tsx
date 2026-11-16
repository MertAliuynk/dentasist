"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import PermanentTeethSvg, {
  FULL_VIEWBOX,
  UPPER_VIEWBOX,
  LOWER_VIEWBOX,
} from "@/components/dental/teeth-svg/permanent-teeth-svg";
import MilkTeethSvg from "@/components/dental/teeth-svg/milk-teeth-svg";

type ChartView = "UST" | "ALT" | "PERMANENT" | "BABY";

const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "UST", label: "Üst Çene" },
  { value: "ALT", label: "Alt Çene" },
  { value: "PERMANENT", label: "Sürekli Dişler" },
  { value: "BABY", label: "Süt Dişleri" },
];

export function Odontogram({
  selectedTeeth,
  onToggleTooth,
}: {
  selectedTeeth: number[];
  onToggleTooth: (tooth: number) => void;
}) {
  const [view, setView] = useState<ChartView>("PERMANENT");

  const isBaby = view === "BABY";

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

      <div className="rounded-lg border border-border bg-muted/30 p-4 sm:p-6">
        {isBaby ? (
          <MilkTeethSvg selectedTeeth={selectedTeeth} onToggleTooth={onToggleTooth} />
        ) : (
          <PermanentTeethSvg
            selectedTeeth={selectedTeeth}
            onToggleTooth={onToggleTooth}
            viewBox={view === "UST" ? UPPER_VIEWBOX : view === "ALT" ? LOWER_VIEWBOX : FULL_VIEWBOX}
          />
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Seçili Dişler: {selectedTeeth.length === 0 ? "Yok" : [...selectedTeeth].sort((a, b) => a - b).join(", ")}
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
