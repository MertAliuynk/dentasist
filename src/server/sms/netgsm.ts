// Minimal NetGSM REST v2 client — mirrors the official SDK
// (github.com/netgsm/netgsm-sms-python): Basic auth, JSON body, errors come
// back as HTTP 406 with {code, description}.

const API_URL = "https://api.netgsm.com.tr";
const TIMEOUT_MS = 20_000;

export type NetgsmCredentials = { username: string; password: string };

const ERROR_TEXT: Record<string, string> = {
  "20": "Mesaj metninde sorun var veya karakter sınırı aşıldı.",
  "30": "NetGSM kullanıcı adı/şifre hatalı ya da hesabın API erişimi kapalı (IP kısıtlaması olabilir).",
  "40": "SMS başlığı NetGSM hesabınızda tanımlı değil.",
  "50": "Hesabınız İYS kontrollü gönderim yapamıyor.",
  "51": "Hesabınıza ait İYS marka bilgisi bulunamadı.",
  "70": "Geçersiz istek parametresi.",
  "80": "Gönderim limiti aşıldı.",
  "85": "Aynı numaraya 1 dakikada 20'den fazla gönderim yapılamaz.",
  "100": "NetGSM sistem hatası, daha sonra tekrar deneyin.",
  "101": "NetGSM sistem hatası, daha sonra tekrar deneyin.",
};

export class NetgsmError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    /** Worth retrying later (network/5xx/system error) vs. needs a fix (credentials, header…). */
    readonly transient: boolean,
  ) {
    super(message);
  }
}

async function call<T extends { code?: string }>(
  creds: NetgsmCredentials,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new NetgsmError("NetGSM'e bağlanılamadı (zaman aşımı veya ağ hatası).", null, true);
  }

  const data = (await res.json().catch(() => null)) as (T & { description?: string }) | null;
  const code = data?.code != null ? String(data.code) : null;
  if (res.ok && code === "00") return data as T;

  const transient = res.status >= 500 || res.status === 429 || code === "100" || code === "101";
  const text = (code && ERROR_TEXT[code]) || data?.description || `NetGSM hatası (HTTP ${res.status}).`;
  throw new NetgsmError(code ? `${text} [kod ${code}]` : text, code, transient);
}

/** Headers ("başlık") approved on the account — also serves as a credentials check. */
export async function listNetgsmHeaders(creds: NetgsmCredentials): Promise<string[]> {
  const data = await call<{ code: string; msgheaders?: string[] }>(creds, "/sms/rest/v2/msgheader", { method: "GET" });
  return data.msgheaders ?? [];
}

const TURKISH_CHARS = /[çğıöşüÇĞİÖŞÜ]/;

/**
 * Sends one SMS per entry. `iysfilter: "0"` = bilgilendirme (appointment
 * reminders etc.) — no İYS consent check; commercial/campaign SMS would
 * need "11" plus İYS registration and must not go through here.
 */
export async function sendNetgsm(
  creds: NetgsmCredentials,
  msgheader: string,
  messages: { no: string; msg: string }[],
): Promise<{ jobid: string }> {
  const turkish = messages.some((m) => TURKISH_CHARS.test(m.msg));
  const data = await call<{ code: string; jobid?: string }>(creds, "/sms/rest/v2/send", {
    method: "POST",
    body: {
      msgheader,
      messages,
      iysfilter: "0",
      // Per the SDK: set only when Turkish characters are present (they
      // shorten the per-SMS character limit).
      ...(turkish ? { encoding: "tr" } : {}),
    },
  });
  return { jobid: String(data.jobid ?? "") };
}
