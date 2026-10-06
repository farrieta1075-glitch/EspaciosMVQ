"use client";

import type { Area } from "@/types/area";
import type { ReservationDetail } from "@/types/reservation";
import {
  getReservationAreaColor,
  reservationDotStyle,
} from "@/lib/calendar-utils";
import { formatDateISO, getWeekDays, isSameDay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  anchorDate: Date;
  selectedDate: Date;
  reservations: ReservationDetail[];
  areas: Area[];
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_LABELS_SHORT = ["D", "L", "M", "X", "J", "V", "S"];

function eventsForDay(reservations: ReservationDetail[], day: Date) {
  return reservations
    .filter((reservation) => isSameDay(new Date(reservation.startAt), day))
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

function attendeeLabel(event: ReservationDetail): string {
  const n = event.estimatedAttendees;
  if (n > 0) return String(n);
  return "—";
}

export function WeekView({
  anchorDate,
  selectedDate,
  reservations,
  areas,
  onSelectDate,
}: WeekViewProps) {
  const days = getWeekDays(anchorDate);
  const today = new Date();

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid w-full min-w-0 grid-cols-7 divide-x divide-border">
        {days.map((day, index) => {
          const iso = formatDateISO(day);
          const dayEvents = eventsForDay(reservations, day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={iso}
              className="flex min-h-[120px] min-w-0 flex-col sm:min-h-[200px]"
            >
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex w-full flex-col items-center border-b border-border px-0.5 py-2 text-center transition-colors sm:px-2 sm:py-3",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <span className="text-[10px] uppercase text-muted-foreground sm:text-xs">
                  {WEEKDAY_LABELS_SHORT[index]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums sm:mt-1 sm:h-8 sm:w-8 sm:text-sm",
                    isToday && "bg-primary text-primary-foreground",
                    isSelected && !isToday && "ring-2 ring-primary/40",
                  )}
                >
                  {day.getDate()}
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-1 p-1 sm:gap-1.5 sm:p-2">
                {dayEvents.map((event) => {
                  const color = getReservationAreaColor(event, areas);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectDate(day)}
                      className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-muted/60 sm:px-1.5 sm:py-1"
                      title={event.eventName}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                        style={reservationDotStyle(color)}
                      />
                      <span className="truncate text-[10px] tabular-nums text-muted-foreground sm:text-xs">
                        {attendeeLabel(event)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
