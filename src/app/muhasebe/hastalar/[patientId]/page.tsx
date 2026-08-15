import { PatientFinanceClient } from "@/components/muhasebe/patient-finance-client";

export default async function MuhasebePatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <PatientFinanceClient patientId={patientId} />;
}
