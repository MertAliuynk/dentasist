import { PatientCardClient } from "@/components/dental/patient-card-client";

export default async function PatientCardPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <PatientCardClient patientId={patientId} />;
}
