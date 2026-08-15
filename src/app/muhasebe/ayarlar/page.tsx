import { OrgSettingsClient } from "@/components/shared/org-settings-client";

export default function MuhasebeSettingsPage() {
  return <OrgSettingsClient moduleType="muhasebe" yonetimHref="/muhasebe/yonetim" />;
}
