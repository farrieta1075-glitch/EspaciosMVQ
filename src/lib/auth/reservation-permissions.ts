import type { SessionUser } from "@/types/user";
import type { Reservation } from "@/types/reservation";
import { can, isAdmin } from "@/lib/auth/permissions";
import { isPastReservation } from "@/lib/reservation-utils";

export function canAccessReservation(
  user: SessionUser | null,
  reservation: Reservation,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return reservation.areaId === user.areaId;
}

export function canModifyReservation(
  user: SessionUser | null,
  reservation: Reservation,
): boolean {
  if (!can(user, "modify:reservation")) return false;
  if (!canAccessReservation(user, reservation)) return false;
  if (isPastReservation(reservation) && !isAdmin(user)) return false;
  return true;
}

export function canCancelReservation(
  user: SessionUser | null,
  reservation: Reservation,
): boolean {
  if (!can(user, "cancel:reservation")) return false;
  if (!canAccessReservation(user, reservation)) return false;
  if (isPastReservation(reservation) && !isAdmin(user)) return false;
  return true;
}

export function canConfirmAttendance(
  user: SessionUser | null,
  reservation: Reservation,
): boolean {
  if (!canAccessReservation(user, reservation)) return false;
  if (reservation.status === "CANCELLED") return false;
  return isPastReservation(reservation);
}
