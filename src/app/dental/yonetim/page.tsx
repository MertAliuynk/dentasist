import { StaffAdminClient } from "@/components/shared/staff-admin-client";
import { BranchSection, StaffCreateSection } from "@/components/shared/org-admin-sections";
import { RoomSection, TreatmentCategorySection, TreatmentTypeSection } from "@/components/dental/dental-admin-sections";

export default function DentalYonetimPage() {
  return (
    <div className="mx-auto w-full flex max-w-6xl flex-col gap-4">
      <StaffAdminClient moduleLabel="Dental" />
      <div className="grid gap-4 sm:grid-cols-2">
        <BranchSection />
        <StaffCreateSection />
      </div>
      <RoomSection />
      <TreatmentCategorySection />
      <TreatmentTypeSection />
    </div>
  );
}
