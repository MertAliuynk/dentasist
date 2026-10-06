import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { brand } from "@/lib/brand";
import { SIGNUP_OPEN } from "@/lib/signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mascot } from "@/components/marketing/mascot";
import { SignUpFormPage } from "./signup-form";

export const metadata: Metadata = SIGNUP_OPEN
  ? {
      title: "Ücretsiz Başla",
      description: `${brand.name} ile kliniğinizi birkaç dakikada sisteme taşıyın. Dental ve Muhasebe modüllerini birlikte veya ayrı ayrı kullanın.`,
    }
  : { title: "Kayıt", robots: { index: false, follow: false } };

export default function SignUpPage() {
  if (SIGNUP_OPEN) return <SignUpFormPage />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <Mascot className="mb-2 h-20 w-20" />
      <Card className="w-full text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Kayıtlar şu an kapalı</CardTitle>
          <CardDescription>
            {brand.name} şu anda seçili kliniklerle test sürecinde. Hesaplar ekibimiz tarafından açılıyor; size iletilen
            bilgilerle giriş yapabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" nativeButton={false} render={<Link href="/giris" />}>
            <LogIn className="size-4" /> Giriş Yap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
