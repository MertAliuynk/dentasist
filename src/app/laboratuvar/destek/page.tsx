import { SupportPage } from "@/components/shared/support-page";

export default function DestekPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <SupportPage {...props} />;
}
