import { MessagingClient } from "@/components/dental/messaging-client";

export default async function SmsServicesPage({ searchParams }: { searchParams: Promise<{ hasta?: string }> }) {
  const { hasta } = await searchParams;
  return <MessagingClient channel="SMS" initialPatientId={hasta} />;
}
