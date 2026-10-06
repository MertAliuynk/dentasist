import { SIGNUP_OPEN } from "@/lib/signup";
import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { db } from "@/server/db";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fiyatlandırma",
  description: `${brand.name} Dental ve Muhasebe modülleri için aylık fiyatlandırma. İhtiyacınıza göre plan seçin, dilediğiniz zaman yükseltin.`,
};

const MODULE_LABEL: Record<string, string> = {
  DENTAL: "Dental modülü",
  MUHASEBE: "Muhasebe modülü",
  LABORATUVAR: "Laboratuvar modülü",
};

function formatPrice(kurus: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(kurus / 100);
}

export default async function PricingPage() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fiyatlandırma</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          İhtiyacınıza göre Dental, Muhasebe ya da ikisini birlikte seçin. Dilediğiniz zaman
          yükseltebilirsiniz.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.code === "bundle" ? "border-primary shadow-md" : ""}>
            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-semibold text-foreground">
                  {formatPrice(plan.priceMonthly)}
                </span>{" "}
                / ay
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.modules.map((m) => (
                  <li key={m} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {MODULE_LABEL[m] ?? m}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  Sınırsız randevu ve hasta kaydı
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              {SIGNUP_OPEN ? (
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href={`/kayit?plan=${plan.code}`} />}
                >
                  Bu Planı Seç
                </Button>
              ) : (
                <p className="w-full text-center text-xs text-muted-foreground">
                  Pilot süreçte hesaplar ekibimiz tarafından açılıyor.
                </p>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
