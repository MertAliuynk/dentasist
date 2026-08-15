"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";

export function ExpenseCategorySection() {
  const [name, setName] = useState("");

  const { data: categories } = trpc.expenseCategory.list.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.expenseCategory.create.useMutation({
    onSuccess: () => {
      toast.success("Gider kalemi eklendi.");
      utils.expenseCategory.list.invalidate();
      setName("");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.expenseCategory.delete.useMutation({
    onSuccess: () => {
      toast.success("Gider kalemi silindi.");
      utils.expenseCategory.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gider Kalemleri</CardTitle>
        <CardDescription>Günlük kasa gider ekleme formunda kullanılacak kategoriler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ör. Kira, Malzeme" />
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim() })}>
            Ekle
          </Button>
        </div>

        {!categories || categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Henüz gider kalemi eklenmemiş.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name}</span>
                <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove.mutate({ id: c.id })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
