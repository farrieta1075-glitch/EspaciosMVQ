import "server-only";

/** Azure SQL vía Prisma cuando `DATABASE_URL` está definida. */
export function isSqlDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
