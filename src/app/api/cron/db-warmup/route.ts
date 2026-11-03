import { NextResponse } from "next/server";
import { warmupDatabase } from "@/lib/db/warmup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  try {
    const result = await warmupDatabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/db-warmup]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error al calentar SQL",
      },
      { status: 503 },
    );
  }
}
