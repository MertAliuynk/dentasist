import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { DiscountCodesClient } from "@/components/platform/discount-codes-client";

export default async function PlatformDiscountCodesPage() {
  const session = await auth();
  if (!session?.platformUser || session.platformUser.role !== "OWNER") redirect("/admin");

  return <DiscountCodesClient />;
}
