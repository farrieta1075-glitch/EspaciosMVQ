import type { SessionUser } from "@/types/user";
import type { Reservation } from "@/types/reservation";
import { can, isAdmin } from "@/lib/auth/permissions";
import { isPastReservation } from "@/lib/reservation-utils";

/** Alcance ya expandido: áreas asignadas + sus subáreas descendientes. */
export type ReservationAreaAccess = {
  areaScopeIds?: string[];
};

function reservationInUserScope(
  user: SessionUser,
  reservation: Reservation,
  access?: ReservationAreaAccess,
): boolean {
  if (isAdmin(user)) return true;
  const scope = (access?.areaScopeIds ?? []).filter(Boolean);
  if (scope.length > 0) {
    return scope.includes(reservation.areaId);
  }
  return Boolean(user.areaId) && reservation.areaId === user.areaId;
}

export function canAccessReservation(
  user: SessionUser | null,
  reservation: Reservation,
  access?: ReservationAreaAccess,
): boolean {
  if (!user) return false;
  return reservationInUserScope(user, reservation, access);
}

export function canModifyReservation(
  user: SessionUser | null,
  reservation: Reservation,
  access?: ReservationAreaAccess,
): boolean {
  if (!can(user, "modify:reservation")) return false;
  if (!canAccessReservation(user, reservation, access)) return false;
  if (isPastReservation(reservation) && !isAdmin(user)) return false;
  return true;
}

export function canCancelReservation(
  user: SessionUser | null,
  reservation: Reservation,
  access?: ReservationAreaAccess,
): boolean {
  if (!can(user, "cancel:reservation")) return false;
  if (!canAccessReservation(user, reservation, access)) return false;
  if (isPastReservation(reservation) && !isAdmin(user)) return false;
  return true;
}

export function canConfirmAttendance(
  user: SessionUser | null,
  reservation: Reservation,
  access?: ReservationAreaAccess,
): boolean {
  if (!canAccessReservation(user, reservation, access)) return false;
  if (reservation.status === "CANCELLED") return false;
  return isPastReservation(reservation);
}
