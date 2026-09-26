import { SupportTicketClient, type ErrorPrefill } from "@/components/shared/support-ticket-client";

type SP = Promise<Record<string, string | undefined>>;

/**
 * Shared by every module's /destek page. `?talep=<id>` opens a ticket (bell
 * links); `?hata=1&ref=…&kod=…&yer=…&islem=…&mesaj=…` opens a new ticket
 * prefilled from an error screen (see ReportErrorButton).
 */
export async function SupportPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const clip = (v: string | undefined, n: number) => (v ? v.slice(0, n) : undefined);
  const errorPrefill: ErrorPrefill | undefined =
    q.hata === "1"
      ? { ref: clip(q.ref, 80), code: clip(q.kod, 80), path: clip(q.yer, 300), operation: clip(q.islem, 200), message: clip(q.mesaj, 500) }
      : undefined;
  return <SupportTicketClient initialTicketId={q.talep} errorPrefill={errorPrefill} />;
}