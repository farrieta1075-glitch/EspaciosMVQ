import type { SheetRow } from "@/lib/sheets/repository";
import type { ReservationStatus } from "@/types/reservation";

const RESERVATION_STATUSES = new Set<ReservationStatus>([
  "CONFIRMED",
  "CANCELLED",
  "PENDING",
]);

export function normalizeReservationStatusValue(
  value: unknown,
): ReservationStatus {
  const upper = String(value ?? "")
    .trim()
    .toUpperCase();
  if (RESERVATION_STATUSES.has(upper as ReservationStatus)) {
    return upper as ReservationStatus;
  }
  return "CONFIRMED";
}

function isReservationStatusToken(value: string | undefined): boolean {
  const upper = value?.trim().toUpperCase() ?? "";
  return RESERVATION_STATUSES.has(upper as ReservationStatus);
}

/** Corrige filas donde el status quedó en la columna estimatedAttendees por desalineación. */
export function remapLegacyShiftedReservationRow(row: SheetRow): SheetRow {
  if (isReservationStatusToken(row.status)) {
    return row;
  }
  if (isReservationStatusToken(row.estimatedAttendees)) {
    return {
      ...row,
      status: row.estimatedAttendees!.trim().toUpperCase(),
      estimatedAttendees: "0",
    };
  }
  return row;
}
