"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCredentials } from "@/lib/auth-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mascot } from "@/components/marketing/mascot";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dental";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="mx-auto w-full flex max-w-md flex-col items-center px-4 py-16 sm:px-6">
      <Mascot className="mb-2 h-20 w-20" />
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Giriş Yap</CardTitle>
          <CardDescription>Hesabınıza erişmek için bilgilerinizi girin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              const result = await signInWithCredentials(email, password);
              setIsSubmitting(false);
              if (result?.error) {
                toast.error("E-posta veya şifre hatalı.");
                return;
              }
              router.push(callbackUrl);
              router.refresh();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Hesabınız yok mu?{" "}
            <Link href="/kayit" className="text-primary hover:underline">
              Ücretsiz başlayın
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginFormPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
