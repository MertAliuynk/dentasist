import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { LoginFormPage } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş Yap",
  description: `${brand.name} hesabınıza giriş yapın ve kliniğinizi yönetmeye devam edin.`,
};

export default function LoginPage() {
  return <LoginFormPage />;
}
