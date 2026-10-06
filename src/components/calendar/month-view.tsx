"use client";

import type { Area } from "@/types/area";
import type { ReservationDetail } from "@/types/reservation";
import {
  getReservationAreaColor,
  reservationDotClassName,
} from "@/lib/calendar-utils";
import {
  formatDateISO,
  formatDayMonthShort,
  formatMonthYear,
  getMonthGrid,
  isSameDay,
  isSameMonth,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  anchorDate: Date;
  selectedDate: Date;
  reservations: ReservationDetail[];
  datesWithEvents: Set<string>;
  areas: Area[];
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function eventsForDay(reservations: ReservationDetail[], day: Date) {
  return reservations.filter((reservation) =>
    isSameDay(new Date(reservation.startAt), day),
  );
}

export function MonthView({
  anchorDate,
  selectedDate,
  reservations,
  datesWithEvents,
  areas,
  onSelectDate,
}: MonthViewProps) {
  const days = getMonthGrid(anchorDate);
  const today = new Date();

  const eventCountByDate = reservations.reduce<Record<string, number>>(
    (acc, reservation) => {
      const key = formatDateISO(new Date(reservation.startAt));
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card p-2 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2 sm:mb-3 sm:pb-3">
        <h3 className="truncate text-sm font-semibold sm:text-lg">
          {formatMonthYear(anchorDate)}
        </h3>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5 sm:mb-2 sm:gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-0.5 text-center text-[10px] font-medium uppercase text-muted-foreground sm:py-1 sm:text-xs"
          >
            <span className="sm:hidden">{label.charAt(0)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((day) => {
          const iso = formatDateISO(day);
          const inMonth = isSameMonth(day, anchorDate);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const count = eventCountByDate[iso] ?? 0;
          const hasEvents = datesWithEvents.has(iso);
          const dayEvents = eventsForDay(reservations, day);
          const dotEvents = dayEvents.slice(0, 3);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex min-h-[48px] min-w-0 flex-col rounded-md border p-0.5 text-left transition-colors sm:min-h-[72px] sm:rounded-lg sm:p-2 lg:min-h-[84px]",
                inMonth ? "border-border/80" : "border-transparent opacity-40",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "hover:bg-muted/50",
                hasEvents && !isSelected && "bg-secondary/10",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium tabular-nums sm:text-sm",
                  inMonth ? "inline-flex h-6 w-6 items-center justify-center rounded-full" : "",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {inMonth ? day.getDate() : formatDayMonthShort(day)}
              </span>

              {count > 0 && (
                <div className="mt-auto space-y-1">
                  <div className="flex gap-0.5">
                    {dotEvents.map((event) => (
                      <span
                        key={event.id}
                        className={reservationDotClassName(
                          getReservationAreaColor(event, areas),
                        )}
                      />
                    ))}
                  </div>
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    {count} reserva{count === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
