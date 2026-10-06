import type { SessionUser } from "@/types/user";
import type { Reservation } from "@/types/reservation";
import { can, isAdmin } from "@/lib/auth/permissions";

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
  return canAccessReservation(user, reservation);
}

export function canCancelReservation(
  user: SessionUser | null,
  reservation: Reservation,
): boolean {
  if (!can(user, "cancel:reservation")) return false;
  return canAccessReservation(user, reservation);
}
