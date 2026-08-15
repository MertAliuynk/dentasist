"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatMoney(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(kurus / 100);
}

export default function FinancialReportsPage() {
  const [start, setStart] = useState(isoDaysAgo(90));
  const [end, setEnd] = useState(isoDaysAgo(0));

  const { data } = trpc.reportsMuhasebe.summary.useQuery({
    start: new Date(start).toISOString(),
    end: new Date(end + "T23:59:59").toISOString(),
  });

  const totalIncome = data?.dailyBreakdown.reduce((s, d) => s + d.income, 0) ?? 0;
  const totalExpense = data?.dailyBreakdown.reduce((s, d) => s + d.expense, 0) ?? 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Finansal Raporlar</CardTitle>
          <CardDescription>Seçili dönemdeki gelir-gider trendi.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>Başlangıç</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bitiş</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Toplam Gelir</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalIncome)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Toplam Gider</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalExpense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Net</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(totalIncome - totalExpense)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Günlük Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.dailyBreakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyBreakdown}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 100).toFixed(0)}₺`} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Gelir" stroke="#10b981" fill="url(#incomeGradient)" />
                  <Area type="monotone" dataKey="expense" name="Gider" stroke="#ef4444" fill="url(#expenseGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
