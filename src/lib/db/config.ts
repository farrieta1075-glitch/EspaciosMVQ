import "server-only";

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** URL de PostgreSQL para Prisma (`DATABASE_URL` o `POSTGRES_URL`). */
export function resolveDatabaseUrl(): string | null {
  const direct =
    process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (direct) {
    return stripEnvQuotes(direct);
  }
  return null;
}

/** Sincroniza `process.env.DATABASE_URL` para Prisma Client. */
export function ensureDatabaseUrlEnv(): void {
  const url = resolveDatabaseUrl();
  if (url) {
    process.env.DATABASE_URL = url;
  }
}

/** Datos en PostgreSQL cuando hay `DATABASE_URL`. */
export function isSqlDatabaseEnabled(): boolean {
  return Boolean(resolveDatabaseUrl());
}

export function isCatalogOnSql(): boolean {
  return isSqlDatabaseEnabled();
}

export function isAppDataOnSql(): boolean {
  return isSqlDatabaseEnabled();
}

export const SQL_BACKED_FEATURES = [
  "pushSubscriptions",
  "notifications",
  "users",
  "areas",
  "spaces",
  "maps",
  "resources",
  "resourceSpaces",
  "reservations",
  "reservationResources",
  "eventHistory",
] as const;

export const SHEETS_BACKED_FEATURES = [
  "reservations",
  "reservationResources",
  "eventHistory",
] as const;
