import "server-only";
import { z } from "zod";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import {
  createNotificationSql,
  deleteNotificationForUserSql,
  getEventReminderReservationIdsSql,
  getNotificationsForUserSql,
  markAllNotificationsReadSql,
  markNotificationReadSql,
} from "@/lib/db/notifications";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  findRowIndexById,
  getSheetMeta,
  getSheetRows,
  updateSheetRowById,
} from "@/lib/sheets/repository";
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

function parseNotificationRow(row: Record<string, string>): AppNotification | null {
  if (!row.id?.trim()) return null;
  const parsed = notificationRowSchema.safeParse(row);
  if (!parsed.success) {
    console.warn(
      `[sheets] Fila de notificación ignorada (${row.id ?? "sin id"}):`,
      parsed.error.flatten().fieldErrors,
    );
    return null;
  }
  return {
    id: parsed.data.id,
    userId: parsed.data.userId,
    areaId: parsed.data.areaId,
    reservationId: parsed.data.reservationId,
    type: parsed.data.type as NotificationType,
    message: parsed.data.message,
    read: parsed.data.read,
    createdAt: parsed.data.createdAt,
  };
}

async function dispatchWebPush(userId: string, message: string, tag: string) {
  void import("@/lib/push/send-web-push")
    .then(({ sendWebPushToUser }) =>
      sendWebPushToUser(userId, {
        title: "MVQro Espacios",
        body: message,
        url: "/reservas",
        tag,
      }),
    )
    .catch((error) => {
      console.warn("[notifications] Web push no enviado:", error);
    });
}

export async function getNotificationsForUser(
  userId: string,
): Promise<AppNotification[]> {
  if (isSqlDatabaseEnabled()) {
    return getNotificationsForUserSql(userId);
  }
  const { rows } = await getSheetRows(SHEET_TABS.NOTIFICACIONES);
  return rows
    .map(parseNotificationRow)
    .filter((item): item is AppNotification => item !== null)
    .filter((item) => item.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function getEventReminderReservationIds(): Promise<Set<string>> {
  if (isSqlDatabaseEnabled()) {
    return getEventReminderReservationIdsSql();
  }
  const { rows } = await getSheetRows(SHEET_TABS.NOTIFICACIONES);
  const reminderSent = new Set<string>();
  for (const row of rows) {
    if (row.type === "EVENT_REMINDER" && row.reservationId) {
      reminderSent.add(row.reservationId);
    }
  }
  return reminderSent;
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

  if (isSqlDatabaseEnabled()) {
    const saved = await createNotificationSql({
      id: notification.id,
      userId: notification.userId,
      areaId: notification.areaId,
      reservationId: notification.reservationId,
      type: notification.type,
      message: notification.message,
      createdAt: notification.createdAt,
    });
    dispatchWebPush(input.userId, input.message, saved.id);
    return saved;
  }

  await appendSheetRow(SHEET_TABS.NOTIFICACIONES, notificationToRow(notification));
  dispatchWebPush(input.userId, input.message, notification.id);
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
  if (isSqlDatabaseEnabled()) {
    return markNotificationReadSql(id);
  }
  const { rows } = await getSheetRows(SHEET_TABS.NOTIFICACIONES);
  const notification = rows.map(mapRowToNotification).find((item) => item.id === id);
  if (!notification) return false;
  return updateSheetRowById(SHEET_TABS.NOTIFICACIONES, id, notificationToRow({
    ...notification,
    read: true,
  }));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isSqlDatabaseEnabled()) {
    await markAllNotificationsReadSql(userId);
    return;
  }
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

export async function deleteNotificationForUser(
  id: string,
  userId: string,
): Promise<boolean> {
  if (isSqlDatabaseEnabled()) {
    return deleteNotificationForUserSql(id, userId);
  }
  const notifications = await getNotificationsForUser(userId);
  const notification = notifications.find((item) => item.id === id);
  if (!notification) return false;

  const rowIndex = await findRowIndexById(SHEET_TABS.NOTIFICACIONES, id);
  if (!rowIndex) return false;

  const { sheetId } = await getSheetMeta(SHEET_TABS.NOTIFICACIONES);
  await deleteSheetRowByIndex(SHEET_TABS.NOTIFICACIONES, rowIndex, sheetId);
  return true;
}
