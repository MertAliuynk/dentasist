import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";
import { createUploadUrl, createViewUrl, deleteObject } from "@/server/storage/s3";
import type { db as Db } from "@/server/db";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

async function assertPatientAccessible(
  db: typeof Db,
  organizationId: string,
  accessibleBranchIds: string[] | "ALL",
  patientId: string,
) {
  const patient = await db.patient.findFirst({
    where: { id: patientId, deletedAt: null, ...branchScopeWhere(organizationId, accessibleBranchIds) },
    select: { id: true },
  });
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });
}

export const patientXrayRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.patientXray.findMany({
        where: {
          patientId: input.patientId,
          organizationId: ctx.session.user.organizationId,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
        },
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
      });

      // Presigned URL generation is a local HMAC signing operation (no
      // network round-trip to the object store), so signing one per row is
      // cheap even for a list.
      return Promise.all(
        rows.map(async (row) => ({
          ...row,
          viewUrl: await createViewUrl(row.objectKey, row.fileName),
        })),
      );
    }),

  createUploadUrl: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        patientId: z.string(),
        fileName: z.string().trim().min(1).max(200),
        contentType: z.enum(ALLOWED_CONTENT_TYPES),
        sizeBytes: z.number().int().min(1).max(MAX_SIZE_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPatientAccessible(ctx.db, ctx.session.user.organizationId, ctx.accessibleBranchIds, input.patientId);

      const objectKey = `xrays/${ctx.session.user.organizationId}/${input.patientId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
      const uploadUrl = await createUploadUrl(objectKey, input.contentType);
      return { uploadUrl, objectKey };
    }),

  confirmUpload: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        patientId: z.string(),
        objectKey: z.string(),
        fileName: z.string().trim().min(1).max(200),
        contentType: z.enum(ALLOWED_CONTENT_TYPES),
        sizeBytes: z.number().int().min(1).max(MAX_SIZE_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertPatientAccessible(ctx.db, ctx.session.user.organizationId, ctx.accessibleBranchIds, input.patientId);
      // The uploaded object must actually belong to this patient's own key
      // prefix — prevents confirming an arbitrary/foreign objectKey.
      if (!input.objectKey.startsWith(`xrays/${ctx.session.user.organizationId}/${input.patientId}/`)) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      return ctx.db.patientXray.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          patientId: input.patientId,
          objectKey: input.objectKey,
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          uploadedByUserId: ctx.session.user.id,
        },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.patientXray.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.session.user.organizationId,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
        },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.patientXray.delete({ where: { id: row.id } });
      await deleteObject(row.objectKey).catch(() => {
        // The DB row is already gone; a leftover object in storage is a
        // harmless orphan, not worth failing the user-facing delete over.
      });
      return { success: true };
    }),
});
