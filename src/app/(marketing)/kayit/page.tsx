import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { SignUpFormPage } from "./signup-form";

export const metadata: Metadata = {
  title: "Ücretsiz Başla",
  description: `${brand.name} ile kliniğinizi birkaç dakikada sisteme taşıyın. Dental ve Muhasebe modüllerini birlikte veya ayrı ayrı kullanın.`,
};

export default function SignUpPage() {
  return <SignUpFormPage />;
}
