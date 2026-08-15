import { LabKlinikDetailClient } from "@/components/lab/klinik-detail-client";

export default async function LabKlinikDetailPage({
  params,
}: {
  params: Promise<{ klinikId: string }>;
}) {
  const { klinikId } = await params;
  return <LabKlinikDetailClient klinikId={klinikId} />;
}
