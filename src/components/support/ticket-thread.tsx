"use client";

import { useEffect, useRef, useState } from "react";
import { Info, ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime } from "@/components/support/support-meta";

export type ThreadMessage = {
  id: string;
  kind: "MESSAGE" | "SYSTEM";
  body: string;
  createdAt: string | Date;
  createdIp?: string | null;
  fromStaff: boolean;
  authorName: string;
  attachments: { id: string; fileName: string; url: string; sizeBytes: number }[];
};

/**
 * Chat-style thread. `viewer` decides which side is "me" (right-aligned):
 * the clinic's own messages for the customer, the team's for staff.
 */
export function TicketThread({
  messages,
  viewer,
  showIp = false,
}: {
  messages: ThreadMessage[];
  viewer: "customer" | "staff";
  showIp?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => {
        if (m.kind === "SYSTEM") {
          return (
            <div key={m.id} className="mx-auto flex max-w-[90%] items-start gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-center text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              <span>
                {m.body} · {fmtDateTime(m.createdAt)}
              </span>
            </div>
          );
        }
        const mine = viewer === "staff" ? m.fromStaff : !m.fromStaff;
        return (
          <div key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
            <span className="px-1 text-[11px] text-muted-foreground">
              {m.fromStaff ? (viewer === "customer" ? `${m.authorName} · Destek Ekibi` : m.authorName) : m.authorName}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card"
              }`}
            >
              {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
              {m.attachments.length > 0 && (
                <div className={`grid gap-1.5 ${m.body ? "mt-2" : ""} ${m.attachments.length > 1 ? "grid-cols-2" : ""}`}>
                  {m.attachments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setLightbox({ url: a.url, name: a.fileName })}
                      className="overflow-hidden rounded-lg border border-black/10 bg-background"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URLs */}
                      <img src={a.url} alt={a.fileName} className="max-h-48 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="px-1 text-[10px] text-muted-foreground">
              {fmtDateTime(m.createdAt)}
              {showIp && m.createdIp && ` · IP ${m.createdIp}`}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <ImageIcon className="size-4" /> {lightbox?.name}
          </DialogTitle>
          {lightbox && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lightbox.url} alt={lightbox.name} className="max-h-[75vh] w-full object-contain" />
          )}
          {lightbox && (
            <a href={lightbox.url} target="_blank" rel="noreferrer" className="text-center text-xs text-muted-foreground underline">
              Yeni sekmede aç
            </a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
