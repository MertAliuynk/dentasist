"use client";

import { platformTrpc } from "@/lib/platform-trpc/client";
import { NotificationBell } from "@/components/support/notification-bell";
import { PRIORITY_META } from "@/components/support/support-meta";

export function usePlatformSupportCounts() {
  return platformTrpc.supportTicket.unread.useQuery(undefined, { refetchInterval: 30_000, refetchOnWindowFocus: true, meta: { silent: true } });
}

/** Platform side: customer messages the team hasn't read yet. */
export function PlatformSupportBell() {
  const { data } = usePlatformSupportCounts();
  return (
    <NotificationBell
      count={data?.unreadCount ?? 0}
      items={(data?.items ?? []).map((i) => ({
        id: i.id,
        title: i.subject,
        subtitle: `${i.organizationName}${i.priority === "ACIL" || i.priority === "YUKSEK" ? ` · ${PRIORITY_META[i.priority].label} öncelik` : ""}`,
        at: i.at,
        href: `/admin/destek-talepleri?talep=${i.id}`,
      }))}
      emptyText="Okunmamış müşteri mesajı yok."
      allHref="/admin/destek-talepleri"
      allLabel={`Tüm talepler${data?.open ? ` (${data.open} yanıt bekliyor)` : ""}`}
      toastText={(n) => (n > 1 ? `${n} yeni destek mesajı` : "Yeni destek mesajı")}
    />
  );
}
