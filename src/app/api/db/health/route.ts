import { NextResponse } from "next/server";
import {
  isSqlDatabaseEnabled,
  resolveDatabaseUrl,
  SHEETS_BACKED_FEATURES,
  SQL_BACKED_FEATURES,
} from "@/lib/db/config";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const hasDirectDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasAzureParts = Boolean(
    process.env.AZURE_SQL_USER?.trim() && process.env.AZURE_SQL_PASSWORD?.trim(),
  );
  const resolved = Boolean(resolveDatabaseUrl());

  const stores = {
    azureSql: Object.fromEntries(
      SQL_BACKED_FEATURES.map((key) => [
        key,
        resolved ? "azure_sql" : "google_sheets",
      ]),
    ),
    googleSheets: Object.fromEntries(
      SHEETS_BACKED_FEATURES.map((key) => [key, "google_sheets"]),
    ),
  };

  if (!isSqlDatabaseEnabled()) {
    return NextResponse.json({
      ok: true,
      mode: "sheets",
      message:
        "No hay conexión SQL activa. Login, reservas y catálogo siguen en Google Sheets.",
      env: {
        hasDirectDatabaseUrl,
        hasAzureParts,
        resolvedDatabaseUrl: false,
      },
      stores,
      hint:
        "En Vercel → Environment Variables (Production), define DATABASE_URL o AZURE_SQL_USER + AZURE_SQL_PASSWORD y redeploy.",
    });
  }

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1 AS ok`;
    const [pushCount, notificationCount] = await Promise.all([
      prisma.pushSubscription.count(),
      prisma.notification.count(),
    ]);

    return NextResponse.json({
      ok: true,
      mode: "sql",
      message:
        "SQL conectado. Solo notificaciones y suscripciones push usan Azure; usuarios y reservas siguen en Sheets hasta migración.",
      env: {
        hasDirectDatabaseUrl,
        hasAzureParts,
        resolvedDatabaseUrl: true,
      },
      stores,
      sqlRowCounts: {
        pushSubscriptions: pushCount,
        notifications: notificationCount,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error de conexión a SQL";
    return NextResponse.json(
      {
        ok: false,
        mode: "sql",
        error: message,
        env: {
          hasDirectDatabaseUrl,
          hasAzureParts,
          resolvedDatabaseUrl: true,
        },
        stores,
        hint: "Revisa firewall de Azure SQL (IPs de Vercel) y la contraseña codificada en DATABASE_URL (%21 para !).",
      },
      { status: 503 },
    );
  }
}
