import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Explicit pool size instead of Prisma's CPU-based default, so a burst of
 * traffic queues briefly (pool_timeout) rather than opening more
 * connections than Postgres allows. Settings already present in
 * DATABASE_URL win.
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", process.env.DB_POOL_SIZE || "20");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: databaseUrl(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
