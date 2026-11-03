import "server-only";
import { getAllReservations } from "@/lib/sheets/reservations";
import type { Reservation } from "@/types/reservation";

/** Fechas de una misma solicitud de alta (recurrencia comparte approvalToken). */
export async function getPendingCreateBatchMembers(
  reservation: Reservation,
): Promise<Reservation[]> {
  if (reservation.status !== "PENDING" || reservation.pendingAction) {
    return [reservation];
  }

  const token = reservation.approvalToken.trim();
  if (!token) return [reservation];

  const all = await getAllReservations();
  return all
    .filter(
      (item) =>
        item.status === "PENDING" &&
        !item.pendingAction &&
        item.approvalToken === token,
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
