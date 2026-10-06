import { canConfirmAttendance } from "@/lib/auth/reservation-permissions";
import { isSameDay } from "@/lib/date-utils";
import type { ReservationDetail } from "@/types/reservation";
import type { SessionUser, UserRole } from "@/types/user";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isCalendarDayInPast(day: Date): boolean {
  const today = startOfDay(new Date());
  return startOfDay(day).getTime() < today.getTime();
}

export function canSelectCalendarDay(
  day: Date,
  options: {
    isAdmin: boolean;
    viewerRole: UserRole;
    viewerUser: SessionUser | null;
    reservations: ReservationDetail[];
    pickMode?: boolean;
  },
): boolean {
  if (!isCalendarDayInPast(day)) return true;
  if (options.isAdmin) return true;

  if (options.pickMode) {
    return false;
  }

  if (options.viewerRole === "VISUALIZACION") {
    return false;
  }

  if (options.viewerRole === "GENERAL" && options.viewerUser) {
    return options.reservations.some(
      (reservation) =>
        isSameDay(new Date(reservation.startAt), day) &&
        canConfirmAttendance(options.viewerUser, reservation),
    );
  }

  return false;
}
