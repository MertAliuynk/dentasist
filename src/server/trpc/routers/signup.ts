import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "@/server/trpc/trpc";
import { slugify } from "@/lib/utils/slug";
import { checkRateLimit } from "@/server/security/rate-limit";
import { SIGNUP_OPEN } from "@/lib/signup";

const signUpInput = z.object({
  organizationName: z.string().trim().min(2).max(120),
  planCode: z.string().min(1),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().email(),
  ownerPassword: z.string().min(8).max(72),
  discountCode: z.string().trim().max(40).optional(),
});

export const signupRouter = router({
  create: publicProcedure.input(signUpInput).mutation(async ({ ctx, input }) => {
    if (!SIGNUP_OPEN) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Yeni kayıtlar şu an kapalı. Hesaplar ekibimiz tarafından açılmaktadır.",
      });
    }
    const rate = checkRateLimit(`signup:${ctx.clientIp}`, 5, 60 * 60 * 1000);
    if (!rate.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.",
      });
    }

    const plan = await ctx.db.plan.findUnique({ where: { code: input.planCode } });
    if (!plan || !plan.isActive) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz plan seçimi." });
    }

    const existingUser = await ctx.db.user.findUnique({ where: { email: input.ownerEmail } });
    if (existingUser) {
      throw new TRPCError({ code: "CONFLICT", message: "Bu e-posta adresi zaten kayıtlı." });
    }

    const baseSlug = slugify(input.organizationName) || "klinik";
    let slug = baseSlug;
    let suffix = 1;
    while (await ctx.db.organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    let discountCodeId: string | null = null;
    if (input.discountCode) {
      const code = await ctx.db.discountCode.findUnique({ where: { code: input.discountCode.trim().toUpperCase() } });
      if (!code || !code.active || (code.expiresAt && code.expiresAt < new Date()) || (code.maxUses != null && code.usedCount >= code.maxUses)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz veya süresi dolmuş indirim kodu." });
      }
      discountCodeId = code.id;
    }

    const passwordHash = await bcrypt.hash(input.ownerPassword, 12);

    await ctx.db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });

      const owner = await tx.user.create({
        data: {
          organizationId: organization.id,
          name: input.ownerName,
          email: input.ownerEmail,
          passwordHash,
        },
      });

      await tx.membership.create({
        data: {
          userId: owner.id,
          organizationId: organization.id,
          branchId: null,
          role: "PATRON",
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: plan.id,
          status: "ACTIVE",
          startedAt: new Date(),
          paymentStub: { note: "Manuel/deneme kayıt — ödeme entegrasyonu sonra eklenecek." },
          discountCodeId,
        },
      });

      await tx.entitlement.createMany({
        data: plan.modules.map((module) => ({
          subscriptionId: subscription.id,
          module,
          active: true,
        })),
      });

      if (discountCodeId) {
        await tx.discountCode.update({ where: { id: discountCodeId }, data: { usedCount: { increment: 1 } } });
      }
    });

    return { slug };
  }),
});
