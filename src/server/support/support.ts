import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { createUploadUrl, createViewUrl } from "@/server/storage/s3";

// Shared by the tenant and platform support routers.

export const SUPPORT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const SUPPORT_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORT_MAX_FILES = 5;

export const attachmentInput = z.object({
  objectKey: z.string().min(1).max(400),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(SUPPORT_IMAGE_TYPES),
  sizeBytes: z.number().int().min(1).max(SUPPORT_MAX_BYTES),
});

export const uploadRequestInput = z.object({
  ticketId: z.string(),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(SUPPORT_IMAGE_TYPES, { message: "Yalnızca JPG, PNG, WEBP veya GIF görsel yükleyebilirsiniz." }),
  sizeBytes: z.number().int().min(1).max(SUPPORT_MAX_BYTES, "Görsel en fazla 10 MB olabilir."),
});

const keyPrefix = (organizationId: string, ticketId: string) => `support/${organizationId}/${ticketId}/`;

export async function signUpload(organizationId: string, input: z.infer<typeof uploadRequestInput>) {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const objectKey = `${keyPrefix(organizationId, input.ticketId)}${randomUUID()}-${safe}`;
  return { objectKey, uploadUrl: await createUploadUrl(objectKey, input.contentType, input.sizeBytes) };
}

/** Rejects keys outside this ticket's prefix — a client can't attach someone else's file. */
export function assertOwnKeys(organizationId: string, ticketId: string, attachments: { objectKey: string }[]) {
  if (attachments.length > SUPPORT_MAX_FILES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Bir mesaja en fazla ${SUPPORT_MAX_FILES} görsel eklenebilir.` });
  }
  const prefix = keyPrefix(organizationId, ticketId);
  if (attachments.some((a) => !a.objectKey.startsWith(prefix))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz dosya." });
  }
}

export const MESSAGE_INCLUDE = {
  authorUser: { select: { id: true, name: true } },
  authorPlatformUser: { select: { id: true, name: true } },
  attachments: true,
} satisfies Prisma.SupportTicketMessageInclude;

type MessageRow = Prisma.SupportTicketMessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

/** Adds short-lived view URLs to every attachment (local HMAC signing — cheap). */
export async function withAttachmentUrls(messages: MessageRow[]) {
  return Promise.all(
    messages.map(async (m) => ({
      id: m.id,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt,
      createdIp: m.createdIp,
      fromStaff: !!m.authorPlatformUserId,
      authorName: m.authorPlatformUser?.name ?? m.authorUser?.name ?? "Sistem",
      attachments: await Promise.all(
        m.attachments.map(async (a) => ({
          id: a.id,
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          url: await createViewUrl(a.objectKey, a.fileName),
        })),
      ),
    })),
  );
}

export const isUnread = (lastOther: Date | null, readAt: Date | null) => !!lastOther && (!readAt || lastOther > readAt);

export const errorContextInput = z
  .object({
    ref: z.string().max(80).optional(),
    code: z.string().max(80).optional(),
    path: z.string().max(300).optional(),
    operation: z.string().max(200).optional(),
    message: z.string().max(1000).optional(),
  })
  .optional();
