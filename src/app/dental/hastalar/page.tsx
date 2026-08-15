"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

export default function PatientCardLookupPage() {
  const [search, setSearch] = useState("");
  const { data, isFetching } = trpc.patient.list.useQuery({ search, limit: 20 });

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Hasta Kartı Görüntüle</CardTitle>
            <CardDescription>Bir hasta seçerek kartını görüntüleyin.</CardDescription>
          </div>
          <Button size="sm" nativeButton={false} render={<Link href="/dental/hastalar/yeni" />}>
            <Plus className="size-4" />
            Yeni Hasta
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="İsim, telefon veya TC kimlik ile ara…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isFetching ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !data || data.patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Henüz hasta kaydı bulunmuyor.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.patients.map((p) => (
                <Link
                  key={p.id}
                  href={`/dental/hastalar/${p.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:text-foreground"
                >
                  <span className="font-medium">{p.fullName}</span>
                  <span className="text-muted-foreground">{p.phone}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
