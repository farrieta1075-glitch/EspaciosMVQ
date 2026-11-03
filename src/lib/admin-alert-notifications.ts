import "server-only";
import type { Reservation } from "@/types/reservation";

export type AdminAlertKind = "create" | "update" | "cancel" | "withdraw";

export function resolveAdminAlertKind(
  reservation: Reservation,
  override?: AdminAlertKind,
): AdminAlertKind {
  if (override) return override;
  if (reservation.pendingAction === "CANCEL") return "cancel";
  if (reservation.pendingAction === "UPDATE") return "update";
  return "create";
}

export function buildAdminAlertBatchMarker(
  batchId: string,
  kind: AdminAlertKind,
): string {
  return `[batch:${batchId.trim()}:${kind}]`;
}

export function stripAdminAlertBatchMarker(message: string): string {
  return message.replace(/^\[batch:[^\]]+\]\s*/, "").trim();
}

export function adminAlertPushTitle(kind: AdminAlertKind): string {
  switch (kind) {
    case "cancel":
      return "Cancelación pendiente";
    case "update":
      return "Cambio pendiente";
    case "withdraw":
      return "Solicitud retirada";
    default:
      return "Autorización pendiente";
  }
}

export function buildAdminAlertMessage(input: {
  kind: AdminAlertKind;
  batchId: string;
  eventName: string;
  areaName: string;
  occurrenceCount?: number;
}): string {
  const occLabel =
    input.occurrenceCount && input.occurrenceCount > 1
      ? ` (${input.occurrenceCount} fechas)`
      : "";
  const marker = buildAdminAlertBatchMarker(input.batchId, input.kind);
  const event = `«${input.eventName}»`;
  const place = input.areaName;

  switch (input.kind) {
    case "withdraw":
      return `${marker} El solicitante retiró la reserva pendiente ${event} en ${place}${occLabel}.`;
    case "cancel":
      return `${marker} Solicitud de cancelación: ${event} en ${place}${occLabel}.`;
    case "update":
      return `${marker} Solicitud de cambio: ${event} en ${place}${occLabel}.`;
    default:
      return `${marker} Solicitud pendiente: ${event} en ${place}${occLabel}.`;
  }
}
