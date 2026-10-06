import type { Area } from "@/types/area";
import type { ReservationDetail } from "@/types/reservation";
import { getAreaColor, type AreaColorStyle } from "@/lib/area-colors";
import { cn } from "@/lib/utils";

export function isOwnAreaReservation(
  reservation: { areaId: string },
  viewerAreaId: string | null | undefined,
): boolean {
  return Boolean(viewerAreaId && reservation.areaId === viewerAreaId);
}

export function reservationEventClassName(
  color: AreaColorStyle,
  reservation: ReservationDetail,
): string {
  const pending =
    reservation.status === "PENDING" ||
    reservation.pendingAction === "UPDATE" ||
    reservation.pendingAction === "CANCEL";

  return cn(
    "border px-2 py-1.5 text-left text-xs transition-colors",
    color.bg,
    color.border,
    pending && "border-dashed opacity-80",
  );
}

export function reservationDotClassName(color: AreaColorStyle): string {
  return cn("h-1.5 w-1.5 rounded-full", color.dot);
}

export function getReservationAreaColor(
  reservation: ReservationDetail,
  areas: Area[],
): AreaColorStyle {
  const area = areas.find((item) => item.id === reservation.areaId);
  return getAreaColor(area ?? { id: reservation.areaId, name: reservation.areaName ?? "", code: "" });
}

export function reservationStatusLabel(reservation: ReservationDetail): string | null {
  if (reservation.status === "PENDING") return "Pendiente";
  if (reservation.pendingAction === "UPDATE") return "Cambio pendiente";
  if (reservation.pendingAction === "CANCEL") return "Cancelación pendiente";
  return null;
}
