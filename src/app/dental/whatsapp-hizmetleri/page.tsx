import { MessagingClient } from "@/components/dental/messaging-client";

export default async function WhatsAppServicesPage({ searchParams }: { searchParams: Promise<{ hasta?: string }> }) {
  const { hasta } = await searchParams;
  return <MessagingClient channel="WHATSAPP" initialPatientId={hasta} />;
}
