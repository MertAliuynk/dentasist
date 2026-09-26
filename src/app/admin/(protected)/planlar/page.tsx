"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { platformTrpc } from "@/lib/platform-trpc/client";

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function PlatformPlansPage() {
  const { data: plans, isLoading } = platformTrpc.plan.list.useQuery();
  const utils = platformTrpc.useUtils();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const update = platformTrpc.plan.update.useMutation({
    onSuccess: () => {
      toast.success("Plan güncellendi.");
      utils.plan.list.invalidate();
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planlar</CardTitle>
          <CardDescription>Fiyatlandırma sayfasında gösterilen abonelik planları.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {plans?.map((plan) => {
                const draft = drafts[plan.id] ?? String(plan.priceMonthly / 100);
                const changed = Number(draft) !== plan.priceMonthly / 100;
                return (
                  <div key={plan.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-muted-foreground">Şu an: {formatMoney(plan.priceMonthly)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={draft}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                      />
                      {changed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => update.mutate({ id: plan.id, priceMonthly: Math.round(Number(draft) * 100) })}
                        >
                          Kaydet
                        </Button>
                      )}
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={(checked) => update.mutate({ id: plan.id, isActive: checked })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
