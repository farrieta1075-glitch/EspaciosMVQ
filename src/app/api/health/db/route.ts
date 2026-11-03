import { NextResponse } from "next/server";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import { warmupDatabase } from "@/lib/db/warmup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ping ligero para monitoreo o mantener Azure SQL despierta (UptimeRobot, etc.). */
export async function GET() {
  if (!isSqlDatabaseEnabled()) {
    return NextResponse.json(
      { ok: false, reason: "DATABASE_URL no configurada" },
      { status: 503 },
    );
  }

  try {
    const result = await warmupDatabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error de conexión",
      },
      { status: 503 },
    );
  }
}
