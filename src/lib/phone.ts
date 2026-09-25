/**
 * Normalizes a Turkish mobile number to its 10-digit national form
 * ("5XXXXXXXXX"), accepting the usual ways staff type it: "0532 123 45 67",
 * "+90 532…", "90532…", "532-123-4567". Returns null for anything that
 * isn't a TR mobile (landlines can't receive SMS/WhatsApp).
 */
export function normalizeTrMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return /^5\d{9}$/.test(digits) ? digits : null;
}

/** wa.me link with the message pre-filled; null if the number isn't a TR mobile. */
export function whatsappLink(rawPhone: string | null | undefined, text: string): string | null {
  const phone = normalizeTrMobile(rawPhone);
  if (!phone) return null;
  return `https://wa.me/90${phone}?text=${encodeURIComponent(text)}`;
}
