"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";

const ALL = "__all__";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Eklenme · Yeni → Eski" },
  { value: "createdAt:asc", label: "Eklenme · Eski → Yeni" },
  { value: "name:asc", label: "Ad Soyad · A → Z" },
  { value: "name:desc", label: "Ad Soyad · Z → A" },
  { value: "birthDate:asc", label: "Doğum Tarihi · Küçük → Büyük" },
  { value: "birthDate:desc", label: "Doğum Tarihi · Büyük → Küçük" },
] as const;

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

export default function PatientListPage() {
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState(ALL);
  const [doctorId, setDoctorId] = useState(ALL);
  const [sort, setSort] = useState<string>("createdAt:desc");
  const [sortBy, sortDir] = sort.split(":") as ["name" | "createdAt" | "birthDate", "asc" | "desc"];

  const { data: branches } = trpc.branch.list.useQuery();
  const { data: doctors } = trpc.doctor.list.useQuery();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.patient.list.useInfiniteQuery(
    {
      search,
      branchId: branchId === ALL ? undefined : branchId,
      doctorId: doctorId === ALL ? undefined : doctorId,
      sortBy,
      sortDir,
      limit: 50,
    },
    { getNextPageParam: (last) => last.nextCursor },
  );
  const patients = data?.pages.flatMap((p) => p.patients) ?? [];
  const utils = trpc.useUtils();

  const remove = trpc.patient.delete.useMutation({
    onSuccess: () => {
      toast.success("Hasta silindi.");
      utils.patient.list.invalidate();
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hasta Listesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative flex-1 sm:min-w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Ara…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {branches && branches.length > 1 && (
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? ALL)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue>
                    {(value: string) => (value === ALL ? "Tüm Şubeler" : branches?.find((b) => b.id === value)?.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tüm Şubeler</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {doctors && doctors.length > 1 && (
              <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? ALL)}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue>
                    {(value: string) =>
                      value === ALL ? "Tüm Doktorlar" : doctors?.find((d) => d.id === value)?.user.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tüm Doktorlar</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sort} onValueChange={(v) => setSort(v ?? "createdAt:desc")}>
              <SelectTrigger className="w-full sm:w-56">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <SelectValue>{(value: string) => SORT_OPTIONS.find((o) => o.value === value)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Doktor</TableHead>
                    <TableHead>Doğum Tarihi</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/dental/hastalar/${p.id}`} className="hover:underline">
                          {p.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.primaryDoctor?.user.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.birthDate ? formatDate(p.birthDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Sil"
                          onClick={() => {
                            if (confirm(`${p.fullName} silinsin mi?`)) remove.mutate({ id: p.id });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasNextPage && (
                <div className="pt-3 text-center">
                  <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
                    {isFetchingNextPage ? "Yükleniyor…" : "Daha Fazla Yükle"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
