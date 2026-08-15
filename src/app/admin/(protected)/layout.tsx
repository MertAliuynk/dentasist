import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { PlatformShell } from "@/components/platform/platform-shell";
import { PlatformTRPCProvider } from "@/lib/platform-trpc/Provider";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.platformUser) redirect("/admin/giris");

  return (
    <PlatformTRPCProvider>
      <PlatformShell platformUser={session.platformUser}>{children}</PlatformShell>
    </PlatformTRPCProvider>
  );
}
