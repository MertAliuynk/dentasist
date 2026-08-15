import { DoctorFinancialsClient } from "@/components/muhasebe/doctor-financials-client";

export default async function DoctorFinancialDetailPage({
  params,
}: {
  params: Promise<{ doctorId: string }>;
}) {
  const { doctorId } = await params;
  return <DoctorFinancialsClient doctorId={doctorId} />;
}
