import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { AppNotification, NotificationType } from "@/types/notification";

function mapRow(row: {
  id: string;
  userId: string;
  areaId: string;
  reservationId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
}): AppNotification {
  return {
    id: row.id,
    userId: row.userId,
    areaId: row.areaId,
    reservationId: row.reservationId,
    type: row.type as NotificationType,
    message: row.message,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getNotificationsForUserSql(
  userId: string,
): Promise<AppNotification[]> {
  const prisma = getPrisma();
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapRow);
}

export async function getEventReminderReservationIdsSql(): Promise<Set<string>> {
  const prisma = getPrisma();
  const rows = await prisma.notification.findMany({
    where: { type: "EVENT_REMINDER" },
    select: { reservationId: true },
  });
  return new Set(
    rows
      .map((row: { reservationId: string }) => row.reservationId)
      .filter(Boolean),
  );
}

export async function createNotificationSql(input: {
  id: string;
  userId: string;
  areaId: string;
  reservationId: string;
  type: NotificationType;
  message: string;
  createdAt: string;
}): Promise<AppNotification> {
  const prisma = getPrisma();
  const row = await prisma.notification.create({
    data: {
      id: input.id,
      userId: input.userId,
      areaId: input.areaId,
      reservationId: input.reservationId,
      type: input.type,
      message: input.message,
      read: false,
      createdAt: new Date(input.createdAt),
    },
  });
  return mapRow(row);
}

export async function markNotificationReadSql(id: string): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.notification.updateMany({
    where: { id },
    data: { read: true },
  });
  return result.count > 0;
}

export async function markAllNotificationsReadSql(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function deleteNotificationForUserSql(
  id: string,
  userId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.notification.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}
