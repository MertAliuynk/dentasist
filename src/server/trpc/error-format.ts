import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

// Everything a tRPC error shows the user goes through here: internals
// (Prisma messages, stack traces, English library text) never reach the
// browser — the real details stay in ActivityLog under the same `ref` the
// user sees, so support can find them from a ticket.

export const newErrorRef = () => `HT-${randomBytes(4).toString("hex").toUpperCase()}`;

/** Lets middleware stamp a ref onto the error instance for the formatter. */
export function attachRef(error: unknown, ref: string) {
  if (error && typeof error === "object") (error as { ref?: string }).ref = ref;
}
const refOf = (error: unknown) => (error as { ref?: string } | null)?.ref;

const DEFAULT_TEXT: Partial<Record<TRPC_ERROR_CODE_KEY, string>> = {
  UNAUTHORIZED: "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.",
  FORBIDDEN: "Bu işlem için yetkiniz bulunmuyor.",
  NOT_FOUND: "Aradığınız kayıt bulunamadı veya silinmiş.",
  BAD_REQUEST: "Gönderilen bilgilerde bir sorun var. Lütfen kontrol edip tekrar deneyin.",
  CONFLICT: "Bu kayıt başka bir işlemle çakışıyor. Sayfayı yenileyip tekrar deneyin.",
  TIMEOUT: "İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.",
  TOO_MANY_REQUESTS: "Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.",
  PAYLOAD_TOO_LARGE: "Gönderilen veri çok büyük.",
  PRECONDITION_FAILED: "Bu işlem için gerekli koşullar sağlanmadı.",
  METHOD_NOT_SUPPORTED: "Geçersiz istek.",
  PARSE_ERROR: "Geçersiz istek.",
  INTERNAL_SERVER_ERROR: "Beklenmeyen bir hata oluştu. Ekibimiz bilgilendirildi; lütfen tekrar deneyin.",
};

// Library default (English) messages look like this; our own are Turkish.
const LOOKS_ENGLISH = /^(invalid|too (small|big)|expected|required|unrecognized|string must|number must|array must|input|unexpected)/i;

function zodMessage(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return DEFAULT_TEXT.BAD_REQUEST!;
  if (issue.message && !LOOKS_ENGLISH.test(issue.message)) return issue.message;
  const field = issue.path.filter((p) => typeof p === "string").join(".");
  return field
    ? `Lütfen "${field}" alanını kontrol edin — girilen değer geçerli değil.`
    : DEFAULT_TEXT.BAD_REQUEST!;
}

/** Known DB failures that are really user-level problems, not bugs. */
function prismaMapping(cause: unknown): { code: TRPC_ERROR_CODE_KEY; message: string } | null {
  if (!(cause instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (cause.code) {
    case "P2002":
      return { code: "CONFLICT", message: "Bu bilgilerle kayıtlı başka bir kayıt zaten var." };
    case "P2003":
      return { code: "BAD_REQUEST", message: "Seçilen bağlantılı kayıt (şube, hekim vb.) bulunamadı veya silinmiş." };
    case "P2025":
      return { code: "NOT_FOUND", message: DEFAULT_TEXT.NOT_FOUND! };
    default:
      return null;
  }
}

/** The code + message the client should see for this error. */
export function publicError(error: TRPCError): { code: TRPC_ERROR_CODE_KEY; message: string } {
  if (error.cause instanceof ZodError) return { code: "BAD_REQUEST", message: zodMessage(error.cause) };
  const prisma = prismaMapping(error.cause);
  if (prisma) return prisma;
  if (error.code === "INTERNAL_SERVER_ERROR") return { code: error.code, message: DEFAULT_TEXT.INTERNAL_SERVER_ERROR! };
  // An explicit message we wrote (Turkish) is kept; tRPC's default (the
  // code name itself) or English library text gets the friendly default.
  const own = error.message && error.message !== error.code && !LOOKS_ENGLISH.test(error.message);
  return { code: error.code, message: own ? error.message : (DEFAULT_TEXT[error.code] ?? DEFAULT_TEXT.INTERNAL_SERVER_ERROR!) };
}

const HTTP_STATUS: Partial<Record<TRPC_ERROR_CODE_KEY, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

type Shape = { message: string; code: number; data: { code: TRPC_ERROR_CODE_KEY; httpStatus: number; path?: string; stack?: string } };

/** Shared errorFormatter for both tRPC instances. */
export function formatError({ shape, error }: { shape: Shape; error: TRPCError }) {
  const pub = publicError(error);
  return {
    ...shape,
    message: pub.message,
    data: {
      code: pub.code,
      httpStatus: HTTP_STATUS[pub.code] ?? shape.data.httpStatus,
      path: shape.data.path,
      ref: refOf(error) ?? null,
      // Never ship stack traces to the browser, even in development builds
      // that happen to face real users.
    },
  };
}
