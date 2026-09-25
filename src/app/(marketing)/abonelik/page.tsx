import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { isSubscriptionUsable } from "@/lib/subscription-access";

export const dynamic = "force-dynamic";

function reasonFor(sub: { status: string | null; endsAt: string | null } | null | undefined) {
  if (!sub || isSubscriptionUsable(sub.status, sub.endsAt)) {
    return {
      title: "Bu modül aboneliğinizde aktif değil",
      body: "Erişmeye çalıştığınız modül mevcut planınıza dahil değil. Planınızı yükseltmek için bizimle iletişime geçin.",
    };
  }
  if (sub.status === "CANCELED") {
    return {
      title: "Aboneliğiniz kapatıldı",
      body: "Hesabınıza erişim şu an kapalı. Verileriniz silinmedi — yeniden açmak için bizimle iletişime geçin.",
    };
  }
  if (sub.status === "PENDING_PAYMENT") {
    return {
      title: "Ödeme bekleniyor",
      body: "Aboneliğiniz ödeme onayı bekliyor. Ödemeniz onaylandığında erişiminiz otomatik açılacaktır.",
    };
  }
  return {
    title: sub.status === "TRIAL" ? "Deneme süreniz sona erdi" : "Abonelik süreniz sona erdi",
    body: "Verileriniz güvende. Kullanmaya devam etmek için planınızı yenilemek üzere bizimle iletişime geçin.",
  };
}

export default async function SubscriptionUpsellPage() {
  const session = await auth();
  const { title, body } = reasonFor(session?.user?.subscription);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-24 sm:px-6">
      <Card>
        <CardHeader className="items-center text-center">
          <Lock className="mb-2 size-8 text-muted-foreground" />
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button nativeButton={false} render={<Link href="/fiyatlandirma" />}>
            Fiyatlandırmayı İncele
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
