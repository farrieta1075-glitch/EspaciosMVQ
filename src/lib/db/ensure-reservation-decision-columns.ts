import "server-only";
import type { PrismaClient } from "@prisma/client";

let ensured: Promise<void> | null = null;

export function ensureReservationDecisionColumns(
  prisma: PrismaClient,
): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const statements = [
        `ALTER TABLE "Reservations" ADD COLUMN IF NOT EXISTS "decision" VARCHAR(16) NOT NULL DEFAULT ''`,
        `ALTER TABLE "Reservations" ADD COLUMN IF NOT EXISTS "decisionByName" VARCHAR(256) NOT NULL DEFAULT ''`,
        `ALTER TABLE "Reservations" ADD COLUMN IF NOT EXISTS "decisionByUserId" VARCHAR(64) NOT NULL DEFAULT ''`,
        `ALTER TABLE "Reservations" ADD COLUMN IF NOT EXISTS "decisionAt" VARCHAR(64) NOT NULL DEFAULT ''`,
      ];
      for (const sql of statements) {
        await prisma.$executeRawUnsafe(sql);
      }
    })()
      .catch((error) => {
        console.warn(
          "[db] No se pudieron asegurar columnas de autorización:",
          error instanceof Error ? error.message : error,
        );
      });
  }
  return ensured;
}
