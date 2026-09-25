"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

type SearchModule = "dental" | "muhasebe" | "laboratuvar";

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
}

// Shared "Hasta Ara" box in the app header — previously purely decorative
// (no value/onChange, ⌘K hint shown but not wired to anything). Dental and
// Muhasebe both search the same Patient model; Laboratuvar searches its own
// LabPatient model (a client clinic's patient, not the same table).
export function HeaderSearch({ module }: { module: SearchModule }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isPatientSearch = module === "dental" || module === "muhasebe";
  const { data: patientResults, isFetching: patientFetching } = trpc.patient.list.useQuery(
    { search: trimmed, limit: 6 },
    { enabled: isPatientSearch && open && trimmed.length > 0 },
  );
  const { data: labResults, isFetching: labFetching } = trpc.lab.patient.list.useQuery(
    { search: trimmed, limit: 6 },
    { enabled: module === "laboratuvar" && open && trimmed.length > 0 },
  );

  const isFetching = isPatientSearch ? patientFetching : labFetching;
  const patientHref = module === "dental" ? "/dental/hastalar" : "/muhasebe/hastalar";

  function go(href: string) {
    router.push(href);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Hasta Ara..."
        className="h-8 w-56 rounded-md border border-input bg-muted/50 pl-8 pr-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      {!query && (
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {isMac() ? "⌘K" : "Ctrl+K"}
        </kbd>
      )}

      {open && trimmed.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-80 rounded-md border border-border bg-popover shadow-md">
          {isFetching ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Aranıyor…</p>
          ) : isPatientSearch ? (
            !patientResults || patientResults.patients.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Sonuç bulunamadı.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border py-1">
                {patientResults.patients.map((p) => (
                  <Link
                    key={p.id}
                    href={`${patientHref}/${p.id}`}
                    onClick={() => go(`${patientHref}/${p.id}`)}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-xs text-muted-foreground">{p.phone}</span>
                  </Link>
                ))}
              </div>
            )
          ) : !labResults || labResults.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Sonuç bulunamadı.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border py-1">
              {labResults.map((p) => (
                <Link
                  key={p.id}
                  href={`/laboratuvar/hastalarim/${p.id}`}
                  onClick={() => go(`/laboratuvar/hastalarim/${p.id}`)}
                  className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{p.fullName}</span>
                  <span className="text-xs text-muted-foreground">{p.klinik.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
