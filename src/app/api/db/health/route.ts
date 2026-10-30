import { NextResponse } from "next/server";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  if (!isSqlDatabaseEnabled()) {
    return NextResponse.json({
      ok: true,
      mode: "sheets",
      message: "DATABASE_URL no definida; se usa Google Sheets.",
    });
  }

  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true, mode: "sql" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error de conexión a SQL";
    return NextResponse.json({ ok: false, mode: "sql", error: message }, { status: 503 });
  }
}
