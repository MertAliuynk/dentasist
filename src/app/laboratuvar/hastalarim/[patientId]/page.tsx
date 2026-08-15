import { LabPatientDetailClient } from "@/components/lab/patient-detail-client";

export default async function LabPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <LabPatientDetailClient patientId={patientId} />;
}
