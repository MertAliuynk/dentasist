import { FileText } from "lucide-react";
import { PageStub } from "@/components/shared/page-stub";

export default function EFaturaPage() {
  return (
    <PageStub
      icon={FileText}
      title="e-Fatura"
      description="Muhasebe kayıtlarından otomatik e-Fatura/e-Arşiv oluşturma desteği."
    />
  );
}
