"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHONE_COUNTRIES, flagEmoji } from "@/lib/phone-countries";

function parsePhone(value: string): { dialCode: string; localNumber: string } {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1);
    // Match the longest known dial code first (e.g. "1" vs "994").
    const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    const match = sorted.find((c) => digits.startsWith(c.dialCode));
    if (match) {
      return { dialCode: match.dialCode, localNumber: digits.slice(match.dialCode.length).trim() };
    }
  }
  return { dialCode: "90", localNumber: trimmed };
}

// Rendered fresh per mount (dialogs/forms in this codebase remount rather
// than keep a single instance in sync with an ever-changing prop), so a
// simple defaultValue-seeded local state is enough — no need to re-parse on
// every parent re-render.
export function PhoneInput({
  defaultValue = "",
  onChange,
  placeholder,
}: {
  defaultValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const initial = parsePhone(defaultValue);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [localNumber, setLocalNumber] = useState(initial.localNumber);

  function emit(nextDialCode: string, nextLocal: string) {
    const combined = nextLocal.trim() ? `+${nextDialCode} ${nextLocal.trim()}` : "";
    onChange(combined);
  }

  return (
    <div className="flex gap-2">
      <Select
        value={dialCode}
        onValueChange={(v) => {
          const next = v ?? "90";
          setDialCode(next);
          emit(next, localNumber);
        }}
      >
        <SelectTrigger className="w-28 shrink-0">
          <SelectValue>
            {(value: string) => {
              const country = PHONE_COUNTRIES.find((c) => c.dialCode === value);
              return country ? `${flagEmoji(country.iso2)} +${country.dialCode}` : `+${value}`;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso2} value={c.dialCode}>
              {flagEmoji(c.iso2)} {c.name} (+{c.dialCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        value={localNumber}
        placeholder={placeholder ?? "5xx xxx xx xx"}
        onChange={(e) => {
          setLocalNumber(e.target.value);
          emit(dialCode, e.target.value);
        }}
      />
    </div>
  );
}
