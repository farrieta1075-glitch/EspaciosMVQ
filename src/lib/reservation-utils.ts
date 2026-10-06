import type { Reservation } from "@/types/reservation";

export function isPastReservation(reservation: Pick<Reservation, "endAt">): boolean {
  const end = new Date(reservation.endAt);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

export function defaultReservationAttendanceFields(): Pick<
  Reservation,
  | "estimatedAttendees"
  | "attendeeJustificationCode"
  | "attendeeJustificationNote"
  | "actualAttendees"
  | "attendanceComment"
> {
  return {
    estimatedAttendees: 0,
    attendeeJustificationCode: "",
    attendeeJustificationNote: "",
    actualAttendees: null,
    attendanceComment: "",
  };
}
