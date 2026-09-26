"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/components/support/support-meta";

export type BellItem = { id: string; title: string; subtitle: string; at: string | Date; href: string };

/**
 * Presentational bell: badge, dropdown list, and a toast whenever the
 * unread count goes up while the page is open (not on first load).
 */
export function NotificationBell({
  count,
  items,
  emptyText,
  allHref,
  allLabel,
  toastText,
}: {
  count: number;
  items: BellItem[];
  emptyText: string;
  allHref: string;
  allLabel: string;
  toastText: (n: number) => string;
}) {
  const router = useRouter();
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (prev.current !== null && count > prev.current && items[0]) {
      toast.info(toastText(count - prev.current), {
        description: items[0].title,
        action: { label: "Görüntüle", onClick: () => router.push(items[0].href) },
      });
    }
    prev.current = count;
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Bildirimler${count ? ` (${count} yeni)` : ""}`} className="relative" />}>
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">Bildirimler</div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((i) => (
              <DropdownMenuItem key={i.id} render={<Link href={i.href} />} className="flex flex-col items-start gap-0.5 rounded-none border-b border-border px-3 py-2">
                <span className="flex w-full items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.title}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(i.at)}</span>
                </span>
                <span className="pl-4 text-xs text-muted-foreground">{i.subtitle}</span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuItem render={<Link href={allHref} />} className="justify-center rounded-none py-2 text-xs text-muted-foreground">
          {allLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
