import { OrgSettingsClient } from "@/components/shared/org-settings-client";

export default function DentalSettingsPage() {
  return <OrgSettingsClient moduleType="dental" yonetimHref="/dental/yonetim" />;
}
