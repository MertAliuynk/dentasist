import { AddTreatmentClient } from "@/components/dental/add-treatment-client";

export default async function AddTreatmentPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <AddTreatmentClient patientId={patientId} />;
}
