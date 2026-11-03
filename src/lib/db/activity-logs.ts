import "server-only";
import { getPrisma } from "@/lib/db/prisma";

export type UserActivityLogRow = {
  id: string;
  userId: string;
  userLabel: string;
  areaId: string;
  action: string;
  summary: string;
  path: string;
  meta: string;
  createdAt: string;
};

function mapRow(row: {
  id: string;
  userId: string;
  userLabel: string;
  areaId: string;
  action: string;
  summary: string;
  path: string;
  meta: string;
  createdAt: Date;
}): UserActivityLogRow {
  return {
    id: row.id,
    userId: row.userId,
    userLabel: row.userLabel,
    areaId: row.areaId,
    action: row.action,
    summary: row.summary,
    path: row.path,
    meta: row.meta,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertUserActivityLogSql(input: {
  id: string;
  userId: string;
  userLabel: string;
  areaId: string;
  action: string;
  summary: string;
  path: string;
  meta?: string;
  createdAt: string;
}): Promise<void> {
  await getPrisma().userActivityLog.create({
    data: {
      id: input.id,
      userId: input.userId,
      userLabel: input.userLabel.slice(0, 256),
      areaId: input.areaId.slice(0, 64),
      action: input.action.slice(0, 64),
      summary: input.summary.slice(0, 512),
      path: input.path.slice(0, 512),
      meta: input.meta?.slice(0, 8000) ?? "",
      createdAt: new Date(input.createdAt),
    },
  });
}

export async function listUserActivityLogsSql(input: {
  limit: number;
  userId?: string;
  since?: Date;
}): Promise<UserActivityLogRow[]> {
  const rows = await getPrisma().userActivityLog.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit, 1), 500),
  });
  return rows.map(mapRow);
}
