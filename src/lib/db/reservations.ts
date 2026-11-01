import "server-only";
import { serializeReservationDateTime } from "@/lib/date-utils";
import { normalizeReservationStatusValue } from "@/lib/sheets/reservation-row-parse";
import { getPrisma } from "@/lib/db/prisma";
import type {
  PendingAction,
  Reservation,
  ReservationResource,
  ReservationStatus,
} from "@/types/reservation";
import type { Reservation as DbReservation } from "@prisma/client";

export function parseSpaceIds(raw: string): string[] {
  if (!raw.trim()) return [];
  if (raw.startsWith("[")) {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function serializeSpaceIds(spaceIds: string[]): string {
  return JSON.stringify(spaceIds);
}

export function mapDbReservation(row: DbReservation): Reservation {
  return {
    id: row.id,
    eventName: row.eventName,
    eventDescription: row.eventDescription,
    spaceIds: parseSpaceIds(row.spaceIds),
    areaId: row.areaId,
    userId: row.userId,
    startAt: serializeReservationDateTime(row.startAt),
    endAt: serializeReservationDateTime(row.endAt),
    recurrenceRule: row.recurrenceRule,
    status: normalizeReservationStatusValue(row.status) as ReservationStatus,
    pendingAction: (row.pendingAction ?? "") as PendingAction,
    pendingPayload: row.pendingPayload,
    approvalToken: row.approvalToken,
    estimatedAttendees: row.estimatedAttendees,
    attendeeJustificationCode: row.attendeeJustificationCode,
    attendeeJustificationNote: row.attendeeJustificationNote,
    actualAttendees: row.actualAttendees,
    attendanceComment: row.attendanceComment,
    sendEventReminder: row.sendEventReminder,
  };
}

function reservationToDbData(reservation: Reservation) {
  return {
    id: reservation.id,
    eventName: reservation.eventName,
    spaceIds: serializeSpaceIds(reservation.spaceIds),
    areaId: reservation.areaId,
    userId: reservation.userId,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    recurrenceRule: reservation.recurrenceRule,
    status: reservation.status,
    eventDescription: reservation.eventDescription,
    pendingAction: reservation.pendingAction,
    pendingPayload: reservation.pendingPayload,
    approvalToken: reservation.approvalToken,
    estimatedAttendees: reservation.estimatedAttendees,
    attendeeJustificationCode: reservation.attendeeJustificationCode,
    attendeeJustificationNote: reservation.attendeeJustificationNote,
    actualAttendees: reservation.actualAttendees,
    attendanceComment: reservation.attendanceComment,
    sendEventReminder: reservation.sendEventReminder,
  };
}

export async function getAllReservationsSql(): Promise<Reservation[]> {
  const rows = await getPrisma().reservation.findMany();
  return rows.map(mapDbReservation);
}

export async function getReservationByIdSql(
  id: string,
): Promise<Reservation | null> {
  const row = await getPrisma().reservation.findUnique({ where: { id } });
  return row ? mapDbReservation(row) : null;
}

export async function insertReservationSql(
  reservation: Reservation,
): Promise<void> {
  await getPrisma().reservation.create({
    data: reservationToDbData(reservation),
  });
}

export async function updateReservationSql(
  reservation: Reservation,
): Promise<boolean> {
  try {
    await getPrisma().reservation.update({
      where: { id: reservation.id },
      data: reservationToDbData(reservation),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAllReservationResourcesSql(): Promise<
  ReservationResource[]
> {
  const rows = await getPrisma().reservationResource.findMany();
  return rows.map((row) => ({
    reservationId: row.reservationId,
    resourceId: row.resourceId,
    quantity: row.quantity,
  }));
}

export async function insertReservationResourceSql(
  reservationId: string,
  resourceId: string,
  quantity: number,
): Promise<void> {
  await getPrisma().reservationResource.create({
    data: { reservationId, resourceId, quantity },
  });
}

export async function replaceReservationResourcesSql(
  reservationId: string,
  resources: { resourceId: string; quantity: number }[],
): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.reservationResource.deleteMany({ where: { reservationId } });
    for (const item of resources) {
      if (item.quantity <= 0) continue;
      await tx.reservationResource.create({
        data: {
          reservationId,
          resourceId: item.resourceId,
          quantity: item.quantity,
        },
      });
    }
  });
}
