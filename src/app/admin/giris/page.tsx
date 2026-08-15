"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { platformSignIn } from "@/lib/platform-auth-client";

function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-foreground text-background">
            <ShieldCheck className="size-5" />
          </span>
          <CardTitle className="text-xl">Platform Girişi</CardTitle>
          <CardDescription>Sadece dahili ekip üyeleri içindir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              const ok = await platformSignIn(email, password);
              setIsSubmitting(false);
              if (!ok) {
                toast.error("E-posta veya şifre hatalı.");
                return;
              }
              router.push(callbackUrl);
              router.refresh();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense>
      <PlatformLoginForm />
    </Suspense>
  );
}
