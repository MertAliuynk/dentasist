import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

// Client-side half of error handling: turns anything thrown into a short
// Turkish message, and — for genuine bugs — offers a one-click support
// ticket prefilled with where/what failed plus the server-side `ref`.

export type ErrorInfo = {
  message: string;
  code: string | null;
  ref: string | null;
  operation: string | null;
  kind: "user" | "bug" | "network" | "auth";
};

const NETWORK_TEXT = "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
const BUG_TEXT = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
const NETWORKISH = /failed to fetch|networkerror|load failed|network request failed|unexpected token|fetch failed|aborted/i;

export function describeError(err: unknown): ErrorInfo {
  if (err instanceof TRPCClientError) {
    const data = err.data as { code?: string; ref?: string | null; path?: string } | undefined;
    if (!data?.code) {
      // No tRPC envelope: the request never reached us, or a proxy returned HTML.
      return { message: NETWORK_TEXT, code: null, ref: null, operation: null, kind: "network" };
    }
    const kind =
      data.code === "UNAUTHORIZED"
        ? "auth"
        : data.code === "INTERNAL_SERVER_ERROR" || data.code === "TIMEOUT"
          ? "bug"
          : "user";
    return { message: err.message || BUG_TEXT, code: data.code, ref: data.ref ?? null, operation: data.path ?? null, kind };
  }
  if (err instanceof Error && NETWORKISH.test(err.message)) {
    return { message: NETWORK_TEXT, code: null, ref: null, operation: null, kind: "network" };
  }
  return { message: BUG_TEXT, code: err instanceof Error ? err.name : null, ref: null, operation: null, kind: "bug" };
}

const MODULES = ["dental", "muhasebe", "laboratuvar"];

/** /<module>/destek?hata=1&… for the module the user is in; null outside the clinic app. */
export function supportLink(info: Partial<ErrorInfo> & { technical?: string }, pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  const mod = pathname.split("/")[1];
  if (!MODULES.includes(mod)) return null;
  const q = new URLSearchParams({ hata: "1", yer: pathname });
  if (info.ref) q.set("ref", info.ref);
  if (info.code) q.set("kod", info.code);
  if (info.operation) q.set("islem", info.operation);
  if (info.technical) q.set("mesaj", info.technical.slice(0, 300));
  return `/${mod}/destek?${q.toString()}`;
}

/**
 * Drop-in for `toast.error(e.message)`. Same toast for plain validation
 * errors; bugs additionally get the reference code and a "Destek talebi
 * aç" button; auth errors send the user to sign in again.
 */
export function toastError(err: unknown, fallback?: string, opts?: { id?: string }) {
  const info = describeError(err);
  if (info.kind === "auth") {
    toast.error(info.message, {
      id: "auth-expired",
      action: { label: "Giriş yap", onClick: () => redirectToLogin() },
    });
    return info;
  }
  const message = info.kind === "bug" && fallback ? fallback : info.message;
  const link = info.kind === "bug" ? supportLink(info) : null;
  toast.error(message, {
    // A stable id makes a repeating failure update one toast instead of stacking new ones.
    id: opts?.id ?? info.ref ?? undefined,
    description: info.ref ? `Referans: ${info.ref}` : undefined,
    duration: info.kind === "bug" ? 12_000 : undefined,
    action: link ? { label: "Destek talebi aç", onClick: () => (window.location.href = link) } : undefined,
  });
  return info;
}

export function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const target = path.startsWith("/admin") ? "/admin/giris" : "/giris";
  window.location.href = `${target}?callbackUrl=${encodeURIComponent(path + window.location.search)}`;
}

/** Retry only what can succeed on retry (network / server hiccups), never 4xx. */
export function shouldRetry(failureCount: number, err: unknown) {
  if (failureCount >= 2) return false;
  const info = describeError(err);
  return info.kind === "network" || info.code === "TIMEOUT";
}
