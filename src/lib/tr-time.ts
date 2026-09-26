// Turkey has been on fixed UTC+3 (no DST) since 2016, so wall-clock math in
// Europe/Istanbul is a constant offset — no tz database needed, and it
// behaves the same on the server (UTC) and in any browser.
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrDay = { y: number; m: number; d: number }; // m: 1-12

/** Calendar day (and wall time) of an instant, in Turkey. */
export function trParts(date: Date) {
  const t = new Date(date.getTime() + OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
  };
}

export function trDay(date: Date): TrDay {
  const { y, m, d } = trParts(date);
  return { y, m, d };
}

export function addDays(day: TrDay, n: number): TrDay {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d) + n * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The instant of `hhmm` ("18:00") on a Turkish calendar day. */
export function trAt(day: TrDay, hhmm: string): Date {
  const [h, min] = parseHhmm(hhmm);
  return new Date(Date.UTC(day.y, day.m - 1, day.d, h, min) - OFFSET_MS);
}

export function parseHhmm(hhmm: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return [9, 0];
  return [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))];
}

export function isValidHhmm(v: string) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim());
}

/** Whole calendar days from `a` to `b` (b - a). */
export function dayDiff(a: TrDay, b: TrDay) {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}
