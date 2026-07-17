import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client instance. Centralized here so the rest of the app never
 * imports `@prisma/client` directly — the one place to change if the datasource
 * moves (e.g. SQLite -> Postgres). Cached on globalThis to survive Next.js dev
 * hot-reloads without exhausting connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
