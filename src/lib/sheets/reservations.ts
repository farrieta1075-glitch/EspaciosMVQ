import "server-only";
import { z } from "zod";
import {
  appendSheetRow,
  deleteSheetRowByIndex,
  getSheetMeta,
  getSheetRowsCanonical,
  updateSheetRowById,
} from "@/lib/sheets/repository";
import { serializeReservationDateTime } from "@/lib/date-utils";
import {
  normalizeReservationStatusValue,
  remapLegacyShiftedReservationRow,
} from "@/lib/sheets/reservation-row-parse";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type {
  PendingAction,
  Reservation,
  ReservationResource,
  ReservationStatus,
} from "@/types/reservation";

const reservationRowSchema = z.object({
  id: z.string().min(1),
  eventName: z.string().optional().default(""),
  spaceIds: z.string().optional().default(""),
  areaId: z.string().optional().default(""),
  userId: z.string().optional().default(""),
  startAt: z.string().optional().default(""),
  endAt: z.string().optional().default(""),
  recurrenceRule: z.string().optional().default(""),
  status: z.preprocess(
    (value) => normalizeReservationStatusValue(value),
    z.enum(["CONFIRMED", "CANCELLED", "PENDING"]),
  ),
  eventDescription: z.string().optional().default(""),
  pendingAction: z.string().optional().default(""),
  pendingPayload: z.string().optional().default(""),
  approvalToken: z.string().optional().default(""),
  estimatedAttendees: z.coerce.number().optional().default(0),
  attendeeJustificationCode: z.string().optional().default(""),
  attendeeJustificationNote: z.string().optional().default(""),
  actualAttendees: z
    .string()
    .optional()
    .default("")
    .transform((value) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }),
  attendanceComment: z.string().optional().default(""),
});

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

type ParsedReservationRow = z.infer<typeof reservationRowSchema>;

function mapParsedRowToReservation(parsed: ParsedReservationRow): Reservation {
  return {
    id: parsed.id,
    eventName: parsed.eventName,
    eventDescription: parsed.eventDescription,
    spaceIds: parseSpaceIds(parsed.spaceIds),
    areaId: parsed.areaId,
    userId: parsed.userId,
    startAt: serializeReservationDateTime(parsed.startAt),
    endAt: serializeReservationDateTime(parsed.endAt),
    recurrenceRule: parsed.recurrenceRule,
    status: parsed.status as ReservationStatus,
    pendingAction: parsed.pendingAction as PendingAction,
    pendingPayload: parsed.pendingPayload,
    approvalToken: parsed.approvalToken,
    estimatedAttendees: parsed.estimatedAttendees,
    attendeeJustificationCode: parsed.attendeeJustificationCode,
    attendeeJustificationNote: parsed.attendeeJustificationNote,
    actualAttendees: parsed.actualAttendees,
    attendanceComment: parsed.attendanceComment,
  };
}

export function reservationToRow(reservation: Reservation): string[] {
  return [
    reservation.id,
    reservation.eventName,
    serializeSpaceIds(reservation.spaceIds),
    reservation.areaId,
    reservation.userId,
    reservation.startAt,
    reservation.endAt,
    reservation.recurrenceRule,
    reservation.status,
    reservation.eventDescription,
    reservation.pendingAction,
    reservation.pendingPayload,
    reservation.approvalToken,
    String(reservation.estimatedAttendees ?? 0),
    reservation.attendeeJustificationCode ?? "",
    reservation.attendeeJustificationNote ?? "",
    reservation.actualAttendees != null
      ? String(reservation.actualAttendees)
      : "",
    reservation.attendanceComment ?? "",
  ];
}

function isReservationDataRow(row: Record<string, string>): boolean {
  return Boolean(row.id?.trim());
}

export async function getAllReservations(): Promise<Reservation[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.RESERVAS);
  const reservations: Reservation[] = [];

  for (const row of rows) {
    if (!isReservationDataRow(row)) continue;

    const normalized = remapLegacyShiftedReservationRow(row);
    const parsed = reservationRowSchema.safeParse(normalized);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de reserva ignorada (${row.id ?? "sin id"}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }

    reservations.push(mapParsedRowToReservation(parsed.data));
  }

  return reservations;
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  return (await getAllReservations()).find((reservation) => reservation.id === id) ?? null;
}

export async function getActiveReservations(): Promise<Reservation[]> {
  return (await getAllReservations()).filter(
    (reservation) => reservation.status !== "CANCELLED",
  );
}

export async function getReservationsNeedingApproval(): Promise<Reservation[]> {
  return (await getAllReservations()).filter(
    (reservation) =>
      reservation.status === "PENDING" ||
      reservation.pendingAction === "UPDATE" ||
      reservation.pendingAction === "CANCEL",
  );
}

export async function updateReservationRecord(
  reservation: Reservation,
): Promise<boolean> {
  return updateSheetRowById(
    SHEET_TABS.RESERVAS,
    reservation.id,
    reservationToRow(reservation),
  );
}

export async function getAllReservationResources(): Promise<ReservationResource[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.RESERVA_RECURSOS);
  return rows
    .filter((row) => row.reservationId && row.resourceId)
    .map((row) => ({
      reservationId: row.reservationId,
      resourceId: row.resourceId,
      quantity: Number(row.quantity) || 0,
    }));
}

export async function getResourcesForReservation(
  reservationId: string,
): Promise<ReservationResource[]> {
  return (await getAllReservationResources()).filter(
    (item) => item.reservationId === reservationId,
  );
}

export async function replaceReservationResources(
  reservationId: string,
  resources: { resourceId: string; quantity: number }[],
): Promise<void> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.RESERVA_RECURSOS);
  const { sheetId } = await getSheetMeta(SHEET_TABS.RESERVA_RECURSOS);

  const indicesToDelete = rows
    .map((row, index) => ({ row, index: index + 2 }))
    .filter(({ row }) => row.reservationId === reservationId)
    .map(({ index }) => index)
    .sort((a, b) => b - a);

  for (const rowIndex of indicesToDelete) {
    await deleteSheetRowByIndex(
      SHEET_TABS.RESERVA_RECURSOS,
      rowIndex,
      sheetId,
    );
  }

  for (const resource of resources) {
    if (resource.quantity <= 0) continue;
    await appendSheetRow(SHEET_TABS.RESERVA_RECURSOS, [
      reservationId,
      resource.resourceId,
      String(resource.quantity),
    ]);
  }
}

export function reservationsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA < endB && endA > startB;
}

export function parseDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}
