import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { PushSubscriptionRecord } from "@/types/push-subscription";

function mapRecord(row: {
  id: string;
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  updatedAt: Date;
}): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.userAgent,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertPushSubscriptionSql(input: {
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<PushSubscriptionRecord> {
  const prisma = getPrisma();
  const { createId } = await import("@/lib/id");
  const now = new Date();

  const byEndpoint = await prisma.pushSubscription.findUnique({
    where: { endpoint: input.endpoint },
  });
  const byDevice = byEndpoint
    ? null
    : await prisma.pushSubscription.findFirst({
        where: { deviceId: input.deviceId },
      });

  const existing = byEndpoint ?? byDevice;
  const data = {
    userId: input.userId,
    deviceId: input.deviceId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent?.trim() ?? existing?.userAgent ?? "",
    updatedAt: now,
  };

  const row = existing
    ? await prisma.pushSubscription.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.pushSubscription.create({
        data: {
          id: createId("psub"),
          ...data,
        },
      });

  return mapRecord(row);
}

export async function getPushSubscriptionsForUserSql(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  if (!userId) return [];
  const prisma = getPrisma();
  const rows = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  return rows.map(mapRecord);
}

export async function removePushSubscriptionByEndpointSql(
  endpoint: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
  return result.count > 0;
}
