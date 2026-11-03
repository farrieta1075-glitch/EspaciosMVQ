import "server-only";
import { parseRecurrenceRule } from "@/lib/recurrence";
import { getAllReservations } from "@/lib/sheets/reservations";
import type { Reservation } from "@/types/reservation";

function isPendingCreate(reservation: Reservation): boolean {
  return reservation.status === "PENDING" && !reservation.pendingAction;
}

/** Clave estable para agrupar una serie recurrente en una sola autorización. */
export function pendingCreateGroupKey(reservation: Reservation): string {
  const batchId = reservation.approvalBatchId?.trim();
  if (batchId) return `batch:${batchId}`;

  const token = reservation.approvalToken?.trim();
  if (token) return `token:${token}`;

  const recurrence = parseRecurrenceRule(reservation.recurrenceRule);
  if (
    isPendingCreate(reservation) &&
    recurrence &&
    recurrence.type !== "NONE"
  ) {
    return `rec:${reservation.userId}:${reservation.eventName.trim().toLowerCase()}:${reservation.areaId}:${reservation.recurrenceRule}`;
  }

  return `single:${reservation.id}`;
}

export function isGroupedPendingCreate(reservation: Reservation): boolean {
  return !pendingCreateGroupKey(reservation).startsWith("single:");
}

export async function getPendingCreateBatchMembers(
  reservation: Reservation,
): Promise<Reservation[]> {
  if (!isPendingCreate(reservation)) {
    return [reservation];
  }

  const key = pendingCreateGroupKey(reservation);
  if (key.startsWith("single:")) {
    return [reservation];
  }

  const all = await getAllReservations();
  return all
    .filter(
      (item) => isPendingCreate(item) && pendingCreateGroupKey(item) === key,
    )
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export async function findPendingReservationsByApprovalBatchId(
  approvalBatchId: string,
): Promise<Reservation[]> {
  const id = approvalBatchId.trim();
  if (!id) return [];
  const all = await getAllReservations();
  return all
    .filter(
      (item) =>
        isPendingCreate(item) && item.approvalBatchId.trim() === id,
    )
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export type ApprovalOccurrence = { startAt: string; endAt: string };

export function occurrencesFromBatch(
  batch: Reservation[],
): ApprovalOccurrence[] {
  return batch.map((item) => ({
    startAt: item.startAt,
    endAt: item.endAt,
  }));
}
