"use client";

import { trpc } from "@/lib/trpc/client";
import { NotificationBell } from "@/components/support/notification-bell";

/** Clinic side: support replies they haven't read yet. `base` = "/dental" | "/muhasebe" | "/laboratuvar". */
export function TenantSupportBell({ base }: { base: string }) {
  const { data } = trpc.supportTicket.unread.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true, meta: { silent: true } });
  return (
    <NotificationBell
      count={data?.count ?? 0}
      items={(data?.items ?? []).map((i) => ({
        id: i.id,
        title: i.subject,
        subtitle: i.status === "CLOSED" ? "Talep kapatıldı" : "Destek ekibi yanıt verdi",
        at: i.at,
        href: `${base}/destek?talep=${i.id}`,
      }))}
      emptyText="Yeni bildiriminiz yok."
      allHref={`${base}/destek`}
      allLabel="Destek Merkezi'ne git"
      toastText={() => "Destek ekibi talebinizi yanıtladı"}
    />
  );
}
