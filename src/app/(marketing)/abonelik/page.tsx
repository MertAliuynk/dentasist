import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SubscriptionUpsellPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-24 sm:px-6">
      <Card>
        <CardHeader className="items-center text-center">
          <Lock className="mb-2 size-8 text-muted-foreground" />
          <CardTitle className="text-xl">Bu modül aboneliğinizde aktif değil</CardTitle>
          <CardDescription>
            Erişmeye çalıştığınız modül mevcut planınıza dahil değil. Planınızı yükseltmek için
            bizimle iletişime geçin.
          </CardDescription>
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
