import { notFound } from "next/navigation";

// Hidden until built: e-Fatura — muhasebe kayıtlarından otomatik e-Fatura/e-Arşiv (GİB entegratörü gerekiyor).
// Removed from the nav too (src/lib/nav) — restore both together.
export default function EFaturaPage() {
  notFound();
}
