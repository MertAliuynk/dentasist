import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FrankfurterResponse = { base: string; date: string; rates: Record<string, number> };

// Proxies frankfurter.app (free, ECB-based, no API key) server-side so the
// browser never calls a third party directly and the response can be
// cached briefly. Only USD/EUR/GBP against TRY are surfaced — enough for a
// clinic dashboard's "kur" widget without pulling in a paid FX provider.
export async function GET() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`Upstream error: ${res.status}`);
    const data: FrankfurterResponse = await res.json();

    // frankfurter returns TRY -> foreign; invert to foreign -> TRY, which is
    // the direction people actually want to read ("1 USD = X TRY").
    const rates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      rates[code] = rate > 0 ? Math.round((1 / rate) * 10000) / 10000 : 0;
    }

    return NextResponse.json({ date: data.date, rates }, { headers: { "Cache-Control": "public, max-age=1800" } });
  } catch {
    return NextResponse.json({ date: null, rates: {} }, { status: 200 });
  }
}
