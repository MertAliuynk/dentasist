"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { platformTrpc } from "@/lib/platform-trpc/client";
import { fmtDateTime, fmtRelative } from "@/components/platform/platform-format";

const KIND_LABEL: Record<string, string> = { mutation: "İşlem", query: "Veri", render: "Sayfa (sunucu)", client: "Sayfa (tarayıcı)" };

export default function PlatformErrorLogPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState<"ALL" | "api" | "page">("ALL");
  const [hideUserErrors, setHideUserErrors] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = platformTrpc.organization.errorLog.useInfiniteQuery(
    { search: debounced || undefined, kind, hideUserErrors },
    { getNextPageParam: (l) => l.nextCursor, refetchInterval: 60_000 },
  );
  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hata Kayıtları</CardTitle>
          <CardDescription>
            Tüm kliniklerde oluşan hatalar. Müşterinin ilettiği referans kodunu (HT-… veya sayfa hata kodu) arayarak doğrudan
            ilgili kayda ulaşabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-60 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Referans, işlem, mesaj veya klinik…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {(["ALL", "api", "page"] as const).map((k) => (
              <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
                {k === "ALL" ? "Tümü" : k === "api" ? "İşlemler" : "Sayfa çökmeleri"}
              </Button>
            ))}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={hideUserErrors} onCheckedChange={setHideUserErrors} /> Sadece gerçek hatalar
            </label>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt yok. 🎉</p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {logs.map((l) => (
                <div key={l.id}>
                  <button
                    type="button"
                    className="grid w-full gap-1 px-3 py-2 text-left text-sm hover:bg-accent/40 sm:grid-cols-[9rem_1fr_auto] sm:items-start sm:gap-3"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  >
                    <span className="font-mono text-xs tabular-nums text-muted-foreground" title={fmtDateTime(l.createdAt)}>
                      {fmtRelative(l.createdAt)}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{l.organization?.name ?? "Oturumsuz / genel"}</span>
                      <span className="text-muted-foreground"> · {l.userName ?? "—"} · </span>
                      <code className="text-xs">{l.path}</code>
                      <span className="block truncate text-xs text-destructive">{l.errorMessage?.split("\n")[0]}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {KIND_LABEL[l.kind] ?? l.kind}
                      </Badge>
                      {l.ref && <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{l.ref}</code>}
                    </span>
                  </button>
                  {expanded === l.id && (
                    <div className="space-y-2 border-t border-border bg-muted/30 px-3 py-2 text-xs">
                      <p className="text-muted-foreground">
                        {fmtDateTime(l.createdAt)} · kod: {l.errorCode ?? "—"} · IP: {l.ip ?? "—"}
                        {l.organization && (
                          <>
                            {" · "}
                            <Link className="underline" href={`/admin/organizasyonlar/${l.organization.id}?sekme=kayitlar&ara=${encodeURIComponent(l.ref ?? "")}`}>
                              kliniğin işlem kayıtlarında aç
                            </Link>
                          </>
                        )}
                      </p>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 font-mono text-[11px]">
                        {l.errorMessage}
                      </pre>
                      {l.input != null && (
                        <pre className="max-h-64 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px]">
                          {JSON.stringify(l.input, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {hasNextPage && (
            <div className="text-center">
              <Button variant="outline" size="sm" disabled={isFetching} onClick={() => fetchNextPage()}>
                Daha Eski
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
