import { StaffAdminClient } from "@/components/shared/staff-admin-client";
import { BranchSection, StaffCreateSection } from "@/components/shared/org-admin-sections";
import { ExpenseCategorySection } from "@/components/muhasebe/expense-category-section";

export default function MuhasebeYonetimPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <StaffAdminClient moduleLabel="Muhasebe" />
      <div className="grid gap-4 sm:grid-cols-2">
        <BranchSection />
        <StaffCreateSection />
      </div>
      <ExpenseCategorySection />
    </div>
  );
}
