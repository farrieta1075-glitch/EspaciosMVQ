import "server-only";
import { z } from "zod";
import { appendSheetRow, getSheetRows, updateSheetRowById } from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { AppNotification, NotificationType } from "@/types/notification";

const notificationRowSchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional().default(""),
  areaId: z.string().optional().default(""),
  reservationId: z.string().optional().default(""),
  type: z.string().optional().default(""),
  message: z.string().optional().default(""),
  read: z
    .string()
    .optional()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  createdAt: z.string().optional().default(""),
});

function mapRowToNotification(row: Record<string, string>): AppNotification {
  const parsed = notificationRowSchema.parse(row);
  return {
    id: parsed.id,
    userId: parsed.userId,
    areaId: parsed.areaId,
    reservationId: parsed.reservationId,
    type: parsed.type as NotificationType,
    message: parsed.message,
    read: parsed.read,
    createdAt: parsed.createdAt,
  };
}

function notificationToRow(notification: AppNotification): string[] {
  return [
    notification.id,
    notification.userId,
    notification.areaId,
    notification.reservationId,
    notification.type,
    notification.message,
    notification.read ? "true" : "false",
    notification.createdAt,
  ];
}

export async function getNotificationsForUser(
  userId: string,
): Promise<AppNotification[]> {
  const { rows } = await getSheetRows(SHEET_TABS.NOTIFICACIONES);
  return rows
    .map(mapRowToNotification)
    .filter((item) => item.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const notifications = await getNotificationsForUser(userId);
  return notifications.filter((item) => !item.read).length;
}

export async function createNotification(input: {
  userId: string;
  areaId: string;
  reservationId: string;
  type: NotificationType;
  message: string;
}): Promise<AppNotification> {
  const { createId } = await import("@/lib/id");
  const notification: AppNotification = {
    id: createId("ntf"),
    userId: input.userId,
    areaId: input.areaId,
    reservationId: input.reservationId,
    type: input.type,
    message: input.message,
    read: false,
    createdAt: new Date().toISOString(),
  };

  await appendSheetRow(SHEET_TABS.NOTIFICACIONES, notificationToRow(notification));
  return notification;
}

export async function notifyAreaUsers(
  areaId: string,
  reservationId: string,
  type: NotificationType,
  message: string,
  userIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueIds) {
    await createNotification({
      userId,
      areaId,
      reservationId,
      type,
      message,
    });
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { rows } = await getSheetRows(SHEET_TABS.NOTIFICACIONES);
  const notification = rows.map(mapRowToNotification).find((item) => item.id === id);
  if (!notification) return false;
  return updateSheetRowById(SHEET_TABS.NOTIFICACIONES, id, notificationToRow({
    ...notification,
    read: true,
  }));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const notifications = await getNotificationsForUser(userId);
  for (const notification of notifications) {
    if (!notification.read) {
      await updateSheetRowById(
        SHEET_TABS.NOTIFICACIONES,
        notification.id,
        notificationToRow({ ...notification, read: true }),
      );
    }
  }
}
