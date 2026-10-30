"use client";

import type { Area } from "@/types/area";
import type { ReservationDetail } from "@/types/reservation";
import {
  getReservationAreaColor,
  reservationDotStyle,
} from "@/lib/calendar-utils";
import { formatDateDisplay, isSameDay } from "@/lib/date-utils";

interface WeekDayEventListProps {
  day: Date;
  reservations: ReservationDetail[];
  areas: Area[];
}

function formatStartTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WeekDayEventList({
  day,
  reservations,
  areas,
}: WeekDayEventListProps) {
  const dayEvents = reservations
    .filter((reservation) => isSameDay(new Date(reservation.startAt), day))
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Eventos · {formatDateDisplay(day)}
      </p>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay eventos este día.</p>
      ) : (
        <ul className="space-y-2">
          {dayEvents.map((event) => {
            const color = getReservationAreaColor(event, areas);
            return (
              <li
                key={event.id}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={reservationDotStyle(color)}
                  aria-hidden
                />
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatStartTime(event.startAt)}
                </span>
                <span className="min-w-0 truncate font-medium">
                  {event.eventName}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
