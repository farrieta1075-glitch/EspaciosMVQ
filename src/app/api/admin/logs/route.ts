import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/api";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import { listUserActivityLogsSql } from "@/lib/db/activity-logs";
import { activityActionLabel } from "@/lib/activity-log";
import { getUserById } from "@/lib/sheets/users";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(500).optional().default(200),
  userId: z.string().min(1).max(64).optional(),
  days: z.coerce.number().min(1).max(90).optional().default(30),
});

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isSqlDatabaseEnabled()) {
    return NextResponse.json({
      logs: [],
      message:
        "Los logs requieren base de datos SQL (DATABASE_URL). No disponible en modo hojas.",
    });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    days: searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const since = new Date();
  since.setDate(since.getDate() - parsed.data.days);

  const rows = await listUserActivityLogsSql({
    limit: parsed.data.limit,
    userId: parsed.data.userId,
    since,
  });

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const users = await Promise.all(userIds.map((id) => getUserById(id)));
  const userMap = new Map(
    users.filter(Boolean).map((u) => [u!.id, u!]),
  );

  return NextResponse.json({
    logs: rows.map((row) => {
      const user = userMap.get(row.userId);
      return {
        ...row,
        actionLabel: activityActionLabel(row.action),
        areaName: user?.areaName ?? null,
        username: user?.username ?? null,
        email: user?.email ?? row.userLabel,
      };
    }),
  });
}
