import { UserRound } from "lucide-react";
import {
  authorizationVisual,
  formatAuthorizationWhen,
} from "@/lib/reservation-decision";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";

export function ReservationAuthorizationMark({
  reservation,
}: {
  reservation: Reservation;
}) {
  const visual = authorizationVisual(reservation);
  const color =
    visual === "approved"
      ? "text-emerald-600 dark:text-emerald-400"
      : visual === "rejected"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const name =
    visual === "pending" ? "" : reservation.decisionByName.trim() || "";

  return (
    <div className="flex w-[4.75rem] shrink-0 flex-col items-center gap-0.5 text-center">
      <UserRound className={cn("h-5 w-5", color)} aria-hidden />
      {name ? (
        <span className="max-w-full truncate text-[10px] leading-tight text-foreground">
          {name}
        </span>
      ) : (
        <span className="text-[10px] leading-tight text-muted-foreground">
          {visual === "pending" ? "Pendiente" : ""}
        </span>
      )}
    </div>
  );
}

export function ReservationAuthorizationDetail({
  reservation,
}: {
  reservation: Reservation;
}) {
  const visual = authorizationVisual(reservation);
  const color =
    visual === "approved"
      ? "text-emerald-600 dark:text-emerald-400"
      : visual === "rejected"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
      <span className="text-muted-foreground">Autorización:</span>
      <span className="font-medium">
        {visual === "pending"
          ? "Pendiente"
          : visual === "approved"
            ? "Confirmado"
            : "Rechazado"}
      </span>
      {visual !== "pending" && reservation.decisionByName.trim() ? (
        <>
          <span className="text-muted-foreground">/</span>
          <UserRound className={cn("h-4 w-4", color)} aria-hidden />
          <span>{reservation.decisionByName.trim()}</span>
        </>
      ) : null}
      {visual !== "pending" && reservation.decisionAt ? (
        <>
          <span className="text-muted-foreground">/</span>
          <span>{formatAuthorizationWhen(reservation.decisionAt)}</span>
        </>
      ) : null}
    </p>
  );
}
