"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { Mascot } from "@/components/marketing/mascot";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan") ?? "";

  const { data: plans, isLoading: plansLoading } = trpc.plan.list.useQuery();
  const [planCode, setPlanCode] = useState(preselectedPlan);
  const [organizationName, setOrganizationName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  const signUp = trpc.signup.create.useMutation({
    onSuccess: async () => {
      const result = await signIn("credentials", {
        email: ownerEmail,
        password: ownerPassword,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Kayıt oluşturuldu ama otomatik giriş başarısız oldu. Lütfen giriş yapın.");
        router.push("/giris");
        return;
      }
      toast.success("Hesabınız oluşturuldu, hoş geldiniz!");
      const selected = plans?.find((p) => p.code === planCode);
      if (selected?.modules.includes("DENTAL")) router.push("/dental");
      else if (selected?.modules.includes("MUHASEBE")) router.push("/muhasebe");
      else router.push("/laboratuvar");
    },
    onError: (error) => {
      toastError(error, "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    },
  });

  return (
    <div className="mx-auto w-full flex max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <Mascot className="mb-2 h-20 w-20" />
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Hesap Oluşturun</CardTitle>
          <CardDescription>Kliniğinizi birkaç dakikada sisteme taşıyın.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!planCode) {
                toast.error("Lütfen bir plan seçin.");
                return;
              }
              signUp.mutate({
                organizationName,
                planCode,
                ownerName,
                ownerEmail,
                ownerPassword,
                discountCode: discountCode || undefined,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
                disabled={plansLoading}
                required
              >
                <option value="" disabled>
                  {plansLoading ? "Yükleniyor…" : "Plan seçin"}
                </option>
                {plans?.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">Klinik / İşletme Adı</Label>
              <Input
                id="organizationName"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerName">Ad Soyad</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">E-posta</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Şifre</Label>
              <Input
                id="ownerPassword"
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">En az 8 karakter.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountCode">İndirim Kodu (opsiyonel)</Label>
              <Input
                id="discountCode"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="Varsa indirim kodunuzu girin"
              />
            </div>

            <Button type="submit" className="w-full" disabled={signUp.isPending}>
              {signUp.isPending ? "Hesap oluşturuluyor…" : "Hesap Oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignUpFormPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
