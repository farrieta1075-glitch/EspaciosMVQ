import type { Reservation } from "@/types/reservation";
import { reservationNeedsAdminAction } from "@/types/reservation";

export type ApprovalResolutionOutcome = "approved" | "rejected" | "handled";

export function getApprovalResolution(
  reservation: Reservation,
): { handled: boolean; outcome: ApprovalResolutionOutcome | null; message: string | null } {
  if (reservationNeedsAdminAction(reservation)) {
    return { handled: false, outcome: null, message: null };
  }

  if (reservation.status === "CANCELLED") {
    return {
      handled: true,
      outcome: "rejected",
      message:
        "Otro administrador ya rechazó esta solicitud o la reserva quedó cancelada. No puedes cambiar esa decisión.",
    };
  }

  return {
    handled: true,
    outcome: "approved",
    message:
      "Otro administrador ya autorizó esta solicitud. No hace falta que vuelvas a confirmarla.",
  };
}
