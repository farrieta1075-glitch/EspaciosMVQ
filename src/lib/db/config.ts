import "server-only";

const DEFAULT_SERVER = "mvqro-sql.database.windows.net";
const DEFAULT_DATABASE = "mvqroeventos-sql-db";

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

/** Construye la URL de Prisma desde DATABASE_URL o AZURE_SQL_* (Vercel). */
export function resolveDatabaseUrl(): string | null {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return stripEnvQuotes(direct);
  }

  const user = process.env.AZURE_SQL_USER?.trim();
  const password = process.env.AZURE_SQL_PASSWORD?.trim();
  if (!user || !password) {
    return null;
  }

  const server = process.env.AZURE_SQL_SERVER?.trim() || DEFAULT_SERVER;
  const database = process.env.AZURE_SQL_DATABASE?.trim() || DEFAULT_DATABASE;

  return `sqlserver://${server}:1433;database=${database};user=${encodeURIComponent(user)};password=${encodeURIComponent(password)};encrypt=true;trustServerCertificate=false;`;
}

/** Sincroniza `process.env.DATABASE_URL` para Prisma Client. */
export function ensureDatabaseUrlEnv(): void {
  const url = resolveDatabaseUrl();
  if (url) {
    process.env.DATABASE_URL = url;
  }
}

/** Azure SQL vía Prisma cuando hay URL resuelta. */
export function isSqlDatabaseEnabled(): boolean {
  return Boolean(resolveDatabaseUrl());
}

export function isCatalogOnSql(): boolean {
  return isSqlDatabaseEnabled();
}

/** Datos operativos en Azure cuando hay DATABASE_URL (sin fallback a Sheets). */
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

/** Solo aplica si no hay SQL; con Azure activo la app no usa Sheets para datos. */
export const SHEETS_BACKED_FEATURES = [
  "reservations",
  "reservationResources",
  "eventHistory",
] as const;
