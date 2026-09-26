import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Döviz kurları for the dashboard widget, fetched server-side (the browser
// never calls a third party) and cached for 30 minutes.
//
// Primary source: TCMB's official daily bulletin (today.xml) — the rates
// Turkish businesses actually quote, with separate alış/satış. TCMB
// publishes once per business day (~15:30); outside that the latest
// bulletin is served. Fallback: ECB reference rates via frankfurter.app
// (single mid rate, no buy/sell) if TCMB is unreachable.

const CODES = ["USD", "EUR", "GBP"] as const;
type Rate = { code: string; buying: number | null; selling: number | null };
type Payload = { source: "TCMB" | "ECB" | null; date: string | null; rates: Rate[] };

let cache: { at: number; data: Payload } | null = null;
// Caching happens here on the server; browsers always ask, so a response
// shape change can never be served stale from someone's browser cache.
const NO_BROWSER_CACHE = { "Cache-Control": "no-store" };
const TTL_MS = 30 * 60 * 1000;

function num(v: string | undefined) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fromTcmb(): Promise<Payload> {
  const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`TCMB ${res.status}`);
  const xml = await res.text();
  const date = /Tarih="([\d.]+)"/.exec(xml)?.[1] ?? null;
  const rates: Rate[] = [];
  for (const code of CODES) {
    const block = new RegExp(`<Currency[^>]*Kod="${code}"[\\s\\S]*?</Currency>`).exec(xml)?.[0];
    if (!block) continue;
    const unit = num(/<Unit>([\d.]+)<\/Unit>/.exec(block)?.[1]) ?? 1;
    const buying = num(/<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(block)?.[1]);
    const selling = num(/<ForexSelling>([\d.]+)<\/ForexSelling>/.exec(block)?.[1]);
    rates.push({ code, buying: buying && buying / unit, selling: selling && selling / unit });
  }
  if (rates.length === 0) throw new Error("TCMB: kur bulunamadı");
  return { source: "TCMB", date, rates };
}

async function fromEcb(): Promise<Payload> {
  const res = await fetch(`https://api.frankfurter.app/latest?from=TRY&to=${CODES.join(",")}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ECB ${res.status}`);
  const data: { date: string; rates: Record<string, number> } = await res.json();
  // Returned as TRY → foreign; invert to "1 USD = X TL".
  const rates = CODES.filter((c) => data.rates[c] > 0).map((c) => {
    const mid = 1 / data.rates[c];
    return { code: c, buying: mid, selling: mid };
  });
  const [y, m, d] = data.date.split("-");
  return { source: "ECB", date: `${d}.${m}.${y}`, rates };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers: NO_BROWSER_CACHE });
  }
  for (const source of [fromTcmb, fromEcb]) {
    try {
      const data = await source();
      cache = { at: Date.now(), data };
      return NextResponse.json(data, { headers: NO_BROWSER_CACHE });
    } catch (e) {
      console.warn("[kur]", e instanceof Error ? e.message : e);
    }
  }
  // Both down: serve the last good data if we have any, otherwise empty.
  if (cache) return NextResponse.json(cache.data, { headers: NO_BROWSER_CACHE });
  return NextResponse.json({ source: null, date: null, rates: [] } satisfies Payload, { headers: NO_BROWSER_CACHE });
}
