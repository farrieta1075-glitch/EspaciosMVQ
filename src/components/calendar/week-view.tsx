"use client";

import type { Area } from "@/types/area";
import type { ReservationDetail } from "@/types/reservation";
import {
  getReservationAreaColor,
  reservationDotClassName,
  reservationEventClassName,
  reservationStatusLabel,
} from "@/lib/calendar-utils";
import {
  formatDateISO,
  formatDayMonthShort,
  getWeekDays,
  isSameDay,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  anchorDate: Date;
  selectedDate: Date;
  reservations: ReservationDetail[];
  datesWithEvents: Set<string>;
  areas: Area[];
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAY_LABELS_SHORT = ["D", "L", "M", "X", "J", "V", "S"];

function eventsForDay(reservations: ReservationDetail[], day: Date) {
  return reservations
    .filter((reservation) => isSameDay(new Date(reservation.startAt), day))
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export function WeekView({
  anchorDate,
  selectedDate,
  reservations,
  datesWithEvents,
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
            <div key={iso} className="min-w-0 min-h-[140px] sm:min-h-[220px] lg:min-h-[280px]">
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  "flex w-full flex-col items-center border-b border-border px-0.5 py-2 text-center transition-colors sm:px-2 sm:py-3",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <span className="text-[10px] uppercase text-muted-foreground sm:hidden">
                  {WEEKDAY_LABELS_SHORT[index]}
                </span>
                <span className="hidden text-xs uppercase text-muted-foreground sm:inline">
                  {WEEKDAY_LABELS[index]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1 py-0.5 text-[11px] font-semibold tabular-nums sm:mt-1 sm:px-2 sm:py-1 sm:text-sm",
                    isToday && "bg-primary text-primary-foreground",
                    isSelected && !isToday && "ring-2 ring-primary/40",
                  )}
                >
                  <span className="sm:hidden">{day.getDate()}</span>
                  <span className="hidden sm:inline">
                    {formatDayMonthShort(day)}
                  </span>
                </span>
                {datesWithEvents.has(iso) && (
                  <span className="mt-0.5 flex gap-0.5 sm:mt-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={reservationDotClassName(
                          getReservationAreaColor(event, areas),
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>

              <div className="space-y-1 p-0.5 sm:space-y-1.5 sm:p-2">
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-0.5 py-1 sm:hidden">
                    {dayEvents.slice(0, 4).map((event) => (
                      <span
                        key={event.id}
                        className={reservationDotClassName(
                          getReservationAreaColor(event, areas),
                        )}
                        title={event.eventName}
                      />
                    ))}
                  </div>
                )}

                {dayEvents.map((event) => {
                  const color = getReservationAreaColor(event, areas);
                  const statusLabel = reservationStatusLabel(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectDate(day)}
                      className={cn(
                        "hidden w-full rounded-md sm:block",
                        reservationEventClassName(color, event),
                      )}
                    >
                      <p className="truncate font-medium">{event.eventName}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {event.areaName ?? "Sin área"}
                        {statusLabel ? ` · ${statusLabel}` : ""}
                      </p>
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
