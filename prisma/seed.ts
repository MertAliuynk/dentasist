import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  await db.plan.upsert({
    where: { code: "dental" },
    update: { name: "Dental", priceMonthly: 149900, modules: ["DENTAL"] },
    create: {
      code: "dental",
      name: "Dental",
      priceMonthly: 149900,
      modules: ["DENTAL"],
    },
  });

  await db.plan.upsert({
    where: { code: "muhasebe" },
    update: { name: "Muhasebe", priceMonthly: 99900, modules: ["MUHASEBE"] },
    create: {
      code: "muhasebe",
      name: "Muhasebe",
      priceMonthly: 99900,
      modules: ["MUHASEBE"],
    },
  });

  // Laboratuvar is still in active development — not sellable yet. The plan
  // row is kept (isActive: false) rather than deleted so platform admins can
  // still manually grant the LABORATUVAR entitlement to a test org via the
  // /admin subscription editor, but it never appears in public signup.
  await db.plan.upsert({
    where: { code: "laboratuvar" },
    update: { name: "Laboratuvar", priceMonthly: 129900, modules: ["LABORATUVAR"], isActive: false },
    create: {
      code: "laboratuvar",
      name: "Laboratuvar",
      priceMonthly: 129900,
      modules: ["LABORATUVAR"],
      isActive: false,
    },
  });

  await db.plan.upsert({
    where: { code: "bundle" },
    update: {
      name: "Dental + Muhasebe",
      priceMonthly: 219900,
      modules: ["DENTAL", "MUHASEBE"],
    },
    create: {
      code: "bundle",
      name: "Dental + Muhasebe",
      priceMonthly: 219900,
      modules: ["DENTAL", "MUHASEBE"],
    },
  });

  // Platform (internal staff) OWNER account — only created if both env vars
  // are explicitly set. We deliberately never ship a default/guessable
  // platform credential; without these vars the platform panel simply has
  // no accounts yet (create the first one manually via a one-off script or
  // set the env vars and re-run the seed).
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;
  const ownerPassword = process.env.PLATFORM_OWNER_PASSWORD;
  if (ownerEmail && ownerPassword) {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    await db.platformUser.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        name: "Platform Owner",
        email: ownerEmail,
        passwordHash,
        role: "OWNER",
      },
    });
    console.log(`Platform owner hesabı hazır: ${ownerEmail}`);
  } else {
    console.log(
      "PLATFORM_OWNER_EMAIL / PLATFORM_OWNER_PASSWORD tanımlı değil, platform owner hesabı oluşturulmadı.",
    );
  }

  console.log("Seed tamamlandı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
