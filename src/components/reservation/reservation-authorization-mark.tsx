import { UserRound } from "lucide-react";
import {
  activityKindLabel,
  authorizationVisual,
  formatAuthorizationWhen,
  parseReservationActivityLog,
} from "@/lib/reservation-decision";
import type { Reservation } from "@/types/reservation";
import { cn } from "@/lib/utils";

function PersonIcon({ className }: { className?: string }) {
  return (
    <UserRound
      className={className}
      fill="currentColor"
      strokeWidth={1.25}
      aria-hidden
    />
  );
}

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
    <div className={cn("flex items-center gap-1", color)}>
      <PersonIcon className="h-3.5 w-3.5 shrink-0" />
      {name ? (
        <span className="max-w-[6.5rem] truncate text-[10px] leading-tight text-foreground">
          {name}
        </span>
      ) : null}
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
          <PersonIcon className={cn("h-3.5 w-3.5", color)} />
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

export function ReservationActivityLines({
  reservation,
}: {
  reservation: Reservation;
}) {
  const entries = parseReservationActivityLog(reservation.activityLog);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1 text-sm">
      {entries.map((entry, index) => (
        <p
          key={`${entry.kind}-${entry.at}-${index}`}
          className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
        >
          <span className="text-muted-foreground">
            {activityKindLabel(entry.kind)}:
          </span>
          <PersonIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{entry.name}</span>
          <span className="text-muted-foreground">/</span>
          <span>{formatAuthorizationWhen(entry.at)}</span>
        </p>
      ))}
    </div>
  );
}
